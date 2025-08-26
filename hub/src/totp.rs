use totp_rs::Algorithm as TotpAlgorithm;
use totp_rs::Secret;
use totp_rs::TOTP;

const ISSUER_NAME_BORROWER: &str = "Lendasat-Borrower";
const ISSUER_NAME_LENDER: &str = "Lendasat-Lender";

pub(crate) const TOTP_TMP_ID_PREFIX: &str = "totp_pending_";

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

pub fn stripped_user_id(user_id_with_prefix: &str) -> Option<&str> {
    let stripped = user_id_with_prefix.strip_prefix(TOTP_TMP_ID_PREFIX)?;
    let stripped = stripped.trim();
    if stripped.is_empty() {
        None
    } else {
        Some(stripped)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_user_id_partial_prefix() {
        let input = TOTP_TMP_ID_PREFIX;
        let result = stripped_user_id(input);
        assert_eq!(result, None);
    }

    #[test]
    fn test_user_id_empty_string() {
        let id = Uuid::new_v4();
        let input = format!("{id}");
        let result = stripped_user_id(input.as_str());
        assert_eq!(result, None);
    }

    #[test]
    fn test_user_id_with_underscores_in_suffix() {
        let id = Uuid::new_v4();
        let input = format!("{TOTP_TMP_ID_PREFIX}{id}");
        let result = stripped_user_id(input.as_str());
        assert_eq!(result, Some(id.to_string().as_str()));
    }
}
