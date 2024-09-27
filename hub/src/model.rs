use argon2::Argon2;
use argon2::PasswordHash;
use argon2::PasswordVerifier;
use bitcoin::address::NetworkUnchecked;
use bitcoin::Address;
use bitcoin::PublicKey;
use bitcoin::Txid;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use sqlx::FromRow;
use std::str::FromStr;
use time::OffsetDateTime;

#[derive(Debug, sqlx::FromRow)]
pub struct InviteCode {
    pub id: i32,
    pub code: String,
    pub active: bool,
}

#[derive(Debug, Deserialize, sqlx::FromRow, Serialize, Clone)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub password: String,
    pub verified: bool,
    pub verification_code: Option<String>,
    pub invite_code: Option<i32>,
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
    #[serde(deserialize_with = "empty_string_is_none")]
    pub invite_code: Option<String>,
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

#[derive(Debug, Deserialize, Serialize)]
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
    pub loan_repayment_address: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ContractRequestSchema {
    pub loan_id: String,
    pub loan_amount: Decimal,
    pub duration_months: i32,
    pub borrower_btc_address: Address<NetworkUnchecked>,
    pub borrower_pk: PublicKey,
    pub borrower_loan_address: String,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
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
    pub loan_repayment_address: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone)]
#[sqlx(type_name = "loan_asset_type")]
pub enum LoanAssetType {
    Usdc,
    Usdt,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone)]
#[sqlx(type_name = "loan_asset_chain")]
pub enum LoanAssetChain {
    Ethereum,
    Starknet,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone)]
