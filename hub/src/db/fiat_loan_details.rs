use crate::model::FiatLoanDetails;
use anyhow::Result;
use lendasat_core::IbanTransferDetails;
use lendasat_core::SwiftTransferDetails;
use sqlx::Postgres;

pub async fn insert_borrower<'a, E>(
    tx: E,
    contract_id: &str,
    fiat_loan_details: FiatLoanDetails,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let details = fiat_loan_details.details;
    let encrypted_encryption_key_borrower = fiat_loan_details.encrypted_encryption_key_borrower;
    let encrypted_encryption_key_lender = fiat_loan_details.encrypted_encryption_key_lender;

    let (iban, bic) = match details.iban_transfer_details {
        None => (None, None),
        Some(details) => (Some(details.iban), details.bic),
    };
    let (account_number, swift_or_bic) = match details.swift_transfer_details {
        None => (None, None),
        Some(details) => (Some(details.account_number), Some(details.swift_or_bic)),
    };

    sqlx::query!(
        r#"
            INSERT INTO fiat_loan_details_borrower (
                contract_id,
                iban,
                bic,
                account_number,
                swift_or_bic,
                bank_name,
                bank_address,
                bank_country,
                purpose_of_remittance,
                full_name,
                address,
                city,
                post_code,
                country,
                comments,
                encrypted_encryption_key_borrower,
                encrypted_encryption_key_lender
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        "#,
        contract_id,
        iban,
        bic,
        account_number,
        swift_or_bic,
        details.bank_name,
        details.bank_address,
        details.bank_country,
        details.purpose_of_remittance,
        details.full_name,
        details.address,
        details.city,
        details.post_code,
        details.country,
        details.comments as Option<String>,
        encrypted_encryption_key_borrower,
        encrypted_encryption_key_lender
    )
    .execute(tx)
    .await?;

    Ok(())
}

/// Get the [`FiatLoanDetails`] for the borrower in the contract identified by `contract_id`.
pub async fn get_borrower<'a, E>(tx: E, contract_id: &str) -> Result<Option<FiatLoanDetails>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let row = sqlx::query!(
        r#"
            SELECT
                id,
                contract_id,
                iban,
                bic,
                account_number,
                swift_or_bic,
                bank_name,
                bank_address,
                bank_country,
                purpose_of_remittance,
                full_name,
                address,
                city,
                post_code,
                country,
                comments,
                encrypted_encryption_key_borrower,
                encrypted_encryption_key_lender
            FROM fiat_loan_details_borrower
            WHERE contract_id = $1
        "#,
        contract_id
    )
    .fetch_optional(tx)
    .await?;

    let details = match row {
        Some(row) => {
            let iban_details = row
                .iban
                .map(|iban| IbanTransferDetails { iban, bic: row.bic });

            let swift_details = match (row.account_number, row.swift_or_bic) {
                (Some(account_number), Some(swift_or_bic)) => Some(SwiftTransferDetails {
                    account_number,
                    swift_or_bic,
                }),
                _ => None,
            };

            Some(FiatLoanDetails {
                details: lendasat_core::FiatLoanDetails {
                    iban_transfer_details: iban_details,
                    swift_transfer_details: swift_details,
                    bank_name: row.bank_name,
                    bank_address: row.bank_address,
                    bank_country: row.bank_country,
                    purpose_of_remittance: row.purpose_of_remittance,
                    full_name: row.full_name,
                    address: row.address,
                    city: row.city,
                    post_code: row.post_code,
                    country: row.country,
                    comments: row.comments,
                },
                encrypted_encryption_key_borrower: row.encrypted_encryption_key_borrower,
                encrypted_encryption_key_lender: row.encrypted_encryption_key_lender,
            })
        }
        None => None,
    };

    Ok(details)
}

pub async fn insert_lender<'a, E>(
    tx: E,
    contract_id: &str,
    fiat_loan_details: FiatLoanDetails,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let details = fiat_loan_details.details;
    let encrypted_encryption_key_borrower = fiat_loan_details.encrypted_encryption_key_borrower;
    let encrypted_encryption_key_lender = fiat_loan_details.encrypted_encryption_key_lender;

    let (iban, bic) = match details.iban_transfer_details {
        None => (None, None),
        Some(details) => (Some(details.iban), details.bic),
    };
    let (account_number, swift_or_bic) = match details.swift_transfer_details {
        None => (None, None),
        Some(details) => (Some(details.account_number), Some(details.swift_or_bic)),
    };

    sqlx::query!(
        r#"
            INSERT INTO fiat_loan_details_lender (
                contract_id,
                iban,
                bic,
                account_number,
                swift_or_bic,
                bank_name,
                bank_address,
                bank_country,
                purpose_of_remittance,
                full_name,
                address,
                city,
                post_code,
                country,
                comments,
                encrypted_encryption_key_borrower,
                encrypted_encryption_key_lender
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        "#,
        contract_id,
        iban,
        bic,
        account_number,
        swift_or_bic,
        details.bank_name,
        details.bank_address,
        details.bank_country,
        details.purpose_of_remittance,
        details.full_name,
        details.address,
        details.city,
        details.post_code,
        details.country,
        details.comments as Option<String>,
        encrypted_encryption_key_borrower,
        encrypted_encryption_key_lender
    )
    .execute(tx)
    .await?;

    Ok(())
}

/// Get the [`FiatLoanDetails`] for the lender in the contract identified by `contract_id`.
pub async fn get_lender<'a, E>(tx: E, contract_id: &str) -> Result<Option<FiatLoanDetails>>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let row = sqlx::query!(
        r#"
            SELECT
                id,
                contract_id,
                iban,
                bic,
                account_number,
                swift_or_bic,
                bank_name,
                bank_address,
                bank_country,
                purpose_of_remittance,
                full_name,
                address,
                city,
                post_code,
                country,
                comments,
                encrypted_encryption_key_borrower,
                encrypted_encryption_key_lender
            FROM fiat_loan_details_lender
            WHERE contract_id = $1
        "#,
        contract_id
    )
    .fetch_optional(tx)
    .await?;

    let details = match row {
        Some(row) => {
            let iban_transfer_details = row
                .iban
                .map(|iban| IbanTransferDetails { iban, bic: row.bic });

            let swift_transfer_details = match (row.account_number, row.swift_or_bic) {
                (Some(account_number), Some(swift_or_bic)) => Some(SwiftTransferDetails {
                    account_number,
                    swift_or_bic,
                }),
                _ => None,
            };

            Some(FiatLoanDetails {
                details: lendasat_core::FiatLoanDetails {
                    iban_transfer_details,
                    swift_transfer_details,
                    bank_name: row.bank_name,
                    bank_address: row.bank_address,
                    bank_country: row.bank_country,
                    purpose_of_remittance: row.purpose_of_remittance,
                    full_name: row.full_name,
                    address: row.address,
                    city: row.city,
                    post_code: row.post_code,
                    country: row.country,
                    comments: row.comments,
                },
                encrypted_encryption_key_borrower: row.encrypted_encryption_key_borrower,
                encrypted_encryption_key_lender: row.encrypted_encryption_key_lender,
            })
        }
        None => None,
    };

    Ok(details)
}
