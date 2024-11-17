use crate::moon;
use argon2::Argon2;
use argon2::PasswordHash;
use argon2::PasswordVerifier;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32::Xpub;
use bitcoin::Address;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use sqlx::FromRow;
use std::str::FromStr;
use time::OffsetDateTime;
use uuid::Uuid;

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
    pub wallet_backup_data: WalletBackupData,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct WalletBackupData {
    pub passphrase_hash: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
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
pub struct CreateLoanRequestSchema {
    pub ltv: Decimal,
    pub interest_rate: Decimal,
    pub loan_amount: Decimal,
    pub duration_months: i32,
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ContractRequestSchema {
    pub loan_id: String,
    // TODO: Reconsider this now!
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_months: i32,
    pub borrower_btc_address: Address<NetworkUnchecked>,
    pub borrower_pk: PublicKey,
    /// This is optional because certain integrations (such as Pay with Moon) define their own loan
    /// address.
    pub borrower_loan_address: Option<String>,
    pub integration: Option<Integration>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy)]
pub enum Integration {
    PayWithMoon,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct LoanOffer {
    pub id: String,
    pub lender_id: String,
    pub name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub min_ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount_min: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
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

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone, PartialEq)]
#[sqlx(type_name = "loan_asset_type")]
pub enum LoanAssetType {
    Usdc,
    Usdt,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone, PartialEq)]
#[sqlx(type_name = "loan_asset_chain")]
pub enum LoanAssetChain {
    Ethereum,
    Polygon,
    Starknet,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone)]
#[sqlx(type_name = "loan_offer_status")]
pub enum LoanOfferStatus {
    Available,
    Unavailable,
    Deleted,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct LoanRequest {
    pub id: String,
    pub borrower_id: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub ltv: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_months: i32,
    pub loan_asset_type: LoanAssetType,
    pub loan_asset_chain: LoanAssetChain,
    pub status: LoanRequestStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone)]
#[sqlx(type_name = "loan_request_status")]
pub enum LoanRequestStatus {
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
    pub integration: Option<Integration>,
    pub lender_xpub: Option<Xpub>,
    pub contract_address: Option<Address<NetworkUnchecked>>,
    pub contract_index: Option<u32>,
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
        pub integration: Option<Integration>,
        pub lender_xpub: Option<String>,
        pub contract_address: Option<String>,
        pub contract_index: Option<i32>,
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

    #[derive(Debug, Deserialize, sqlx::Type, Serialize)]
    #[sqlx(type_name = "integration")]
    pub enum Integration {
        PayWithMoon,
    }

    #[derive(Debug, Deserialize, sqlx::Type, Serialize)]
    #[sqlx(type_name = "moon_cards")]
    pub struct MoonCard {
        pub id: String,
        pub balance: Decimal,
        pub available_balance: Decimal,
        #[serde(with = "time::serde::rfc3339")]
        pub expiration: OffsetDateTime,
        pub pan: String,
        pub cvv: String,
        pub support_token: String,
        pub product_id: String,
        pub end_customer_id: String,
        pub contract_id: String,
        pub borrower_id: String,
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
            integration: value.integration.map(|i| i.into()),
            lender_xpub: value
                .lender_xpub
                .map(|xpub| xpub.parse().expect("valid xpub")),
            contract_address: value
                .contract_address
                .map(|addr| addr.parse().expect("valid address")),
            contract_index: value.contract_index.map(|i| i as u32),
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

impl From<db::Integration> for Integration {
    fn from(value: db::Integration) -> Self {
        match value {
            db::Integration::PayWithMoon => Self::PayWithMoon,
        }
    }
}

impl From<Integration> for db::Integration {
    fn from(value: Integration) -> Self {
        match value {
            Integration::PayWithMoon => Self::PayWithMoon,
        }
    }
}

impl From<db::MoonCard> for moon::Card {
    fn from(value: db::MoonCard) -> Self {
        Self {
            id: Uuid::from_str(&value.id).expect("uuid"),
            balance: value.balance,
            available_balance: value.available_balance,
            expiration: value.expiration,
            pan: value.pan,
            cvv: value.cvv,
            support_token: value.support_token,
            product_id: Uuid::from_str(&value.product_id).expect("uuid"),
            end_customer_id: value.end_customer_id,
            contract_id: value.contract_id,
            borrower_id: value.borrower_id,
        }
    }
}

impl From<moon::Card> for db::MoonCard {
    fn from(value: moon::Card) -> Self {
        Self {
            id: value.id.to_string(),
            balance: value.balance,
            available_balance: value.available_balance,
            expiration: value.expiration,
            pan: value.pan,
            cvv: value.cvv,
            support_token: value.support_token,
            product_id: value.product_id.to_string(),
            end_customer_id: value.end_customer_id,
            contract_id: value.contract_id,
            borrower_id: value.borrower_id,
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
            integration: value.integration.map(|i| i.into()),
            lender_xpub: value.lender_xpub.map(|xpub| xpub.to_string()),
            contract_address: value
                .contract_address
                .map(|addr| addr.assume_checked().to_string()),
            contract_index: value.contract_index.map(|i| i as i32),
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

#[derive(Deserialize)]
pub struct PsbtQueryParams {
    // fee rate in sats/vbyte
    pub fee_rate: u64,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone)]
#[sqlx(type_name = "transaction_type")]
pub enum TransactionType {
    Funding,
    Dispute,
    PrincipalGiven,
    PrincipalRepaid,
    Liquidation,
    ClaimCollateral,
}

#[derive(Debug, Deserialize, Serialize, sqlx::FromRow)]
pub struct LoanTransaction {
    pub id: i64,
    pub txid: String,
    pub contract_id: String,
    pub transaction_type: TransactionType,
    #[serde(with = "time::serde::rfc3339")]
    pub timestamp: OffsetDateTime,
}

/// Origination fee when establishing a new loan depends on the loan length.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct OriginationFee {
    /// Loans starting from this are considered, i.e. `>=from_month`
    pub from_month: i32,
    /// Loans smaller than this are considered, i.e. `<to_month`
    pub to_month: i32,
    /// Fee expressed as a number between 0 and 1, e.g. 0.01 = 1%
    #[serde(with = "rust_decimal::serde::float")]
    pub fee: Decimal,
}

impl OriginationFee {
    pub fn is_relevant(&self, contract_duration: i32) -> bool {
        self.from_month <= contract_duration && self.to_month > contract_duration
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BorrowerLoanFeature {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct FilteredUser {
    pub id: String,
    pub name: String,
    pub email: String,
    pub verified: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl FilteredUser {
    pub fn new_user(user: &User) -> Self {
        let created_at_utc = user.created_at;
        let updated_at_utc = user.updated_at;
        Self {
            id: user.id.to_string(),
            email: user.email.to_owned(),
            name: user.name.to_owned(),
            verified: user.verified,
            created_at: created_at_utc,
            updated_at: updated_at_utc,
        }
    }
}
