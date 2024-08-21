use argon2::Argon2;
use argon2::PasswordHash;
use argon2::PasswordVerifier;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use sqlx::FromRow;
use time::OffsetDateTime;

#[derive(Debug, Deserialize, sqlx::FromRow, Serialize, Clone)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub password: String,
    pub verified: bool,
    pub verification_code: Option<String>,
    pub password_reset_token: Option<String>,
    #[serde(with = "time::serde::rfc3339::option")]
    pub password_reset_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl User {
    pub fn check_password(&self, provided_password: &str) -> bool {
        match PasswordHash::new(&self.password) {
            Ok(parsed_hash) => Argon2::default()
                .verify_password(provided_password.as_bytes(), &parsed_hash)
                .map_or(false, |_| true),
            Err(_) => false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub user_id: String,
    // Token creation timestamp. Needs to be called this way due to JWT
    pub iat: i64,
    // Token expiry timestamp. Needs to be called this way due to JWT
    pub exp: i64,
}

#[derive(Debug, Deserialize)]
pub struct RegisterUserSchema {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct LoginUserSchema {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ForgotPasswordSchema {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordSchema {
    pub password: String,
    #[serde(rename = "passwordConfirm")]
    pub password_confirm: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateLoanOfferSchema {
    pub name: String,
    pub min_ltv: Decimal,
    pub interest_rate: Decimal,
    pub loan_amount_min: Decimal,
    pub loan_amount_max: Decimal,
    pub duration_months_min: i32,
    pub duration_months_max: i32,
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
}

#[derive(Debug, Deserialize)]
pub struct ContractRequestSchema {
    pub loan_id: String,
    pub initial_ltv: Decimal,
    pub loan_amount: Decimal,
    pub initial_collateral_sats: u64,
    pub duration_months: i32,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct LoanOffer {
    pub id: String,
    pub lender_id: String,
    pub name: String,
    pub min_ltv: Decimal,
    pub interest_rate: Decimal,
    pub loan_amount_min: Decimal,
    pub loan_amount_max: Decimal,
    pub duration_months_min: i32,
    pub duration_months_max: i32,
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
    pub status: LoanOfferStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize)]
#[sqlx(type_name = "loan_asset_type")]
pub enum LoanAssetType {
    Usdc,
    Usdt,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize)]
#[sqlx(type_name = "loan_asset_chain")]
pub enum LoanAssetChain {
    Ethereum,
    Starknet,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize)]
#[sqlx(type_name = "loan_offer_status")]
pub enum LoanOfferStatus {
    Available,
    Unavailable,
    Deleted,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct Contract {
    pub id: String,
    pub lender_id: String,
    pub borrower_id: String,
    pub loan_id: String,
    pub initial_ltv: Decimal,
    pub initial_collateral_sats: u64,
    pub loan_amount: Decimal,
    pub duration_months: i32,
    pub status: ContractStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize)]
#[sqlx(type_name = "contract_status")]
pub enum ContractStatus {
    Open,
    Closed,
    Requested,
    Rejected,
}
