use crate::db::map_to_db_extension_policy;
use crate::db::map_to_model_extension_policy;
use crate::moon;
use crate::utils::calculate_liquidation_price;
use crate::utils::calculate_ltv;
use crate::utils::legacy_calculate_liquidation_price;
use crate::LEGACY_LTV_THRESHOLD_LIQUIDATION;
use crate::LTV_THRESHOLD_LIQUIDATION;
use anyhow::Context;
use anyhow::Result;
use argon2::Argon2;
use argon2::PasswordHash;
use argon2::PasswordVerifier;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32;
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::PublicKey;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use sqlx::FromRow;
use std::fmt;
use std::str::FromStr;
use time::macros::datetime;
use time::OffsetDateTime;
use url::Url;
use utoipa::ToSchema;
use uuid::Uuid;

mod installment;
mod npub;

pub mod notifications;

pub use installment::*;
pub use notifications::*;
pub use npub::*;

pub type Email = String;

/// One year in our application is counted as 360 days.
pub const ONE_YEAR: u32 = 360;
/// One month in our application is counted as 30 days.
pub const ONE_MONTH: u32 = 30;

#[derive(Debug, sqlx::FromRow)]
pub struct InviteCode {
    pub id: i32,
    pub code: String,
    pub active: bool,
}

#[derive(Clone, sqlx::FromRow)]
pub struct CreatorApiKey {
    pub id: i32,
    pub description: String,
}

#[derive(Debug, Clone)]
pub struct Borrower {
    pub id: String,
    pub name: String,
    pub email: Option<Email>,
    pub used_referral_code: Option<String>,
    pub personal_referral_codes: Vec<PersonalReferralCode>,
    pub first_time_discount_rate_referee: Option<Decimal>,
    pub timezone: Option<String>,
    pub locale: Option<String>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone)]
pub struct PasswordAuth {
    pub borrower_id: String,
    pub email: Email,
    /// A password (hash) may be stored if the user has yet to upgrade to PAKE.
    ///
    /// This is a legacy field.
    pub password: Option<String>,
    pub salt: String,
    pub verifier: String,
    pub verified: bool,
    pub verification_code: Option<String>,
    pub password_reset_token: Option<String>,
    pub password_reset_at: Option<OffsetDateTime>,
}

#[derive(Debug, sqlx::FromRow, Clone)]
pub struct PersonalReferralCode {
    pub(crate) code: String,
    pub(crate) active: bool,
    pub(crate) first_time_discount_rate_referee: Decimal,
    pub(crate) first_time_commission_rate_referrer: Decimal,
    pub(crate) commission_rate_referrer: Decimal,
    pub(crate) created_at: OffsetDateTime,
    pub(crate) expires_at: OffsetDateTime,
}

impl PasswordAuth {
    pub fn check_password(&self, provided_password: &str) -> bool {
        let legacy_password_hash = match &self.password {
            Some(p) => p,
            None => {
                tracing::error!(
                    "User attempted to log in with legacy password after upgrading to PAKE"
                );
                return false;
            }
        };
        match PasswordHash::new(legacy_password_hash) {
            Ok(parsed_hash) => Argon2::default()
                .verify_password(provided_password.as_bytes(), &parsed_hash)
                .is_ok_and(|_| true),
            Err(_) => false,
        }
    }
}

