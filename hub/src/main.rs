use crate::config::Config;
use crate::db::connect_to_db;
use crate::db::run_migration;
use crate::db::sample_query;
use crate::logger::init_tracing;
use anyhow::Result;
use axum::Router;
use sqlx::Pool;
use sqlx::Postgres;
use std::sync::Arc;
use tracing::level_filters::LevelFilter;

mod config;
mod db;
mod email;
mod logger;
mod model;
mod routes;

pub struct AppState {
    db: Pool<Postgres>,
    config: Config,
}

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false, true).expect("to work");
    tracing::info!("Hello World");

    let config = Config::init();
    let listen_address = config.listen_address.clone();
    let frontend_origin = config.frontend_origin.clone();

    let pool = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&pool).await?;
    sample_query(&pool).await?;

    let app_state = Arc::new(AppState { db: pool, config });

    let app = Router::new()
        .merge(routes::health_check::router())
        .merge(routes::auth::router(app_state.clone()))
        .merge(routes::loans::router(app_state.clone()))
        .merge(routes::frontend::router());

    tracing::info!("start listening http://{}", frontend_origin);
    let listener = tokio::net::TcpListener::bind(listen_address).await.unwrap();
    axum::serve(listener, app).await.unwrap();
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::logger::init_tracing_for_test;
    use bdk_wallet::bitcoin::Network;
    use bdk_wallet::descriptor;
    use bdk_wallet::keys::DerivableKey;
    use bdk_wallet::keys::DescriptorKey;
    use bdk_wallet::keys::IntoDescriptorKey;
    use bdk_wallet::keys::ValidNetworks;
    use bdk_wallet::miniscript::descriptor::DescriptorPublicKey;
    use bdk_wallet::miniscript::descriptor::KeyMap;
    use bdk_wallet::miniscript::Descriptor;
    use bdk_wallet::miniscript::Segwitv0;
    use bdk_wallet::KeychainKind;
    use bdk_wallet::SignOptions;
    use bdk_wallet::Wallet;
    use bitcoin::absolute;
    use bitcoin::bip32;
    use bitcoin::bip32::DerivationPath;
    use bitcoin::bip32::Xpriv;
    use bitcoin::bip32::Xpub;
    use bitcoin::secp256k1::All;
    use bitcoin::secp256k1::Secp256k1;
    use bitcoin::secp256k1::SecretKey;
    use bitcoin::transaction::Version;
    use bitcoin::Amount;
    use bitcoin::OutPoint;
    use bitcoin::Psbt;
    use bitcoin::ScriptBuf;
    use bitcoin::Sequence;
    use bitcoin::Transaction;
    use bitcoin::TxIn;
    use bitcoin::TxOut;
    use bitcoin::Witness;
    use std::str::FromStr;

    const HUB_SK: &str = "0000000000000000000000000000000000000000000000000000000000000001";
    const BORROWER_SK: &str = "0000000000000000000000000000000000000000000000000000000000000002";
    const FALLBACK_SK: &str = "0000000000000000000000000000000000000000000000000000000000000003";

    const EXTERNAL_DERIVATION_PATH: &str = "m/84/1/0/0";
    const INTERNAL_DERIVATION_PATH: &str = "m/84/1/0/1";

    #[test]
    fn verify_that_we_can_spend_2_of_3() {
        init_tracing_for_test();

        let network = Network::Testnet;
        let secp = Secp256k1::new();

        // 1. Create keys and wallets

        let hub_sk = SecretKey::from_str(HUB_SK).unwrap();
        let borrower_sk = SecretKey::from_str(BORROWER_SK).unwrap();
        let fallback_sk = SecretKey::from_str(FALLBACK_SK).unwrap();

        let (hub_xprv, hub_xpub) = create_xprv_xpub(network, &secp, hub_sk);
        let (borrower_xprv, borrower_xpub) = create_xprv_xpub(network, &secp, borrower_sk);
        let (fallback_xprv, fallback_xpub) = create_xprv_xpub(network, &secp, fallback_sk);

        let mut hub_wallet = create_wallet(hub_xprv, borrower_xpub, fallback_xpub, network);
        let borrower_wallet = create_wallet(hub_xpub, borrower_xprv, fallback_xpub, network);
        let fallback_wallet = create_wallet(hub_xpub, borrower_xpub, fallback_xprv, network);

        let collateral_address_info = hub_wallet.reveal_next_address(KeychainKind::External);

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

        // 3. Build reclaim-collateral TX

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

        // 4. Sign reclaim-collateral TX with 2 parties at a time.

        sign_and_verify_spend_tx(
            &hub_wallet,
            &borrower_wallet,
            fund_tx.clone(),
            &collateral_spk,
            collateral_amount,
            unsigned_reclaim_collateral_tx.clone(),
        );

        sign_and_verify_spend_tx(
            &hub_wallet,
            &fallback_wallet,
            fund_tx.clone(),
            &collateral_spk,
            collateral_amount,
            unsigned_reclaim_collateral_tx.clone(),
        );

        sign_and_verify_spend_tx(
            &fallback_wallet,
            &borrower_wallet,
            fund_tx.clone(),
            &collateral_spk,
            collateral_amount,
            unsigned_reclaim_collateral_tx.clone(),
        );
    }

    fn sign_and_verify_spend_tx(
        wallet_0: &Wallet,
        wallet_1: &Wallet,
        spent_tx: Transaction,
        spent_output_spk: &ScriptBuf,
        spent_output_amount: Amount,
        unsigned_spend_tx: Transaction,
    ) {
        let mut spend_tx_psbt = Psbt::from_unsigned_tx(unsigned_spend_tx).unwrap();

        spend_tx_psbt.inputs[0].non_witness_utxo = Some(spent_tx);

        let finalized = wallet_0
            .sign(&mut spend_tx_psbt, SignOptions::default())
            .unwrap();

        assert!(!finalized);

        let finalized = wallet_1
            .sign(&mut spend_tx_psbt, SignOptions::default())
            .unwrap();

        assert!(finalized);

        let spend_tx = spend_tx_psbt
            .extract_tx()
            .expect("signed reclaim collateral TX");

        spent_output_spk
            .verify(
                0, // Always zero since the spend TX only has one input.
                spent_output_amount,
                bitcoin::consensus::serialize(&spend_tx).as_slice(),
            )
            .expect("can spend collateral output");
    }

    fn create_wallet(
        hub: impl DerivableKey<Segwitv0> + Copy,
        borrower: impl DerivableKey<Segwitv0> + Copy,
        fallback: impl DerivableKey<Segwitv0> + Copy,
        network: Network,
    ) -> Wallet {
        let external_desc = {
            let path = external_derivation_path();

            let hub = (hub, path.clone()).into_descriptor_key().unwrap();
            let borrower = (borrower, path.clone()).into_descriptor_key().unwrap();
            let fallback = (fallback, path).into_descriptor_key().unwrap();

            create_multisig_descriptor(hub, borrower, fallback)
        };

        // TODO: Do we need a _multisig_ change descriptor?
        let internal_desc = {
            let path = internal_derivation_path();

            let hub = (hub, path.clone()).into_descriptor_key().unwrap();
            let borrower = (borrower, path.clone()).into_descriptor_key().unwrap();
            let fallback = (fallback, path).into_descriptor_key().unwrap();

            create_multisig_descriptor(hub, borrower, fallback)
        };

        Wallet::create(external_desc, internal_desc)
            .network(network)
            .create_wallet_no_persist()
            .expect("wallet")
    }

    fn create_multisig_descriptor(
        hub: DescriptorKey<Segwitv0>,
        borrower: DescriptorKey<Segwitv0>,
        fallback: DescriptorKey<Segwitv0>,
    ) -> (Descriptor<DescriptorPublicKey>, KeyMap, ValidNetworks) {
        descriptor!(wsh(sortedmulti(2, hub, borrower, fallback))).unwrap()
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
