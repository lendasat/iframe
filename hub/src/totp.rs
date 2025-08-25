use totp_rs::Algorithm as TotpAlgorithm;
use totp_rs::Secret;
use totp_rs::TOTP;

const ISSUER_NAME_BORROWER: &str = "Lendasat-Borrower";
const ISSUER_NAME_LENDER: &str = "Lendasat-Lender";

/// Creates a TOTP instance with the standard configuration for this application
pub fn create_totp_borrower(secret: Secret, account_name: String) -> anyhow::Result<TOTP> {
    create_totp(secret, account_name, ISSUER_NAME_BORROWER)
}

/// Creates a TOTP instance with the standard configuration for this application
pub fn create_totp_lender(secret: Secret, account_name: String) -> anyhow::Result<TOTP> {
    create_totp(secret, account_name, ISSUER_NAME_LENDER)
}

fn create_totp(secret: Secret, account_name: String, issuer_name: &str) -> anyhow::Result<TOTP> {
    let totp = TOTP::new(
        TotpAlgorithm::SHA1,
        6,
        1,
        30,
        secret.to_bytes().expect("to be valid bytes"),
        Some(issuer_name.to_string()),
        account_name,
    )?;

    Ok(totp)
}