#[derive(Debug, Deserialize, sqlx::FromRow, Serialize, Clone)]
pub struct Lender {
    pub id: String,
    pub name: String,
    pub email: Email,
    /// A password (hash) may be stored if the user has yet to upgrade to PAKE.
    ///
    /// This is a legacy field.
    pub password: Option<String>,
    pub salt: String,
    pub verifier: String,
    pub verified: bool,
    pub verification_code: Option<String>,
    pub invite_code: Option<i32>,
    pub password_reset_token: Option<String>,
    pub timezone: Option<String>,
    pub locale: Option<String>,
    #[serde(with = "time::serde::rfc3339::option")]
    pub password_reset_at: Option<OffsetDateTime>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl Lender {
    pub fn check_password(&self, provided_password: &str) -> bool {
        let legacy_password_hash = match &self.password {
            Some(p) => p,
            None => {
                tracing::error!(
                    "User attempted to log in with legacy password after upgrading to PAKE"
                );
                return false;
            }
        };
        match PasswordHash::new(legacy_password_hash) {
            Ok(parsed_hash) => Argon2::default()
                .verify_password(provided_password.as_bytes(), &parsed_hash)
                .is_ok_and(|_| true),
            Err(_) => false,
        }
    }

    pub(crate) fn name(&self) -> String {
        self.name.clone()
    }

    pub(crate) fn email(&self) -> String {
        self.email.clone()
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

#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterUserSchema {
    /// Used as the user's unique identifier.
    pub email: Email,
    pub verifier: String,
    pub salt: String,
    pub name: String,
    #[serde(deserialize_with = "empty_string_is_none")]
    pub invite_code: Option<String>,
    pub wallet_backup_data: WalletBackupData,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct WalletBackupData {
    pub mnemonic_ciphertext: String,
    pub network: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct PakeLoginRequest {
    pub email: Email,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct PakeLoginResponse {
    pub salt: String,
    pub b_pub: String,
}

#[derive(Debug, Clone)]
pub struct PakeServerData {
    pub b: Vec<u8>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct PakeVerifyRequest {
    pub email: Email,
    pub a_pub: String,
    pub client_proof: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpgradeToPakeRequest {
    pub email: Email,
    /// The password the user used before PAKE. This one must be verified against the password hash
    /// stored in the database, one last time.
    pub old_password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UpgradeToPakeResponse {
    pub old_wallet_backup_data: WalletBackupData,
    /// We include a list of public keys which the user has used in open contracts, so that the
    /// client can verify that they are able to spend the contract with the remote wallet backup.
    #[schema(value_type = Vec<String>)]
    pub contract_pks: Vec<PublicKey>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct FinishUpgradeToPakeRequest {
    pub email: Email,
    /// The password the user used before PAKE. This one must be verified against the password hash
    /// stored in the database, one last time.
    pub old_password: String,
    pub verifier: String,
    pub salt: String,
    pub new_wallet_backup_data: WalletBackupData,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ForgotPasswordSchema {
    pub email: Email,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ResetPasswordSchema {
    pub verifier: String,
    pub salt: String,
    pub new_wallet_backup_data: WalletBackupData,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ResetLegacyPasswordSchema {
    pub password: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct CreateLoanOfferSchema {
    pub name: String,
    pub min_ltv: Decimal,
    /// Yearly interest rate.
    pub interest_rate: Decimal,
    pub loan_amount_min: Decimal,
    pub loan_amount_max: Decimal,
    pub loan_amount_reserve: Decimal,
    pub duration_days_min: i32,
    pub duration_days_max: i32,
    pub loan_asset: LoanAsset,
    pub loan_payout: LoanPayout,
    pub loan_repayment_address: String,
    #[schema(value_type = String)]
    pub lender_pk: PublicKey,
    #[schema(value_type = String)]
    pub lender_derivation_path: bip32::DerivationPath,
    pub auto_accept: bool,
    /// The lender can optionally provide a KYC link, so that the borrower can complete a KYC
    /// process.
    pub kyc_link: Option<Url>,
    pub lender_npub: Npub,
    pub extension_duration_days: Option<u64>,
    pub extension_interest_rate: Option<Decimal>,
    pub repayment_plan: RepaymentPlan,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct CreateLoanApplicationSchema {
    #[serde(with = "rust_decimal::serde::float")]
    pub ltv: Decimal,
    /// Yearly interest rate.
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_days: i32,
    // TODO: we might want to accept a list here in case the borrower doesn't care about the asset
    // and the `loan_type` supports multiple. For now, we stick with a single type
    pub loan_asset: LoanAsset,
    pub loan_type: LoanType,
    /// This is optional because certain integrations (such as Pay with Moon) define their own loan
    /// address.
    pub borrower_loan_address: Option<String>,
    #[schema(value_type = String)]
    pub borrower_btc_address: Address<NetworkUnchecked>,
    #[schema(value_type = String)]
    pub borrower_pk: PublicKey,
    #[schema(value_type = String)]
    pub borrower_derivation_path: bip32::DerivationPath,
    pub borrower_npub: Option<Npub>,
    pub client_contract_id: Option<Uuid>,
    pub repayment_plan: RepaymentPlan,
    // TODO: do we want to enable KYC for the lender? I.e. the borrower requires the lender to do
    // KYC?
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ContractRequestSchema {
    pub id: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_days: i32,
    #[schema(value_type = String)]
    pub borrower_btc_address: Address<NetworkUnchecked>,
    #[schema(value_type = String)]
    pub borrower_pk: PublicKey,
    #[schema(value_type = String)]
    pub borrower_derivation_path: bip32::DerivationPath,
    /// This is optional because certain integrations (such as Pay with Moon) define their own loan
    /// address.
    pub borrower_loan_address: Option<String>,
    pub loan_type: LoanType,
    /// If the `loan_type` field is set to `LoanType::PayWithMoon`, this field indicates whether
    /// the contract corresponds to a new card or an existing one.
    pub moon_card_id: Option<Uuid>,
    /// If the borrower chooses a `loan_id` that corresponds to a fiat loan (e.g.
    /// [`LoanType::Fiat`), this field must be present.
    pub fiat_loan_details: Option<FiatLoanDetailsWrapper>,
    pub borrower_npub: Option<Npub>,
    /// Optional client id for this contract
    pub client_contract_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct FiatLoanDetailsWrapper {
    pub details: FiatLoanDetails,
    /// The ciphertext which the borrower can decrypt to get the decryption key which can be used
    /// to decrypt the `details`.
    pub encrypted_encryption_key_borrower: String,
    /// The ciphertext which the lender can decrypt to get the decryption key which can be used to
    /// decrypt the `details`.
    pub encrypted_encryption_key_lender: String,
}

/// The type of loan primarily describes where to deliver the principal.
#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, ToSchema)]
pub enum LoanType {
    PayWithMoon,
    /// Like [`LoanType::PayWithMoon`], but we do not wait for the invoice to be confirmed by Moon
    /// before assigning funds to the borrower's card.
    ///
    /// This only works if the Lendasat Moon account has sufficient balance to cover the incoming
    /// loan amount.
    MoonCardInstant,
    StableCoin,
    Fiat,
    Bringin,
}

pub enum LoanDeal {
    LoanOffer(LoanOffer),
    LoanApplication(LoanApplication),
}

impl LoanDeal {
    pub fn kyc_link(&self) -> Option<Url> {
        match self {
            LoanDeal::LoanOffer(a) => a.kyc_link.clone(),
            LoanDeal::LoanApplication(_) => None,
        }
    }

    pub fn loan_asset(&self) -> LoanAsset {
        match self {
            LoanDeal::LoanOffer(a) => a.loan_asset,
            LoanDeal::LoanApplication(b) => b.loan_asset,
        }
    }

    pub fn repayment_plan(&self) -> RepaymentPlan {
        match self {
            LoanDeal::LoanOffer(a) => a.repayment_plan,
            LoanDeal::LoanApplication(b) => b.repayment_plan,
        }
    }
}

/// Represents an offer from a lender.
///
/// Note: [`loan_deal_id`] is used to identify whether a deal is an `offer` or an `application`.
/// This is crucial once we insert the `contract` into the DB, because here we can only reference
/// the `loan_deals`.
///
/// +-------------------+       +-------------------------+       +------------------------+
/// |    loan_offers    |       |        loan_deals       |       |   loan_applications    |
/// +-------------------+       +-------------------------+       +------------------------+
/// | id                |   |-->| id                      |<---|  | id                     |
/// | lender_id         |   |   | type: offer/application |    |  | borrower_id            |
/// | loan_deal_id      |---|   | created_at              |    |--| loan_deal_id           |
/// | ...               |       +-------------------------+       | ...                    |
/// +-------------------+               |                         +------------------------+
///                                     |
///                                     |
///                             +----------------+
///                             |   contracts    |
///                             +----------------+
///                             | id             |
///                             | loan_deal_id   |
///                             | ...            |
///                             +----------------+
#[derive(Debug, Clone)]
pub struct LoanOffer {
    pub loan_deal_id: String,
    pub lender_id: String,
    pub name: String,
    pub min_ltv: Decimal,
    /// Yearly interest rate.
    pub interest_rate: Decimal,
    pub loan_amount_min: Decimal,
    pub loan_amount_max: Decimal,
    pub loan_amount_reserve: Decimal,
    pub loan_amount_reserve_remaining: Decimal,
    pub duration_days_min: i32,
    pub duration_days_max: i32,
    pub loan_asset: LoanAsset,
    pub loan_payout: LoanPayout,
    pub status: LoanOfferStatus,
    pub loan_repayment_address: String,
    pub lender_pk: PublicKey,
    pub lender_derivation_path: bip32::DerivationPath,
    pub auto_accept: bool,
    pub kyc_link: Option<Url>,
    pub lender_npub: Npub,
    pub extension_policy: ExtensionPolicy,
    pub repayment_plan: RepaymentPlan,
    /// The address where the lender wants to receive repayment, if the borrower chooses to repay
    /// with Bitcoin.
    ///
    /// It's optional because not all lenders will accept Bitcoin repayments.
    pub btc_loan_repayment_address: Option<Address>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Copy)]
pub enum ExtensionPolicy {
    /// Extensions are not possible.
    DoNotExtend,
    /// If half of the contract duration has passed, the contract can be extended.
    AfterHalfway {
        /// The maximum number of days the contract can be extended by if the condition is met.
        max_duration_days: u64,
        /// The yearly interest rate that applies to the extension period.
        interest_rate: Decimal,
    },
}

impl LoanOffer {
    pub fn requires_kyc(&self) -> bool {
        self.kyc_link.is_some()
    }

    pub fn is_valid_loan_duration(&self, duration_days: i32) -> bool {
        (self.duration_days_min..=self.duration_days_max).contains(&duration_days)
    }

    pub fn is_valid_loan_amount(&self, loan_amount: Decimal) -> bool {
        (self.loan_amount_min..=self.loan_amount_max).contains(&loan_amount)
    }
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone, PartialEq, ToSchema)]
#[sqlx(type_name = "loan_payout")]
pub enum LoanPayout {
    /// The loan is paid out directly i.e. the borrower receives the [`LoanAsset`].
    Direct,
    /// The loan is paid out indirectly i.e. the borrower receives a good or service valued at the
    /// `loan_amount` price.
    Indirect,
    /// The loan is paid out to the borrower's Moon Card, but without requiring lots of
    /// confirmations on (currently) Polygon.
    ///
    /// We want [`LoanOffer`]s with this kind of payout to only show up on the Lendasat card mobile
    /// app. In facet, this variant is only used to indicate that.
    MoonCardInstant,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone, Copy, PartialEq, ToSchema)]
#[sqlx(type_name = "loan_asset")]
pub enum LoanAsset {
    UsdcPol,
    UsdtPol,
    UsdcEth,
    UsdtEth,
    UsdcStrk,
    UsdtStrk,
    UsdcSol,
    UsdtSol,
    Usd,
    Eur,
    Chf,
    Mxn,
    UsdtLiquid,
}

impl LoanAsset {
    pub fn is_fiat(&self) -> bool {
        match self {
            LoanAsset::Usd | LoanAsset::Eur | LoanAsset::Chf | LoanAsset::Mxn => true,
            LoanAsset::UsdcPol
            | LoanAsset::UsdtPol
            | LoanAsset::UsdcEth
            | LoanAsset::UsdtEth
            | LoanAsset::UsdcStrk
            | LoanAsset::UsdtStrk
            | LoanAsset::UsdcSol
            | LoanAsset::UsdtSol
            | LoanAsset::UsdtLiquid => false,
        }
    }

    pub fn to_currency(&self) -> Currency {
        match self {
            LoanAsset::UsdcPol
            | LoanAsset::UsdtPol
            | LoanAsset::UsdcEth
            | LoanAsset::UsdtEth
            | LoanAsset::UsdcStrk
            | LoanAsset::UsdtStrk
            | LoanAsset::UsdcSol
            | LoanAsset::UsdtSol
            | LoanAsset::Usd
            | LoanAsset::Chf
            | LoanAsset::Mxn
            | LoanAsset::UsdtLiquid => Currency::Usd,
            LoanAsset::Eur => Currency::Eur,
        }
    }
}

impl fmt::Display for LoanAsset {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let string = match self {
            LoanAsset::UsdcPol => "USDC on Polygon",
            LoanAsset::UsdtPol => "USDT on Polygon",
            LoanAsset::UsdcEth => "USDC on Ethereum",
            LoanAsset::UsdtEth => "USDT on Ethereum",
            LoanAsset::UsdcStrk => "USDC on Starknet",
            LoanAsset::UsdtStrk => "USDT on Starknet",
            LoanAsset::UsdcSol => "USDC on Solana",
            LoanAsset::UsdtSol => "USDT on Solana",
            LoanAsset::Usd => "USD",
            LoanAsset::Eur => "EUR",
            LoanAsset::Chf => "CHF",
            LoanAsset::Mxn => "MXN",
            LoanAsset::UsdtLiquid => "USDT on Liquid",
        };
        write!(f, "{string}")
    }
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone, PartialEq, ToSchema)]
#[sqlx(type_name = "loan_offer_status")]
pub enum LoanOfferStatus {
    Available,
    Unavailable,
    Deleted,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone, ToSchema)]
pub struct LoanApplication {
    pub loan_deal_id: String,
    pub borrower_id: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub ltv: Decimal,
    /// Yearly interest rate.
    #[serde(with = "rust_decimal::serde::float")]
    pub interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub loan_amount: Decimal,
    pub duration_days: i32,
    /// This is optional because certain integrations (such as Pay with Moon) define their own loan
    /// address.
    pub borrower_loan_address: Option<String>,
    #[schema(value_type = String)]
    pub borrower_btc_address: Address<NetworkUnchecked>,
    pub loan_asset: LoanAsset,
    pub loan_type: LoanType,
    #[schema(value_type = String)]
    pub borrower_pk: PublicKey,
    #[schema(value_type = String)]
    pub borrower_derivation_path: bip32::DerivationPath,
    pub borrower_npub: Npub,
    pub status: LoanApplicationStatus,
    pub client_contract_id: Option<Uuid>,
    pub repayment_plan: RepaymentPlan,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone, ToSchema)]
#[sqlx(type_name = "loan_application_status")]
pub enum LoanApplicationStatus {
    Available,
    Unavailable,
    Taken,
    Deleted,
    ApplicationExpired,
    Cancelled,
}

#[derive(Debug, Clone)]
pub struct Contract {
    pub id: String,
    pub lender_id: String,
    pub borrower_id: String,
    pub loan_id: String,
    pub initial_ltv: Decimal,
    /// The minimum amount of collateral the borrower is expected to send to set up a loan.
    ///
    /// This value is only relevant before the loan has been established and must not be used again
    /// afterwards. You almost certainly want to use `collateral_sats` instead.
    pub initial_collateral_sats: u64,
    pub origination_fee_sats: u64,
    /// The current amount of confirmed collateral in the loan contract, _including_ the
    /// origination fee.
    ///
    /// We have decided to not persist the collateral outputs to make the implementation simpler.
    /// This may come back to bite us.
    pub collateral_sats: u64,
    pub loan_amount: Decimal,
    pub duration_days: i32,
    pub expiry_date: OffsetDateTime,
    pub borrower_btc_address: Address<NetworkUnchecked>,
    /// Waiting for all contracts in prod to have this set. This is now the source of truth for the
    /// borrower's PK in the multisig.
    pub borrower_pk: PublicKey,
    /// This is an [`Option`] because we don't know the derivation path for really old contracts.
    pub borrower_derivation_path: Option<bip32::DerivationPath>,
    /// Waiting for all contracts in prod to have this set. This is now the source of truth for the
    /// lender's PK in the multisig.
    pub lender_pk: PublicKey,
    pub lender_derivation_path: bip32::DerivationPath,
    /// Optional because fiat loans do not have loan addresses in the cryptocurrency sense.
    pub borrower_loan_address: Option<String>,
    pub lender_loan_repayment_address: Option<String>,
    /// The address where the lender wants to receive repayment, if the borrower chooses to repay
    /// with Bitcoin.
    ///
    /// It's optional because not all lenders will accept Bitcoin repayments.
    pub lender_btc_loan_repayment_address: Option<Address>,
    pub loan_type: LoanType,
    pub contract_address: Option<Address<NetworkUnchecked>>,
    pub contract_index: Option<u32>,
    pub borrower_npub: Npub,
    pub lender_npub: Npub,
    pub status: ContractStatus,
    pub liquidation_status: LiquidationStatus,
    pub contract_version: ContractVersion,
    pub client_contract_id: Option<Uuid>,
    /// Yearly interest rate.
    pub interest_rate: Decimal,
    pub extension_policy: ExtensionPolicy,
    pub asset: LoanAsset,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

impl Contract {
    pub fn currency(&self) -> Currency {
        self.asset.to_currency()
    }

    pub fn ltv(&self, installments: &[Installment], price: Decimal) -> Result<Decimal> {
        let actual_collateral_sats =
            Decimal::from_u64(self.actual_collateral().to_sat()).expect("to fit into u64");

        let outstanding_balance_usd = compute_outstanding_balance(installments);

        calculate_ltv(
            price,
            outstanding_balance_usd.total(),
            actual_collateral_sats,
        )
    }

    /// The [`Amount`] of collateral locked up on the blockchain, not including any sats in the
    /// contract dedicated to the origination fee.
    pub fn actual_collateral(&self) -> Amount {
        Amount::from_sat(self.collateral_sats)
            .checked_sub(Amount::from_sat(self.origination_fee_sats))
            .unwrap_or_default()
    }

    /// Calculate the liquidation price of the contract based on its current `collateral_sats`.
    ///
    /// The liquidation price cannot be computed if `collateral_sats` is zero. In such a scenario,
    /// we use the `initial_collateral_sats`, which should never be zero.
    pub fn liquidation_price(&self, installments: &[Installment]) -> Decimal {
        let collateral_sats = if self.actual_collateral() == Amount::ZERO {
            self.initial_collateral_sats
        } else {
            self.actual_collateral().to_sat()
        };

        let outstanding_balance_usd = compute_outstanding_balance(installments);

        if self.has_new_liquidation_threshold() {
            calculate_liquidation_price(
                outstanding_balance_usd.total(),
                Decimal::from_u64(collateral_sats).expect("to fit"),
            )
            .expect("valid liquidation price")
        } else {
            legacy_calculate_liquidation_price(
                outstanding_balance_usd.total(),
                Decimal::from_u64(collateral_sats).expect("to fit"),
            )
            .expect("valid liquidation price")
        }
    }

    pub fn can_be_liquidated(&self, ltv: Decimal) -> bool {
        if self.has_new_liquidation_threshold() {
            ltv >= LTV_THRESHOLD_LIQUIDATION
        } else {
            ltv >= LEGACY_LTV_THRESHOLD_LIQUIDATION
        }
    }

    fn has_new_liquidation_threshold(&self) -> bool {
        self.created_at >= datetime!(2025-03-01 0:00 UTC)
    }

    /// Check if extension is possible based on the contract's [`ExtensionPolicy`].
    ///
    /// If it is possible, we return the interest rate that will apply for the extension period.
    pub fn handle_extension_request(
        &self,
        now: OffsetDateTime,
        extension_duration_days: u64,
    ) -> Result<Decimal, ExtensionRequestError> {
        let extension_interest_rate = match self.extension_policy {
            ExtensionPolicy::DoNotExtend => return Err(ExtensionRequestError::NotAllowed),
            ExtensionPolicy::AfterHalfway {
                max_duration_days, ..
            } if extension_duration_days > max_duration_days => {
                return Err(ExtensionRequestError::TooManyDays { max_duration_days })
            }
            ExtensionPolicy::AfterHalfway { interest_rate, .. } => interest_rate,
        };

        let duration_days = self.duration_days as i64;

        let days_left = (self.expiry_date - now).whole_days();
        let days_passed = duration_days - days_left;

        if days_passed < (duration_days / 2) {
            return Err(ExtensionRequestError::TooSoon);
        }

        Ok(extension_interest_rate)
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ExtensionRequestError {
    /// Extension is not currently supported for this contract.
    NotAllowed,
    /// Extension will be possible at a later time.
    TooSoon,
    /// Extension is only possible for `max_duration_days`.
    TooManyDays { max_duration_days: u64 },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Copy)]
#[repr(u32)]
pub enum ContractVersion {
    TwoOfFour = 0,
    TwoOfThree = 1,
}

impl From<i32> for ContractVersion {
    fn from(value: i32) -> Self {
        match value {
            0 => Self::TwoOfFour,
            1 => Self::TwoOfThree,
            unknown => panic!("unknown contract version {unknown}"),
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, ToSchema)]
pub enum ContractStatus {
    /// The borrower has sent a contract request based on a loan offer.
    ///
    /// - If the lender accepts the contract request, we transition to
    ///   [`ContractStatus::Accepted`].
    ///
    /// - If the lender rejects the contract request, we transition to
    ///   [`ContractStatus::Rejected`].
    ///
    /// - If the request times out, we transition to [`ContractStatus::RequestExpired`].
    Requested,
    // FIXME: To be removed.
    /// The borrower has sent a request to extend another contract. This state is to be used for
    /// the new contract.
    ///
    /// This status is not used and will be removed.
    RenewalRequested,
    /// The lender has accepted the contract request.
    ///
    /// - If the borrower funds the Bitcoin collateral contract, we transition to
    ///   [`ContractStatus::CollateralConfirmed`].
    ///
    /// - If the borrower takes too long to fund the collateral contract, we transition to
    ///   [`ContractStatus::ApprovalExpired`].
    Approved,
    /// The collateral contract has been seen on the blockchain.
    ///
    /// If the collateral contract is _confirmed_ on the blockchain, we transition to
    /// [`ContractStatus::CollateralConfirmed`].
    ///
    /// Currently, this status is unused as we do not monitor the mempool.
    CollateralSeen(
        // HACK: This is just here to get around this bug:
        // https://github.com/juhaku/utoipa/issues/679#issuecomment-1874235656.
        (),
    ),
    /// The collateral contract has received enough confirmations on the blockchain.
    ///
    /// - If the lender disburses the principal, we transition to
    ///   [`ContractStatus::PrincipalGiven`].
    ///
    /// - If the lender fails to disburse the principal in a timely manner, the borrower may raise
    ///   a dispute, transitioning to [`ContractStatus::DisputeBorrowerStarted`].
    CollateralConfirmed,
    /// The lender has disbursed the principal to the borrower. The loan contract is now open.
    ///
    /// From this point onwards, the contract may be:
    ///
    /// - Repaid in full (according to the borrower), transitioning to
    ///   [`ContractStatus::RepaymentProvided`].
    ///
    /// - Not repaid in time, transitioning to [`ContractStatus::Defaulted`].
    ///
    /// - Undercollateralized due to a substantial drop in the price of Bitcoin with respect to the
    ///   opening price, transitioning to [`ContractStatus::Undercollateralized`].
    ///
    /// - Extended before loan term, transitioning to [`ContractStatus::Extended`]. A new contract
    ///   will be created with status [`ContractStatus::PrincipalGiven`], and this contract will
    ///   serve as historical data. The contracts will be linked through the `extends_contract` and
    ///   `extended_by_contract` fields of the `Contract` schema.
    PrincipalGiven,
    /// The borrower has repaid the entire outstanding balance to the lender: principal plus
    /// interest.
    ///
    /// - If the lender confirms the repayment, the contract will transition to
    ///   [`ContractStatus::RepaymentConfirmed`].
    ///
    /// - If the lender does not eventually confirm the repayment, either party may raise a
    ///   dispute, transitioning to either [`ContractStatus::DisputeBorrowerStarted`] or
    ///   [`ContractStatus::DisputeLenderStarted`].
    RepaymentProvided,
    /// The lender has confirmed the repayment of the entire outstanding balance: principal plus
    /// interest.
    ///
    /// If the borrower claims the collateral, we transition to [`ContractStatus::Closing`].
    RepaymentConfirmed,
    /// The loan contract is not sufficiently collateralized according to the required maximum LTV.
    ///
    /// If the lender liquidates their share of the collateral, we transition to
    /// [`ContractStatus::Closing`].
    ///
    /// In theory, the value of the collateral may reduce the LTV enough such that the contract may
    /// not be considered undercollateralized anymore. In practice, we do not support this at this
    /// stage: if the contract was ever considered undercollateralized, the collateral will be
    /// liquidated by the lender.
    Undercollateralized,
    /// The borrower failed to pay back the loan before loan term.
    ///
    /// If the lender liquidates their share of the collateral, we transition to
    /// [`ContractStatus::Closing`].
    Defaulted,
    /// The transaction spending the collateral contract outputs has been published on the
    /// blockchain, but is not yet confirmed.
    ///
    /// If the spend transaction is _confirmed_ on the blockchain, we transition to
    /// [`ContractStatus::Closed`].
    Closing,
    /// The transaction spending the collateral contract outputs has been published and confirmed
    /// on the blockchain. The loan contract is now closed.
    ///
    /// This status implies that the borrower paid back the loan.
    Closed,
    /// The transaction spending the collateral contract outputs has been published and confirmed
    /// on the blockchain. The loan contract is now closed.
    ///
    /// This status indicates that the loan contract was liquidated due to undercollateralization.
    ClosedByLiquidation,
    /// The transaction spending the collateral contract outputs has been published and confirmed
    /// on the blockchain. The loan contract is now closed.
    ///
    /// This status indicates that the loan contract was liquidated because the borrower defaulted
    /// on a loan repayment.
    ClosedByDefaulting,
    /// The loan contract was extended before the loan term.
    ///
    /// A new contract was created in place of this one, with status
    /// [`ContractStatus::PrincipalGiven`]. This contract now serves as historical data. The
    /// contracts are linked through the `extends_contract` and `extended_by_contract` fields of
    /// the `Contract` schema.
    Extended,
    /// The contract request was rejected by the lender.
    Rejected,
    /// A dispute has been started by the borrower.
    ///
    /// Once the dispute is resolved, the contract will (in most cases) transition back to the
    /// status before the dispute was raised.
    DisputeBorrowerStarted,
    /// A dispute has been started by the lender.
    ///
    /// Once the dispute is resolved, the contract will (in most cases) transition back to the
    /// status before the dispute was raised.
    DisputeLenderStarted,
    // FIXME: To be removed.
    /// The dispute has been resolved by the borrower.
    ///
    /// This status is not used and will be removed.
    DisputeBorrowerResolved,
    // FIXME: To be removed.
    /// The dispute has been resolved by the lender.
    ///
    /// This status is not used and will be removed.
    DisputeLenderResolved,
    /// The contract request has been cancelled by the borrower.
    Cancelled,
    /// The contract request has expired because the lender did not respond in time.
    RequestExpired,
    /// The approved contract has expired because the borrower did not collateralize it in time.
    ApprovalExpired,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, ToSchema)]
pub enum LiquidationStatus {
    /// Contract is in a healthy state.
    Healthy,
    /// First margin call: the borrower still has time to add more collateral before getting
    /// liquidated
    FirstMarginCall,
    /// Second margin call: the borrower still has time to add more collateral before getting
    /// liquidated, but it's getting closer.
    SecondMarginCall,
    /// Contract got liquidated.
    Liquidated,
}

/// A record of all the one-time email messages sent for a particular contract.
///
/// We use this to avoid sending the same email message more than once.
#[derive(Debug)]
pub struct ContractEmails {
    pub contract_id: String,
    /// Whether the loan-request email was sent to the lender.
    pub loan_request_sent: bool,
    /// Whether the loan-request-approved email was sent to the borrower.
    pub loan_request_approved_sent: bool,
    /// Whether the loan-request-rejected email was sent to the borrower.
    pub loan_request_rejected_sent: bool,
    /// Whether the collateral-funded email was sent to the lender.
    pub collateral_funded_sent: bool,
    /// Whether the loan-paid-out email was sent to the borrower.
    pub loan_paid_out_sent: bool,
    /// Whether an email was sent to the lender telling them that the contract has been auto
    /// approved.
    pub loan_auto_accept_notification_sent: bool,
    /// Whether an email was sent to notify borrower about a defaulted loan
    pub defaulted_loan_borrower_sent: bool,
    /// Whether an email was sent to notify lender about a defaulted loan
    pub defaulted_loan_lender_sent: bool,
    /// Whether an email was sent after the defaulted loan was liquidated
    pub defaulted_loan_liquidated_sent: bool,
    /// Whether an email was sent to the borrower after the we expired a contract request
    pub loan_request_expired_borrower_sent: bool,
    /// Whether an email was sent to the lender after the we expired a contract request
    pub loan_request_expired_lender_sent: bool,
    /// Whether an email was sent to the borrower about a restructured contract
    pub restructured_contract_borrower_sent: bool,
    /// Whether an email was sent to the lender about a restructured contract
    pub restructured_contract_lender_sent: bool,
}

/// Public information about an API key.
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ApiKeyInfo {
    pub id: i32,
    pub description: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

pub mod db {
    use crate::model::LoanAsset;
    use rust_decimal::Decimal;
    use serde::Deserialize;
    use serde::Serialize;
    use sqlx::FromRow;
    use time::OffsetDateTime;
    use uuid::Uuid;

    #[derive(Debug, FromRow, Serialize, Deserialize)]
    pub struct Contract {
        pub id: String,
        pub lender_id: String,
        pub borrower_id: String,
        pub loan_deal_id: String,
        pub initial_ltv: Decimal,
        pub initial_collateral_sats: i64,
        pub origination_fee_sats: i64,
        pub collateral_sats: i64,
        pub loan_amount: Decimal,
        pub duration_days: i32,
        pub expiry_date: OffsetDateTime,
        pub borrower_btc_address: String,
        pub borrower_pk: String,
        pub borrower_derivation_path: Option<String>,
        pub lender_pk: String,
        pub lender_derivation_path: String,
        pub borrower_loan_address: Option<String>,
        pub lender_loan_repayment_address: Option<String>,
        /// The address where the lender wants to receive repayment, if the borrower chooses to
        /// repay with Bitcoin.
        ///
        /// It's optional because not all lenders will accept Bitcoin repayments.
        pub lender_btc_loan_repayment_address: Option<String>,
        pub loan_type: LoanType,
        pub contract_address: Option<String>,
        pub contract_index: Option<i32>,
        pub borrower_npub: String,
        pub lender_npub: String,
        pub status: ContractStatus,
        pub liquidation_status: LiquidationStatus,
        pub contract_version: i32,
        pub interest_rate: Decimal,
        pub client_contract_id: Option<Uuid>,
        pub extension_duration_days: i32,
        pub extension_interest_rate: Decimal,
        pub asset: LoanAsset,
        #[serde(with = "time::serde::rfc3339")]
        pub created_at: OffsetDateTime,
        #[serde(with = "time::serde::rfc3339")]
        pub updated_at: OffsetDateTime,
    }

    #[derive(Clone, Copy, Debug, Deserialize, sqlx::Type, Serialize, PartialEq)]
    #[sqlx(type_name = "contract_status")]
    pub enum ContractStatus {
        Requested,
        RenewalRequested,
        Approved,
        CollateralSeen,
        CollateralConfirmed,
        PrincipalGiven,
        RepaymentProvided,
        RepaymentConfirmed,
        Undercollateralized,
        Defaulted,
        Closing,
        Closed,
        ClosedByLiquidation,
        ClosedByDefaulting,
        Extended,
        Cancelled,
        Rejected,
        DisputeBorrowerStarted,
        DisputeLenderStarted,
        DisputeBorrowerResolved,
        DisputeLenderResolved,
        RequestExpired,
        ApprovalExpired,
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
    #[sqlx(type_name = "loan_type")]
    pub enum LoanType {
        PayWithMoon,
        MoonCardInstant,
        StableCoin,
        Fiat,
        Bringin,
    }

    #[derive(Debug, Deserialize, sqlx::Type, Serialize)]
    #[sqlx(type_name = "moon_cards")]
    pub struct MoonCard {
        pub id: String,
        pub balance: Decimal,
        pub available_balance: Decimal,
        pub expiration: String,
        pub pan: String,
        pub cvv: String,
        pub support_token: String,
        pub product_id: String,
        pub end_customer_id: String,
        pub borrower_id: String,
    }

    #[derive(Debug, FromRow)]
    pub struct ContractEmails {
        pub contract_id: String,
        pub loan_request_sent: bool,
        pub loan_request_approved_sent: bool,
        pub loan_request_rejected_sent: bool,
        pub collateral_funded_sent: bool,
        pub loan_paid_out_sent: bool,
        pub loan_repaid_sent: bool,
        pub loan_auto_accept_notification_sent: bool,
        pub defaulted_loan_borrower_sent: bool,
        pub defaulted_loan_lender_sent: bool,
        pub defaulted_loan_liquidated_sent: bool,
        pub loan_request_expired_borrower_sent: bool,
        pub loan_request_expired_lender_sent: bool,
        pub restructured_contract_borrower_sent: bool,
        pub restructured_contract_lender_sent: bool,
    }
}

impl From<db::Contract> for Contract {
    fn from(value: db::Contract) -> Self {
        let extension_policy = map_to_model_extension_policy(
            value.extension_duration_days,
            value.extension_interest_rate,
        );

        Self {
            id: value.id,
            lender_id: value.lender_id,
            borrower_id: value.borrower_id,
            loan_id: value.loan_deal_id,
            initial_ltv: value.initial_ltv,
            initial_collateral_sats: value.initial_collateral_sats as u64,
            origination_fee_sats: value.origination_fee_sats as u64,
            collateral_sats: value.collateral_sats as u64,
            loan_amount: value.loan_amount,
            duration_days: value.duration_days,
            expiry_date: value.expiry_date,
            borrower_btc_address: Address::from_str(&value.borrower_btc_address)
                .expect("valid address"),
            borrower_pk: value.borrower_pk.parse().expect("valid pk"),
            borrower_derivation_path: value
                .borrower_derivation_path
                .map(|d| d.parse().expect("valid path")),
            lender_pk: value.lender_pk.parse().expect("valid pk"),
            lender_derivation_path: value.lender_derivation_path.parse().expect("valid path"),
            borrower_loan_address: value.borrower_loan_address,
            lender_loan_repayment_address: value.lender_loan_repayment_address,
            lender_btc_loan_repayment_address: value.lender_btc_loan_repayment_address.map(
                |addr| {
                    addr.parse::<Address<NetworkUnchecked>>()
                        .expect("valid address")
                        .assume_checked()
                },
            ),
            loan_type: value.loan_type.into(),
            contract_address: value
                .contract_address
                .map(|addr| addr.parse().expect("valid address")),
            contract_index: value.contract_index.map(|i| i as u32),
            interest_rate: value.interest_rate,
            borrower_npub: value.borrower_npub.parse().expect("valid npub in database"),
            lender_npub: value.lender_npub.parse().expect("valid npub in database"),
            status: value.status.into(),
            liquidation_status: value.liquidation_status.into(),
            contract_version: ContractVersion::from(value.contract_version),
            client_contract_id: value.client_contract_id,
            extension_policy,
            asset: value.asset,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<db::ContractStatus> for ContractStatus {
    fn from(value: db::ContractStatus) -> Self {
        match value {
            db::ContractStatus::Requested => Self::Requested,
            db::ContractStatus::RenewalRequested => Self::RenewalRequested,
            db::ContractStatus::Approved => Self::Approved,
            db::ContractStatus::CollateralSeen => Self::CollateralSeen(()),
            db::ContractStatus::CollateralConfirmed => Self::CollateralConfirmed,
            db::ContractStatus::PrincipalGiven => Self::PrincipalGiven,
            db::ContractStatus::RepaymentProvided => Self::RepaymentProvided,
            db::ContractStatus::RepaymentConfirmed => Self::RepaymentConfirmed,
            db::ContractStatus::Undercollateralized => Self::Undercollateralized,
            db::ContractStatus::Defaulted => Self::Defaulted,
            db::ContractStatus::Closing => Self::Closing,
            db::ContractStatus::Closed => Self::Closed,
            db::ContractStatus::Extended => Self::Extended,
            db::ContractStatus::Rejected => Self::Rejected,
            db::ContractStatus::DisputeBorrowerStarted => Self::DisputeBorrowerStarted,
            db::ContractStatus::DisputeLenderStarted => Self::DisputeLenderStarted,
            db::ContractStatus::DisputeBorrowerResolved => Self::DisputeBorrowerResolved,
            db::ContractStatus::DisputeLenderResolved => Self::DisputeLenderResolved,
            db::ContractStatus::Cancelled => Self::Cancelled,
            db::ContractStatus::RequestExpired => Self::RequestExpired,
            db::ContractStatus::ApprovalExpired => Self::ApprovalExpired,
            db::ContractStatus::ClosedByLiquidation => Self::ClosedByLiquidation,
            db::ContractStatus::ClosedByDefaulting => Self::ClosedByDefaulting,
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

impl From<db::LoanType> for LoanType {
    fn from(value: db::LoanType) -> Self {
        match value {
            db::LoanType::PayWithMoon => Self::PayWithMoon,
            db::LoanType::MoonCardInstant => Self::MoonCardInstant,
            db::LoanType::StableCoin => Self::StableCoin,
            db::LoanType::Fiat => Self::Fiat,
            db::LoanType::Bringin => Self::Bringin,
        }
    }
}

impl From<LoanType> for db::LoanType {
    fn from(value: LoanType) -> Self {
        match value {
            LoanType::PayWithMoon => Self::PayWithMoon,
            LoanType::MoonCardInstant => Self::MoonCardInstant,
            LoanType::StableCoin => Self::StableCoin,
            LoanType::Fiat => Self::Fiat,
            LoanType::Bringin => Self::Bringin,
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
            borrower_id: value.borrower_id,
        }
    }
}

impl From<Contract> for db::Contract {
    fn from(value: Contract) -> Self {
        let (extension_duration_days, extension_interest_rate) =
            map_to_db_extension_policy(value.extension_policy);

        Self {
            id: value.id,
            lender_id: value.lender_id,
            borrower_id: value.borrower_id,
            loan_deal_id: value.loan_id,
            initial_ltv: value.initial_ltv,
            initial_collateral_sats: value.initial_collateral_sats as i64,
            origination_fee_sats: value.origination_fee_sats as i64,
            collateral_sats: value.collateral_sats as i64,
            loan_amount: value.loan_amount,
            duration_days: value.duration_days,
            expiry_date: value.expiry_date,
            borrower_btc_address: value.borrower_btc_address.assume_checked().to_string(),
            borrower_pk: value.borrower_pk.to_string(),
            borrower_derivation_path: value.borrower_derivation_path.map(|d| d.to_string()),
            lender_pk: value.lender_pk.to_string(),
            lender_derivation_path: value.lender_derivation_path.to_string(),
            borrower_loan_address: value.borrower_loan_address,
            lender_loan_repayment_address: value.lender_loan_repayment_address,
            lender_btc_loan_repayment_address: value
                .lender_btc_loan_repayment_address
                .map(|addr| addr.to_string()),
            loan_type: value.loan_type.into(),
            contract_address: value
                .contract_address
                .map(|addr| addr.assume_checked().to_string()),
            contract_index: value.contract_index.map(|i| i as i32),
            borrower_npub: value.borrower_npub.to_string(),
            lender_npub: value.lender_npub.to_string(),
            status: value.status.into(),
            liquidation_status: value.liquidation_status.into(),
            contract_version: value.contract_version as i32,
            interest_rate: value.interest_rate,
            client_contract_id: value.client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset: value.asset,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

impl From<ContractStatus> for db::ContractStatus {
    fn from(value: ContractStatus) -> Self {
        match value {
            ContractStatus::Requested => Self::Requested,
            ContractStatus::RenewalRequested => Self::RenewalRequested,
            ContractStatus::Approved => Self::Approved,
            ContractStatus::CollateralSeen(_) => Self::CollateralSeen,
            ContractStatus::CollateralConfirmed => Self::CollateralConfirmed,
            ContractStatus::PrincipalGiven => Self::PrincipalGiven,
            ContractStatus::RepaymentProvided => Self::RepaymentProvided,
            ContractStatus::RepaymentConfirmed => Self::RepaymentConfirmed,
            ContractStatus::Undercollateralized => Self::Undercollateralized,
            ContractStatus::Defaulted => Self::Defaulted,
            ContractStatus::Closing => Self::Closing,
            ContractStatus::Closed => Self::Closed,
            ContractStatus::Extended => Self::Extended,
            ContractStatus::Rejected => Self::Rejected,
            ContractStatus::DisputeBorrowerStarted => Self::DisputeBorrowerStarted,
            ContractStatus::DisputeLenderStarted => Self::DisputeLenderStarted,
            ContractStatus::DisputeBorrowerResolved => Self::DisputeBorrowerResolved,
            ContractStatus::DisputeLenderResolved => Self::DisputeLenderResolved,
            ContractStatus::Cancelled => Self::Cancelled,
            ContractStatus::RequestExpired => Self::RequestExpired,
            ContractStatus::ApprovalExpired => Self::ApprovalExpired,
            ContractStatus::ClosedByLiquidation => Self::ClosedByLiquidation,
            ContractStatus::ClosedByDefaulting => Self::ClosedByDefaulting,
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

impl From<db::ContractEmails> for ContractEmails {
    fn from(value: db::ContractEmails) -> Self {
        Self {
            contract_id: value.contract_id,
            loan_request_sent: value.loan_request_sent,
            loan_request_approved_sent: value.loan_request_approved_sent,
            loan_request_rejected_sent: value.loan_request_rejected_sent,
            collateral_funded_sent: value.collateral_funded_sent,
            loan_paid_out_sent: value.loan_paid_out_sent,
            loan_auto_accept_notification_sent: value.loan_auto_accept_notification_sent,
            defaulted_loan_borrower_sent: value.defaulted_loan_borrower_sent,
            defaulted_loan_lender_sent: value.defaulted_loan_lender_sent,
            defaulted_loan_liquidated_sent: value.defaulted_loan_liquidated_sent,
            loan_request_expired_borrower_sent: value.loan_request_expired_borrower_sent,
            loan_request_expired_lender_sent: value.loan_request_expired_lender_sent,
            restructured_contract_borrower_sent: value.restructured_contract_borrower_sent,
            restructured_contract_lender_sent: value.restructured_contract_lender_sent,
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

#[derive(Debug, Deserialize, ToSchema)]
pub struct DisputeRequestBodySchema {
    pub contract_id: String,
    pub reason: String,
    pub comment: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct InstallmentPaidRequest {
    pub installment_id: Uuid,
    /// For stablecoin loans, this should be a TXID. For fiat loans, there is no predefined format
    /// so this may be left empty.
    pub payment_id: String,
}

#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct ConfirmInstallmentPaymentRequest {
    pub installment_id: Uuid,
}

#[derive(Deserialize)]
pub struct PsbtQueryParams {
    // fee rate in sats/vbyte
    pub fee_rate: u64,
}

#[derive(Debug, Deserialize, sqlx::Type, Serialize, Clone, ToSchema, PartialEq)]
#[sqlx(type_name = "transaction_type")]
pub enum TransactionType {
    Funding,
    Dispute,
    PrincipalGiven,
    InstallmentPaid,
    Liquidation,
    Defaulted,
    ClaimCollateral,
}

#[derive(Debug, Deserialize, Serialize, sqlx::FromRow, ToSchema)]
pub struct LoanTransaction {
    pub id: i64,
    pub txid: String,
    pub contract_id: String,
    pub transaction_type: TransactionType,
    #[serde(with = "time::serde::rfc3339")]
    pub timestamp: OffsetDateTime,
}

/// Origination fee when establishing a new loan depends on the loan length.
#[derive(Debug, Deserialize, Serialize, Clone, ToSchema)]
pub struct OriginationFee {
    /// Loans starting from this are considered, i.e. `>=from_day`
    pub from_day: i32,
    /// Loans smaller than this are considered, i.e. `<to_day`
    pub to_day: i32,
    /// Fee expressed as a number between 0 and 1, e.g. 0.01 = 1%
    #[serde(with = "rust_decimal::serde::float")]
    pub fee: Decimal,
}

impl OriginationFee {
    pub fn is_relevant(&self, contract_duration: i32) -> bool {
        self.from_day <= contract_duration && self.to_day > contract_duration
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct BorrowerLoanFeature {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct BorrowerLoanFeatureResponse {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FilteredUser {
    pub id: String,
    pub name: String,
    pub email: String,
    pub verified: bool,
    pub used_referral_code: Option<String>,
    pub personal_referral_codes: Vec<PersonalReferralCodeResponse>,
    pub timezone: Option<String>,
    pub locale: Option<String>,
    pub personal_telegram_token: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub first_time_discount_rate: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PersonalReferralCodeResponse {
    pub code: String,
    pub active: bool,
    #[serde(with = "rust_decimal::serde::float")]
    pub first_time_discount_rate_referee: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub first_time_commission_rate_referrer: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub commission_rate_referrer: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub expires_at: OffsetDateTime,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MeResponse {
    pub enabled_features: Vec<BorrowerLoanFeatureResponse>,
    pub user: FilteredUser,
}

impl From<PersonalReferralCode> for PersonalReferralCodeResponse {
    fn from(value: PersonalReferralCode) -> Self {
        PersonalReferralCodeResponse {
            code: value.code,
            active: value.active,
            first_time_discount_rate_referee: value.first_time_discount_rate_referee,
            first_time_commission_rate_referrer: value.first_time_commission_rate_referrer,
            commission_rate_referrer: value.commission_rate_referrer,
            created_at: value.created_at,
            expires_at: value.expires_at,
        }
    }
}

impl FilteredUser {
    pub fn new_user(
        user: &Borrower,
        password_auth_info: &PasswordAuth,
        personal_telegram_token: crate::db::telegram_bot::TelegramBotToken,
    ) -> Self {
        let created_at_utc = user.created_at;
        let updated_at_utc = user.updated_at;
        Self {
            id: user.id.to_string(),
            email: password_auth_info.email.clone(),
            name: user.name.to_owned(),
            verified: password_auth_info.verified,
            used_referral_code: user.used_referral_code.clone(),
            personal_referral_codes: user
                .personal_referral_codes
                .clone()
                .into_iter()
                .map(PersonalReferralCodeResponse::from)
                .collect(),
            first_time_discount_rate: user.first_time_discount_rate_referee.unwrap_or_default(),
            timezone: user.timezone.clone(),
            locale: user.locale.clone(),
            personal_telegram_token: personal_telegram_token.token,
            created_at: created_at_utc,
            updated_at: updated_at_utc,
        }
    }
}

#[derive(Debug)]
pub struct ManualCollateralRecovery {
    pub id: i64,
    pub contract_id: String,
    pub lender_amount: Amount,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LenderFeatureFlag {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_enabled: bool,
}

pub mod lender_feature_flags {
    pub const AUTO_APPROVE_FEATURE_FLAG_ID: &str = "auto_approve";
    pub const KYC_OFFERS_FEATURE_FLAG_ID: &str = "kyc_offers";
}

/// Details needed for the lender to send fiat to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct FiatLoanDetails {
    /// Details for transfers within Europe (generally).
    pub iban_transfer_details: Option<IbanTransferDetails>,
    /// Details for transfers outside Europe (generally).
    pub swift_transfer_details: Option<SwiftTransferDetails>,
    pub bank_name: String,
    pub bank_address: String,
    pub bank_country: String,
    pub purpose_of_remittance: String,
    pub full_name: String,
    pub address: String,
    pub city: String,
    pub post_code: String,
    pub country: String,
    /// Extra information the borrower may want to provide to the lender.
    pub comments: Option<String>,
}

/// Details needed for the lender to send fiat via an IBAN transfer to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct IbanTransferDetails {
    pub iban: String,
    pub bic: Option<String>,
}

/// Details needed for the lender to send fiat via a SWIFT transfer to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct SwiftTransferDetails {
    pub swift_or_bic: String,
    pub account_number: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateApiAccountRequest {
    pub name: String,
    pub email: Option<String>,
    pub timezone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateApiAccountResponse {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub timezone: Option<String>,
    pub api_key: String,
}

/// Calculates the interest for the provided `duration_days`.
///
/// Note: does not compound interest.
pub fn calculate_interest_usd(
    loan_amount_usd: Decimal,
    yearly_interest_rate: Decimal,
    duration_days: u32,
) -> Decimal {
    let daily_interest_rate = daily_interest_rate(yearly_interest_rate);
    let interest_usd = loan_amount_usd * daily_interest_rate * Decimal::from(duration_days);

    interest_usd.round_dp(2)
}

fn daily_interest_rate(yearly_interest_rate: Decimal) -> Decimal {
    yearly_interest_rate / Decimal::from(ONE_YEAR)
}

pub fn usd_to_btc(usd: Decimal, price: Decimal) -> Result<Amount> {
    let owed_amount_btc = usd.checked_div(price).context("Division by zero")?;

    let owed_amount_btc = owed_amount_btc.round_dp(8);
    let owed_amount_btc = owed_amount_btc.to_f64().expect("to fit");
    let owed_amount = Amount::from_btc(owed_amount_btc).expect("to fit");

    Ok(owed_amount)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "repayment_plan")]
pub enum RepaymentPlan {
    /// Lump-sum payment of principal and interest at the end of the loan term.
    Bullet,
    /// Weekly interest payments, plus a final interest-plus-principal payment at the end of the
    /// loan term.
    InterestOnlyWeekly,
    /// Monthly interest payments, plus a final interest-plus-principal payment at the end of the
    /// loan term.
    InterestOnlyMonthly,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone, Copy, PartialEq, Eq, Hash, sqlx::Type)]
pub enum Currency {
    Eur,
    Usd,
}

impl fmt::Display for Currency {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Currency::Eur => f.write_str("Eur"),
            Currency::Usd => f.write_str("Usd"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ONE_MONTH;
    use crate::model::ONE_YEAR;
    use rust_decimal_macros::dec;
    use std::num::NonZeroU64;
    use time::ext::NumericalDuration;

    #[test]
    fn test_calculate_interest_daily() {
        let loan_amount_usd = dec!(1_000);
        let yearly_interest_rate = dec!(0.12);

        let duration_days = 1;
        let amount = calculate_interest_usd(loan_amount_usd, yearly_interest_rate, duration_days);

        let diff = amount - dec!(0.3333);
        assert!(
            diff < dec!(0.0001),
            "interest was {amount} but it was {diff} too high"
        );
    }

    #[test]
    fn test_calculate_interest_yearly() {
        let loan_amount_usd = dec!(1_000);
        let yearly_interest_rate = dec!(0.12);

        let duration_days = ONE_YEAR;
        let amount = calculate_interest_usd(loan_amount_usd, yearly_interest_rate, duration_days);

        let diff = amount - dec!(120);
        assert!(diff < dec!(0.0001), "was {amount}");
    }

    #[test]
    fn test_calculate_interest_15_months() {
        let loan_amount_usd = dec!(1_000);
        let yearly_interest_rate = dec!(0.12);

        let duration_days = ONE_MONTH * 15;
        let amount = calculate_interest_usd(loan_amount_usd, yearly_interest_rate, duration_days);

        let diff = amount - dec!(150);
        assert!(
            diff < dec!(0.0001),
            "interest was {amount} but it was {diff} too high"
        );
    }

    #[test]
    fn test_calculate_lender_liquidation_amount() {
        let duration_days = NonZeroU64::new(ONE_MONTH as u64 * 3).unwrap();
        let yearly_interest_rate = dec!(0.12);
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            OffsetDateTime::now_utc(),
            Uuid::new_v4(),
            RepaymentPlan::Bullet,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::FullLiquidation,
        );

        let outstanding_balance_usd = compute_outstanding_balance(&installments);

        let price = dec!(100_000);
        let outstanding_balance_btc = outstanding_balance_usd.as_btc(price).unwrap();

        assert_eq!(outstanding_balance_btc.total().to_sat(), 1_030_000);

        let duration_days = NonZeroU64::new(ONE_MONTH as u64 * 18).unwrap();
        let yearly_interest_rate = dec!(0.20);
        let loan_amount_usd = dec!(10_000);

        let installments = generate_installments(
            OffsetDateTime::now_utc(),
            Uuid::new_v4(),
            RepaymentPlan::Bullet,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::FullLiquidation,
        );

        let outstanding_balance_usd = compute_outstanding_balance(&installments);

        let price = dec!(50_000);
        let outstanding_balance_btc = outstanding_balance_usd.as_btc(price).unwrap();

        assert_eq!(outstanding_balance_btc.total().to_sat(), 26_000_000);

        let duration_days = NonZeroU64::new(ONE_YEAR as u64).unwrap();
        let yearly_interest_rate = dec!(0.12);
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            OffsetDateTime::now_utc(),
            Uuid::new_v4(),
            RepaymentPlan::Bullet,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::FullLiquidation,
        );

        let outstanding_balance_usd = compute_outstanding_balance(&installments);

        let price = dec!(0);
        let res = outstanding_balance_usd.as_btc(price);

        assert!(res.is_err())
    }

    #[test]
    fn test_extension_request_too_soon() {
        let opened_at = OffsetDateTime::now_utc();
        let now = opened_at + 7.days();

        let contract = Contract {
            duration_days: 30,
            expiry_date: opened_at + 30.days(),
            extension_policy: ExtensionPolicy::AfterHalfway {
                max_duration_days: 30,
                interest_rate: dec!(0.25),
            },
            ..dummy_contract()
        };

        let res = contract.handle_extension_request(now, 30);

        // Requested 7 days in out of 30, too soon.
        assert_eq!(res, Err(ExtensionRequestError::TooSoon));
    }

    #[test]
    fn test_extension_request_valid() {
        let opened_at = OffsetDateTime::now_utc();
        let now = opened_at + 15.days();

        let contract = Contract {
            duration_days: 30,
            expiry_date: opened_at + 30.days(),
            extension_policy: ExtensionPolicy::AfterHalfway {
                max_duration_days: 30,
                interest_rate: dec!(0.25),
            },
            ..dummy_contract()
        };

        let res = contract.handle_extension_request(now, 30);

        // Requested 15 days in out of 30, just right.
        assert_eq!(res, Ok(dec!(0.25)));
    }

    #[test]
    fn test_extension_request_too_many_days() {
        let opened_at = OffsetDateTime::now_utc();
        let now = opened_at + 15.days();

        let contract = Contract {
            duration_days: 30,
            expiry_date: opened_at + 30.days(),
            extension_policy: ExtensionPolicy::AfterHalfway {
                max_duration_days: 30,
                interest_rate: dec!(0.25),
            },
            ..dummy_contract()
        };

        let res = contract.handle_extension_request(now, 31);

        // Requested 31 day extension, too many days.
        assert_eq!(
            res,
            Err(ExtensionRequestError::TooManyDays {
                max_duration_days: 30
            })
        );
    }

    #[test]
    fn test_extension_request_not_allowed() {
        let opened_at = OffsetDateTime::now_utc();
        let now = opened_at + 15.days();

        let contract = Contract {
            duration_days: 30,
            expiry_date: opened_at + 30.days(),
            extension_policy: ExtensionPolicy::DoNotExtend,
            ..dummy_contract()
        };

        let res = contract.handle_extension_request(now, 31);

        assert_eq!(res, Err(ExtensionRequestError::NotAllowed));
    }

    fn dummy_contract() -> Contract {
        Contract {
            id: "1dad3f62-31f1-4483-b6b4-9da0247a49c0".parse().unwrap(),
            lender_id: "0979af4d-9531-4f68-acee-728116477841".parse().unwrap(),
            borrower_id: "00c484d1-a395-4520-a042-b5ac35a0dca0".parse().unwrap(),
            loan_id: "c9da701a-4031-4518-b627-5aa5237808d2".parse().unwrap(),
            initial_ltv: dec!(0.5),
            initial_collateral_sats: 50_000,
            origination_fee_sats: 5_000,
            collateral_sats: 55_000,
            loan_amount: dec!(10_000),
            duration_days: 30,
            expiry_date: datetime!(2030-03-01 0:00 UTC),
            borrower_btc_address: "bc1pravj5kascdk5y3zqa9n0j8yassuaq0axgdj706fmjtmzvfhg02vsqvf25f"
                .parse()
                .unwrap(),
            borrower_pk: "02afddf59ddf612bc0aee80dee376fb5cdf9def3f08863963896f9edbe8f600dda"
                .parse()
                .unwrap(),
            borrower_derivation_path: None,
            lender_pk: "026c06e2bcd10e37dc90f268df3cb54aee4a8b58500e523c53d505b6efa7206c78"
                .parse()
                .unwrap(),
            lender_derivation_path: "m/586/0/0".parse().unwrap(),
            borrower_loan_address: None,
            lender_loan_repayment_address: None,
            lender_btc_loan_repayment_address: None,
            loan_type: LoanType::StableCoin,
            contract_address: None,
            contract_index: None,
            // Relevant for the test.
            borrower_npub: "npub17mx98j4khcynw7cm6m0zfu5q2uv6dqs2lenaq8nfzn8paz5dt4hqs5utwq"
                .parse()
                .unwrap(),
            lender_npub: "npub17mx98j4khcynw7cm6m0zfu5q2uv6dqs2lenaq8nfzn8paz5dt4hqs5utwq"
                .parse()
                .unwrap(),
            status: ContractStatus::PrincipalGiven,
            liquidation_status: LiquidationStatus::Healthy,
            contract_version: ContractVersion::TwoOfThree,
            client_contract_id: None,
            interest_rate: dec!(0.10),
            extension_policy: ExtensionPolicy::DoNotExtend,
            asset: LoanAsset::Usd,
            created_at: datetime!(2025-03-01 0:00 UTC),
            updated_at: datetime!(2025-03-01 0:00 UTC),
        }
    }
}
