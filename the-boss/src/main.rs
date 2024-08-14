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

    use bdk_wallet::keys::{DescriptorKey, IntoDescriptorKey, ValidNetworks};
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

    const THE_BOSS_SK: &'static str =
        "0000000000000000000000000000000000000000000000000000000000000001";
    const BORROWER_SK: &'static str =
        "0000000000000000000000000000000000000000000000000000000000000002";
    const FALLBACK_SK: &'static str =
        "0000000000000000000000000000000000000000000000000000000000000003";

    #[test]
    fn test_simple_multisig() {
        let network = Network::Testnet;
        let secp = Secp256k1::new();

        // 1. create keys
        let the_boss_sk = SecretKey::from_str(THE_BOSS_SK).unwrap();
        let borrower_sk = SecretKey::from_str(BORROWER_SK).unwrap();
        let fallback_sk = SecretKey::from_str(FALLBACK_SK).unwrap();

        let (the_boss_xprv, _the_boss_xpub) = create_xpub_xprv(network, &secp, the_boss_sk);
        let (_borrower_xprv, borrower_xpub) = create_xpub_xprv(network, &secp, borrower_sk);
        let (_fallback_xprv, fallback_xpub) = create_xpub_xprv(network, &secp, fallback_sk);

        let receive_path = bip32::DerivationPath::from_str("m/84/1/0/0").unwrap();
        let receive_desc = create_multisig_descriptor(
            the_boss_xprv,
            borrower_xpub,
            fallback_xpub,
            receive_path.clone(),
        );

        let change_path = bip32::DerivationPath::from_str("m/84/1/0/1").unwrap();
        let change_desc =
            create_multisig_descriptor(the_boss_xprv, borrower_xpub, fallback_xpub, change_path);

        let network = Network::Testnet;
        let mut wallet = Wallet::create(receive_desc, change_desc)
            .network(network)
            .create_wallet_no_persist()
            .expect("wallet");

        let address_info = wallet.reveal_next_address(KeychainKind::External);
        println!("Receive address: {}", address_info.address);
        assert_eq!(
            "tb1q90dn08cdsy0fnppc273n7n6w4np83397z9xf8pjlns2q6ar97l6srcjx92",
            address_info.address.to_string()
        );

        // setup funding tx

        let collateral_amount = Amount::ONE_BTC;
        let collateral_output = TxOut {
            value: collateral_amount,
            script_pubkey: address_info.script_pubkey(),
        };

        let fund_tx = Transaction {
            version: Version::TWO,
            lock_time: absolute::LockTime::ZERO,
            input: Vec::new(), // TODO: Might need inputs?
            output: vec![collateral_output],
        };

        let collateral_input = TxIn {
            previous_output: OutPoint {
                txid: fund_tx.compute_txid(),
                vout: 0,
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
            witness: Witness::new(),
        };

        let _descriptor_key: DescriptorKey<Segwitv0> =
            (borrower_xpub, receive_path).into_descriptor_key().unwrap();

        let fee = Amount::from_sat(1_000);
        let reclaim_collateral_output = TxOut {
            value: Amount::ONE_BTC - fee,
            // TODO: fixme, use borrowers xpub to derive key
            script_pubkey: ScriptBuf::new(),
        };

        let reclaim_collateral_tx = Transaction {
            version: Version::TWO,
            lock_time: absolute::LockTime::ZERO,
            input: vec![collateral_input],
            output: vec![reclaim_collateral_output],
        };

        let mut reclaim_collateral_tx_psbt = Psbt::from_unsigned_tx(reclaim_collateral_tx).unwrap();

        wallet
            .sign(&mut reclaim_collateral_tx_psbt, SignOptions::default())
            .unwrap();
    }

    fn create_multisig_descriptor(
        the_boss_xprv: Xpriv,
        borrower_xpub: Xpub,
        fallback_xpub: Xpub,
        derivation_path: DerivationPath,
    ) -> (Descriptor<DescriptorPublicKey>, KeyMap, ValidNetworks) {
        let receive_path = derivation_path;
        let the_boss_receive_desc = (the_boss_xprv, receive_path.clone())
            .into_descriptor_key()
            .unwrap();
        let borrower_receive_desc = (borrower_xpub, receive_path.clone())
            .into_descriptor_key()
            .unwrap();
        let fallback_receive_desc = (fallback_xpub, receive_path.clone())
            .into_descriptor_key()
            .unwrap();

        let receive_desc = descriptor!(wsh(sortedmulti(
            2,
            the_boss_receive_desc,
            borrower_receive_desc,
            fallback_receive_desc
        )))
        .unwrap();
        receive_desc
    }

    fn create_xpub_xprv(
        network: Network,
        secp: &Secp256k1<All>,
        secret_key: SecretKey,
    ) -> (Xpriv, Xpub) {
        let xprv = Xpriv::new_master(network, secret_key.as_ref()).unwrap();
        let xpub = Xpub::from_priv(&secp, &xprv);

        (xprv, xpub)
    }
}
