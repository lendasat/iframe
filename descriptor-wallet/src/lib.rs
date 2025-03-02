use anyhow::Result;
use bdk::bitcoin::Network;
use bdk::descriptor::Descriptor;
use bdk::descriptor::DescriptorPublicKey;
use bdk::wallet::AddressInfo;
use bdk::wallet::ChangeSet;
use bdk::wallet::Wallet;
use bdk::KeychainKind;
use std::str::FromStr;

pub struct DescriptorWallet {
    wallet: Wallet,
}

impl DescriptorWallet {
    // We are dealing here with &str only because we don't want to care about using differently
    // versioned bitcoin dependencies
    pub fn new(descriptor: &str, db_path: &str, network: &str) -> Result<Self> {
        let descriptor = Descriptor::<DescriptorPublicKey>::from_str(descriptor)?;

        let network = Network::from_str(network)?;

        let db =
            bdk_file_store::Store::<ChangeSet>::open_or_create_new(b"hub_fee_wallet", db_path)?;

        let wallet = Wallet::new_or_load(descriptor, None, db, network)?;

        Ok(Self { wallet })
    }

    pub fn get_new_address(&mut self) -> Result<AddressInfo> {
        self.wallet.reveal_next_address(KeychainKind::Internal)
    }
}

#[cfg(test)]
pub mod tests {
    use crate::DescriptorWallet;
    use bdk::bitcoin::Address;
    use std::str::FromStr;

    #[test]
    pub fn test_wallet() {
        use temp_dir::TempDir;
        let d = TempDir::new().expect("to exist");
        let path = d.path();
        let string = path.to_str().map(|s| s.to_string()).expect("to work");
        let db_path = format!("{}/test.db", string);

        let descriptor = "wpkh([2e8978e5/84h/1h/0h]tpubDDMuC8nQpQtPV3Q7BTdempTBYG3tZ5McJRwTVYDXVPR7oiUxTR5DjKKB1aa4yi5C74DK4R8Z4WRHt8GAy5WkVUTksUZbDoLEEgoz2aaZXU7/0/*)#eara5f0t";
        let mut wallet = DescriptorWallet::new(descriptor, db_path.as_str(), "signet")
            .expect("to be a valid wallet");

        let address_info = wallet
            .get_new_address()
            .expect("to be able to get an address");

        let expected = Address::from_str("tb1quw75h0w26rcrdfar6knvkfazpwyzq4z8vqmt37")
            .expect("to be unchecked")
            .assume_checked();

        assert_eq!(expected.to_string(), address_info.address.to_string());

        let address_info = wallet
            .get_new_address()
            .expect("to be able to get an address");

        let expected = Address::from_str("tb1q25qrvtqlw5teev66eh29mtr96zqeh67ncrztht")
            .expect("to be unchecked")
            .assume_checked();

        assert_eq!(expected.to_string(), address_info.address.to_string());
    }
}
