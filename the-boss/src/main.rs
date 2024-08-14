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
    use anyhow::Result;
    use bdk::bitcoin::absolute;
    use bdk::bitcoin::bip32::ExtendedPrivKey;
    use bdk::bitcoin::key::KeyPair;
    use bdk::bitcoin::key::Secp256k1;
    use bdk::bitcoin::psbt::Psbt;
    use bdk::bitcoin::secp256k1::rand::thread_rng;
    use bdk::bitcoin::Amount;
    use bdk::bitcoin::Network;
    use bdk::bitcoin::OutPoint;
    use bdk::bitcoin::PublicKey;
    use bdk::bitcoin::ScriptBuf;
    use bdk::bitcoin::Sequence;
    use bdk::bitcoin::Transaction;
    use bdk::bitcoin::TxIn;
    use bdk::bitcoin::TxOut;
    use bdk::bitcoin::Witness;
    use bdk::database::MemoryDatabase;
    use bdk::miniscript::Descriptor;
    use bdk::template::Bip84;
    use bdk::KeychainKind;
    use bdk::SignOptions;
    use bdk::Wallet;
    use bitcoin::consensus::verify_script;
    use bitcoin::Script;

    #[test]
    fn two_of_three_multisig() {
        let network = Network::Testnet;
        let secp = Secp256k1::new();
        let mut rng = thread_rng();

        let the_boss_kp = KeyPair::new(&secp, &mut rng);
        let borrower_kp = KeyPair::new(&secp, &mut rng);
        let fallback_kp = KeyPair::new(&secp, &mut rng);

        // Generated using this policy: `thresh(2,pk(the_boss),pk(borrower),pk(fallback))`.
        let descriptor = format!(
            "multi(2,{the_boss},{borrower},{fallback})",
            the_boss = the_boss_kp.public_key(),
            borrower = borrower_kp.public_key(),
            fallback = fallback_kp.public_key()
        );
        let collateral_descriptor: Descriptor<PublicKey> = descriptor.parse().unwrap();

        let collateral_amount_sat = Amount::ONE_BTC.to_sat();
        let collateral_output = TxOut {
            value: collateral_amount_sat,
            script_pubkey: collateral_descriptor.script_pubkey(),
        };

        let fund_tx = Transaction {
            version: 2,
            lock_time: absolute::LockTime::ZERO,
            input: Vec::new(), // TODO: Might need inputs?
            output: vec![collateral_output],
        };

        let collateral_input = TxIn {
            previous_output: OutPoint {
                txid: fund_tx.txid(),
                vout: 0,
            },
            script_sig: ScriptBuf::new(),
            sequence: Sequence::ENABLE_RBF_NO_LOCKTIME,
            witness: Witness::new(),
        };

        let descriptor = format!("pk({borrower})", borrower = borrower_kp.public_key(),);
        let descriptor: Descriptor<PublicKey> = descriptor.parse().unwrap();
        let fee = Amount::from_sat(1_000);
        let reclaim_collateral_output = TxOut {
            value: Amount::ONE_BTC.to_sat() - fee.to_sat(),
            script_pubkey: descriptor.script_pubkey(),
        };
        let reclaim_collateral_tx = Transaction {
            version: 2,
            lock_time: absolute::LockTime::ZERO,
            input: vec![collateral_input],
            output: vec![reclaim_collateral_output],
        };

        let borrower_wallet = create_wallet(network, borrower_kp.secret_key().as_ref()).unwrap();
        let the_boss_wallet = create_wallet(network, the_boss_kp.secret_key().as_ref()).unwrap();

        let mut reclaim_collateral_tx_psbt = Psbt::from_unsigned_tx(reclaim_collateral_tx).unwrap();

        let _ = borrower_wallet
            .sign(&mut reclaim_collateral_tx_psbt, SignOptions::default())
            .unwrap();
        let finalized = the_boss_wallet
            .sign(&mut reclaim_collateral_tx_psbt, SignOptions::default())
            .unwrap();
        assert!(finalized);

        // TODO: Check that we can spend the multisig output with 2 keys.
        let collateral_descriptor_script = collateral_descriptor.script_pubkey();
        let collateral_descriptor_script = collateral_descriptor_script.as_script();
        verify_script(
            Script::from_bytes(collateral_descriptor_script.as_bytes()),
            0,
            bitcoin_units::Amount::from_sat(collateral_amount_sat),
            reclaim_collateral_tx_psbt.serialize().as_slice(),
        )
        .unwrap();
    }

    fn create_wallet(network: Network, priv_key: &[u8]) -> Result<Wallet<MemoryDatabase>> {
        let xprv = ExtendedPrivKey::new_master(network, priv_key)?;
        let wallet = Wallet::new(
            Bip84(xprv, KeychainKind::External),
            Some(Bip84(xprv, KeychainKind::Internal)),
            network,
            MemoryDatabase::default(),
        )?;
        Ok(wallet)
    }
}
