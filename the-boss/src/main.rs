fn main() {
    println!("Hello, world!");
}

#[cfg(test)]
mod tests {

    use bdk::bitcoin::absolute;
    use bdk::bitcoin::key::KeyPair;
    use bdk::bitcoin::key::Secp256k1;
    use bdk::bitcoin::secp256k1::rand::thread_rng;
    use bdk::bitcoin::Amount;
    use bdk::bitcoin::PublicKey;
    use bdk::bitcoin::Script;
    use bdk::bitcoin::ScriptBuf;
    use bdk::bitcoin::Transaction;
    use bdk::bitcoin::TxIn;
    use bdk::bitcoin::TxOut;
    use bdk::miniscript::Descriptor;
    use bitcoin::consensus::verify_script;

    #[test]
    fn two_of_three_multisig() {
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

        let collateral_amount = Amount::ONE_BTC.to_sat();
        let collateral_output = TxOut {
            value: collateral_amount,
            script_pubkey: collateral_descriptor.script_pubkey(),
        };

        let fund_tx = Transaction {
            version: 2,
            lock_time: absolute::LockTime::ZERO,
            input: Vec::new(), // TODO: Might need inputs?
            output: vec![collateral_output],
        };

        // TODO: Build collateral input for `reclaim_collateral_tx`.
        let script = collateral_descriptor.explicit_script().unwrap();
        let collateral_input = TxIn {
            previous_output: todo!(),
            script_sig: todo!(),
            sequence: todo!(),
            witness: todo!(),
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

        // TODO: Check that we can spend the multisig output with 2 keys.
        verify_script(todo!(), todo!(), todo!(), todo!());
    }
}