#[sqlx(type_name = "loan_offer_status")]
pub enum LoanOfferStatus {
    Available,
    Unavailable,
    Deleted,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Contract {
    pub id: String,
    pub lender_id: String,
    pub borrower_id: String,
    pub loan_id: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub initial_ltv: Decimal,
    /// The minimum amount of collateral the borrower is expected to send to set up a loan.
    ///
    /// FIXME: This does not include the origination fee! Some logic must use the origination fee!
    ///
    /// This value is only relevant before the loan has been established and must not be used again
    /// afterwards. You almost certainly want to use `collateral_sats` instead.
    pub initial_collateral_sats: u64,
    pub origination_fee_sats: u64,
    /// The current amount of confirmed collateral in the loan contract.
    ///
    /// We have decided to not persist the collateral outputs to make the implementation simpler.
    /// This may come back to bite us.
    pub collateral_sats: u64,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_months: i32,
    pub borrower_btc_address: Address<NetworkUnchecked>,
    pub borrower_pk: PublicKey,
    pub borrower_loan_address: String,
    pub contract_address: Option<Address<NetworkUnchecked>>,
    pub contract_index: Option<u32>,
    pub claim_txid: Option<Txid>,
    pub status: ContractStatus,
    pub liquidation_status: LiquidationStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
pub enum ContractStatus {
    /// The borrower has sent a contract request based on a loan offer.
    Requested,
    /// The lender has accepted the contract request.
    Approved,
    /// The collateral contract has been seen on the blockchain.
    CollateralSeen,
    /// The collateral contract has received enough confirmations.
    CollateralConfirmed,
    /// The principal has been given to the borrower.
    PrincipalGiven,
    /// The principal + interest has been repaid to the lender.
    Repaid,
    /// The collateral claim tx has been broadcasted but not confirmed yet.
    Closing,
    /// The loan has been repaid, somehow.
    Closed,
    /// The contract request was rejected by the lender.
    Rejected,
    /// A dispute has been started by the borrower
    DisputeBorrowerStarted,
    /// A dispute has been started by the lender
    DisputeLenderStarted,
    /// The dispute has been resolved by the borrower
    DisputeBorrowerResolved,
    /// The dispute has been resolved by the lender
    DisputeLenderResolved,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
pub enum LiquidationStatus {
    /// Contract is in a healthy state
    Healthy,
    /// Contract got liquidated
    Liquidated,
    /// Second margin call: the user still has time to add more collateral before getting
    /// liquidated
    SecondMarginCall,
    /// First margin call: the user still has time to add more collateral before getting liquidated
    FirstMarginCall,
}

pub mod db {
    use rust_decimal::Decimal;
    use serde::Deserialize;
    use serde::Serialize;
    use sqlx::FromRow;
    use time::OffsetDateTime;

    #[derive(Debug, FromRow, Serialize, Deserialize)]
    pub struct Contract {
        pub id: String,
        pub lender_id: String,
        pub borrower_id: String,
        pub loan_id: String,
        pub initial_ltv: Decimal,
        pub initial_collateral_sats: i64,
        pub origination_fee_sats: i64,
        pub collateral_sats: i64,
        pub loan_amount: Decimal,
        pub duration_months: i32,
        pub borrower_btc_address: String,
        pub borrower_pk: String,
        pub borrower_loan_address: String,
        pub contract_address: Option<String>,
        pub contract_index: Option<i32>,
        pub claim_txid: Option<String>,
        pub status: ContractStatus,
        pub liquidation_status: LiquidationStatus,
        #[serde(with = "time::serde::rfc3339")]
        pub created_at: OffsetDateTime,
        #[serde(with = "time::serde::rfc3339")]
        pub updated_at: OffsetDateTime,
    }

    #[derive(Debug, Deserialize, sqlx::Type, Serialize)]
    #[sqlx(type_name = "contract_status")]
    pub enum ContractStatus {
        Requested,
        Approved,
        CollateralSeen,
        CollateralConfirmed,
        PrincipalGiven,
        Repaid,
        Closing,
        Closed,
        Rejected,
        DisputeBorrowerStarted,
        DisputeLenderStarted,
        DisputeBorrowerResolved,
        DisputeLenderResolved,
    }

    #[derive(Debug, Deserialize, sqlx::Type, Serialize)]
    #[sqlx(type_name = "liquidation_status")]
    pub enum LiquidationStatus {
        Healthy,
        FirstMarginCall,
        SecondMarginCall,
        Liquidated,
    }
}

impl From<db::Contract> for Contract {
    fn from(value: db::Contract) -> Self {
        Self {
            id: value.id,
            lender_id: value.lender_id,
            borrower_id: value.borrower_id,
            loan_id: value.loan_id,
            initial_ltv: value.initial_ltv,
            initial_collateral_sats: value.initial_collateral_sats as u64,
            origination_fee_sats: value.origination_fee_sats as u64,
            collateral_sats: value.collateral_sats as u64,
            loan_amount: value.loan_amount,
            duration_months: value.duration_months,
            borrower_btc_address: Address::from_str(&value.borrower_btc_address)
                .expect("valid address"),
            borrower_pk: PublicKey::from_str(&value.borrower_pk).expect("valid pk"),
            borrower_loan_address: value.borrower_loan_address,
            contract_address: value
                .contract_address
                .map(|addr| addr.parse().expect("valid address")),
            contract_index: value.contract_index.map(|i| i as u32),
            claim_txid: value.claim_txid.map(|t| t.parse().expect("valid txid")),
            status: value.status.into(),
            liquidation_status: value.liquidation_status.into(),
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<db::ContractStatus> for ContractStatus {
    fn from(value: db::ContractStatus) -> Self {
        match value {
            db::ContractStatus::Requested => Self::Requested,
            db::ContractStatus::Approved => Self::Approved,
            db::ContractStatus::CollateralSeen => Self::CollateralSeen,
            db::ContractStatus::CollateralConfirmed => Self::CollateralConfirmed,
            db::ContractStatus::PrincipalGiven => Self::PrincipalGiven,
            db::ContractStatus::Repaid => Self::Repaid,
            db::ContractStatus::Closing => Self::Closing,
            db::ContractStatus::Closed => Self::Closed,
            db::ContractStatus::Rejected => Self::Rejected,
            db::ContractStatus::DisputeBorrowerStarted => Self::DisputeBorrowerStarted,
            db::ContractStatus::DisputeLenderStarted => Self::DisputeLenderStarted,
            db::ContractStatus::DisputeBorrowerResolved => Self::DisputeBorrowerResolved,
            db::ContractStatus::DisputeLenderResolved => Self::DisputeLenderResolved,
        }
    }
}

impl From<db::LiquidationStatus> for LiquidationStatus {
    fn from(value: db::LiquidationStatus) -> Self {
        match value {
            db::LiquidationStatus::Healthy => Self::Healthy,
            db::LiquidationStatus::FirstMarginCall => Self::FirstMarginCall,
            db::LiquidationStatus::SecondMarginCall => Self::SecondMarginCall,
            db::LiquidationStatus::Liquidated => Self::Liquidated,
        }
    }
}

impl From<Contract> for db::Contract {
    fn from(value: Contract) -> Self {
        Self {
            id: value.id,
            lender_id: value.lender_id,
            borrower_id: value.borrower_id,
            loan_id: value.loan_id,
            initial_ltv: value.initial_ltv,
            initial_collateral_sats: value.initial_collateral_sats as i64,
            origination_fee_sats: value.origination_fee_sats as i64,
            collateral_sats: value.collateral_sats as i64,
            loan_amount: value.loan_amount,
            duration_months: value.duration_months,
            borrower_btc_address: value.borrower_btc_address.assume_checked().to_string(),
            borrower_pk: value.borrower_pk.to_string(),
            borrower_loan_address: value.borrower_loan_address,
            contract_address: value
                .contract_address
                .map(|addr| addr.assume_checked().to_string()),
            contract_index: value.contract_index.map(|i| i as i32),
            claim_txid: value.claim_txid.map(|t| t.to_string()),
            status: value.status.into(),
            liquidation_status: value.liquidation_status.into(),
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<ContractStatus> for db::ContractStatus {
    fn from(value: ContractStatus) -> Self {
        match value {
            ContractStatus::Requested => Self::Requested,
            ContractStatus::Approved => Self::Approved,
            ContractStatus::CollateralSeen => Self::CollateralSeen,
            ContractStatus::CollateralConfirmed => Self::CollateralConfirmed,
            ContractStatus::PrincipalGiven => Self::PrincipalGiven,
            ContractStatus::Repaid => Self::Repaid,
            ContractStatus::Closing => Self::Closing,
            ContractStatus::Closed => Self::Closed,
            ContractStatus::Rejected => Self::Rejected,
            ContractStatus::DisputeBorrowerStarted => Self::DisputeBorrowerStarted,
            ContractStatus::DisputeLenderStarted => Self::DisputeLenderStarted,
            ContractStatus::DisputeBorrowerResolved => Self::DisputeBorrowerResolved,
            ContractStatus::DisputeLenderResolved => Self::DisputeLenderResolved,
        }
    }
}

impl From<LiquidationStatus> for db::LiquidationStatus {
    fn from(value: LiquidationStatus) -> Self {
        match value {
            LiquidationStatus::Healthy => Self::Healthy,
            LiquidationStatus::Liquidated => Self::Liquidated,
            LiquidationStatus::SecondMarginCall => Self::SecondMarginCall,
            LiquidationStatus::FirstMarginCall => Self::FirstMarginCall,
        }
    }
}

fn empty_string_is_none<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    if s.is_empty() {
        Ok(None)
    } else {
        Ok(Some(s))
    }
}

#[derive(sqlx::Type, Serialize, Debug, Eq, PartialEq)]
#[sqlx(type_name = "dispute_status")]
pub enum DisputeStatus {
    StartedBorrower,
    StartedLender,
    ResolvedBorrower,
    ResolvedLender,
}

#[derive(sqlx::Type, Serialize, Debug)]
pub struct Dispute {
    pub id: String,
    pub contract_id: String,
    pub borrower_id: String,
    pub lender_id: String,
    pub lender_payout_sats: Option<i64>,
    pub borrower_payout_sats: Option<i64>,
    pub comment: String,
    pub status: DisputeStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct DisputeRequestBodySchema {
    pub contract_id: String,
    pub reason: String,
    pub comment: String,
}
