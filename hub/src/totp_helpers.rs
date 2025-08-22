use totp_rs::Algorithm as TotpAlgorithm;
use totp_rs::Secret;
use totp_rs::TOTP;

const ISSUER_NAME: &str = "Lendasat-Borrower";

/// Creates a TOTP instance with the standard configuration for this application
pub fn create_totp(secret: Secret, account_name: String) -> anyhow::Result<TOTP> {
    let totp = TOTP::new(
        TotpAlgorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().expect("to be valid bytes"),
        Some(ISSUER_NAME.to_string()),
        account_name,
    )?;

    Ok(totp)
}
