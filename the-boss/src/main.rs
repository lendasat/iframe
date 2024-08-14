use crate::logger::init_tracing;
use axum::Router;
use tracing::level_filters::LevelFilter;

mod logger;
mod routes;

#[tokio::main]
async fn main() {
    init_tracing(LevelFilter::DEBUG, false, true).expect("to work");
    tracing::info!("Hello World");

    let app = Router::new()
        .merge(routes::health_check::router())
        .merge(routes::frontend::router());

    let address = "0.0.0.0:7337";
    tracing::info!("start listening http://{}", address);
    let listener = tokio::net::TcpListener::bind(address).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use bdk_wallet::keys::{DerivableKey, DescriptorKey, IntoDescriptorKey, ValidNetworks};
    use bdk_wallet::miniscript::descriptor::{DescriptorPublicKey, KeyMap};
    use bdk_wallet::miniscript::{Descriptor, Segwitv0};
    use bdk_wallet::{bitcoin::Network, descriptor, KeychainKind, SignOptions, Wallet};
    use bitcoin::bip32::{DerivationPath, Xpriv, Xpub};
    use bitcoin::secp256k1::{All, Secp256k1, SecretKey};
    use bitcoin::transaction::Version;
    use bitcoin::{
        absolute, Amount, OutPoint, Psbt, ScriptBuf, Sequence, Transaction, TxIn, Witness,
    };
    use bitcoin::{bip32, TxOut};
    use std::str::FromStr;

    const BOSS_SK: &str = "0000000000000000000000000000000000000000000000000000000000000001";
    const BORROWER_SK: &str = "0000000000000000000000000000000000000000000000000000000000000002";
    const FALLBACK_SK: &str = "0000000000000000000000000000000000000000000000000000000000000003";

    const EXTERNAL_DERIVATION_PATH: &str = "m/84/1/0/0";
    const INTERNAL_DERIVATION_PATH: &str = "m/84/1/0/1";

    #[test]
    fn verify_that_we_can_spend_2_of_3() {
        let network = Network::Testnet;
        let secp = Secp256k1::new();

        // 1. Create keys and wallets

        let boss_sk = SecretKey::from_str(BOSS_SK).unwrap();
        let borrower_sk = SecretKey::from_str(BORROWER_SK).unwrap();
        let fallback_sk = SecretKey::from_str(FALLBACK_SK).unwrap();

        let (boss_xprv, boss_xpub) = create_xprv_xpub(network, &secp, boss_sk);
        let (borrower_xprv, borrower_xpub) = create_xprv_xpub(network, &secp, borrower_sk);
        let (fallback_xprv, fallback_xpub) = create_xprv_xpub(network, &secp, fallback_sk);

        let mut boss_wallet = create_wallet(boss_xprv, borrower_xpub, fallback_xpub, network);
        let borrower_wallet = create_wallet(boss_xpub, borrower_xprv, fallback_xpub, network);
        let _fallback_wallet = create_wallet(boss_xpub, borrower_xpub, fallback_xprv, network);

        let collateral_address_info = boss_wallet.reveal_next_address(KeychainKind::External);

        println!("Collateral address: {}", collateral_address_info.address);
        assert_eq!(
            "tb1q90dn08cdsy0fnppc273n7n6w4np83397z9xf8pjlns2q6ar97l6srcjx92",
            collateral_address_info.address.to_string()
        );

        // 2. Build fund TX

        let collateral_amount = Amount::ONE_BTC;
        let collateral_spk = collateral_address_info.script_pubkey();
        let collateral_output = TxOut {
            value: collateral_amount,
            script_pubkey: collateral_spk.clone(),
        };

        let fund_tx = Transaction {
            version: Version::TWO,
            lock_time: absolute::LockTime::ZERO,
            // The inputs of the fund TX are irrelevant to this test.
            input: Vec::new(),
            output: vec![collateral_output],
        };

        // 3. Build reclaim collateral TX

        let collateral_input = TxIn {
            previous_output: OutPoint {
                txid: fund_tx.compute_txid(),
                vout: 0,
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
            witness: Witness::new(),
        };

        let fee = Amount::from_sat(1_000);
        let reclaim_collateral_amount = collateral_amount - fee;
        let reclaim_collateral_output = TxOut {
            value: reclaim_collateral_amount,
            script_pubkey: ScriptBuf::new(),
        };

        let unsigned_reclaim_collateral_tx = Transaction {
            version: Version::TWO,
            lock_time: absolute::LockTime::ZERO,
            input: vec![collateral_input],
            output: vec![reclaim_collateral_output],
        };

        // 4. Sign reclaim collateral TX with 2 parties at a time.

        let mut reclaim_collateral_tx_psbt =
            Psbt::from_unsigned_tx(unsigned_reclaim_collateral_tx).unwrap();

        reclaim_collateral_tx_psbt.inputs[0].non_witness_utxo = Some(fund_tx);

        let finalized = boss_wallet
            .sign(&mut reclaim_collateral_tx_psbt, SignOptions::default())
            .unwrap();

        assert!(!finalized);

        let finalized = borrower_wallet
            .sign(&mut reclaim_collateral_tx_psbt, SignOptions::default())
            .unwrap();

        assert!(finalized);

        let reclaim_collateral_tx = reclaim_collateral_tx_psbt
            .extract_tx()
            .expect("signed reclaim collateral TX");

        collateral_spk
            .verify(
                0,
                collateral_amount,
                bitcoin::consensus::serialize(&reclaim_collateral_tx).as_slice(),
            )
            .expect("can spend collateral output");
    }

    fn create_wallet(
        boss: impl DerivableKey<Segwitv0> + Copy,
        borrower: impl DerivableKey<Segwitv0> + Copy,
        fallback: impl DerivableKey<Segwitv0> + Copy,
        network: Network,
    ) -> Wallet {
        let external_desc = {
            let path = external_derivation_path();

            let boss = (boss, path.clone()).into_descriptor_key().unwrap();
            let borrower = (borrower, path.clone()).into_descriptor_key().unwrap();
            let fallback = (fallback, path).into_descriptor_key().unwrap();

            create_multisig_descriptor(boss, borrower, fallback)
        };

        // TODO: Do we need a _multisig_ change descriptor?
        let internal_desc = {
            let path = internal_derivation_path();

            let boss = (boss, path.clone()).into_descriptor_key().unwrap();
            let borrower = (borrower, path.clone()).into_descriptor_key().unwrap();
            let fallback = (fallback, path).into_descriptor_key().unwrap();

            create_multisig_descriptor(boss, borrower, fallback)
        };

        Wallet::create(external_desc, internal_desc)
            .network(network)
            .create_wallet_no_persist()
            .expect("wallet")
    }

    fn create_multisig_descriptor(
        boss: DescriptorKey<Segwitv0>,
        borrower: DescriptorKey<Segwitv0>,
        fallback: DescriptorKey<Segwitv0>,
    ) -> (Descriptor<DescriptorPublicKey>, KeyMap, ValidNetworks) {
        descriptor!(wsh(sortedmulti(2, boss, borrower, fallback))).unwrap()
    }

    fn external_derivation_path() -> DerivationPath {
        bip32::DerivationPath::from_str(EXTERNAL_DERIVATION_PATH).unwrap()
    }

    fn internal_derivation_path() -> DerivationPath {
        bip32::DerivationPath::from_str(INTERNAL_DERIVATION_PATH).unwrap()
    }

    fn create_xprv_xpub(
        network: Network,
        secp: &Secp256k1<All>,
        secret_key: SecretKey,
    ) -> (Xpriv, Xpub) {
        let xprv = Xpriv::new_master(network, secret_key.as_ref()).unwrap();
        let xpub = Xpub::from_priv(secp, &xprv);

        (xprv, xpub)
    }
}
