use crate::model::compute_outstanding_balance;
use crate::model::Currency;
use crate::model::ExtensionPolicy;
use crate::model::Installment;
use crate::model::LoanAsset;
use crate::model::LoanType;
use crate::model::Npub;
use crate::utils::calculate_liquidation_price;
use crate::utils::calculate_ltv;
use crate::utils::legacy_calculate_liquidation_price;
use crate::LEGACY_LTV_THRESHOLD_LIQUIDATION;
use crate::LTV_THRESHOLD_LIQUIDATION;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32;
use bitcoin::Address;
use bitcoin::Amount;
use bitcoin::PublicKey;
use enum_iterator::Sequence;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::str::FromStr;
use time::macros::datetime;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;

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

/// Contract status represents the current state of a loan contract.
///
/// ## Contract Status Variants:
///
/// **Requested** - The borrower has sent a contract request based on a loan offer.
///
/// If the lender accepts the contract request, transitions to Accepted.
/// If the lender rejects the contract request, transitions to Rejected.
/// If the request times out, transitions to RequestExpired.
///
/// **Approved** - The lender has accepted the contract request.
///
/// If the borrower funds the Bitcoin collateral contract, transitions to
/// CollateralSeen/CollateralConfirmed. If the borrower takes too long to fund the collateral
/// contract, transitions to ApprovalExpired.
///
/// **CollateralSeen** - The collateral contract has been seen on the blockchain.
///
/// If the collateral contract is confirmed on the blockchain, transitions to CollateralConfirmed.
///
/// **CollateralConfirmed** - The collateral contract has received enough confirmations on the
/// blockchain.
///
/// If the lender disburses the principal, transitions to PrincipalGiven.
/// If the lender fails to disburse the principal in a timely manner, the borrower may raise a
/// dispute, transitioning to DisputeBorrowerStarted.
///
/// **PrincipalGiven** - The lender has disbursed the principal to the borrower. The loan contract
/// is now open.
///
/// From this point onwards, the contract may be: repaid in full (according to the borrower),
/// transitioning to RepaymentProvided; not repaid in time, transitioning to Defaulted;
/// undercollateralized due to a substantial drop in the price of Bitcoin with respect to the
/// opening price, transitioning to Undercollateralized; extended before loan term, transitioning to
/// Extended.
///
/// **RepaymentProvided** - The borrower has repaid the entire outstanding balance to the lender:
/// principal plus interest.
///
/// If the lender confirms the repayment, the contract will transition to RepaymentConfirmed.
/// If the lender does not eventually confirm the repayment, either party may raise a dispute,
/// transitioning to either DisputeBorrowerStarted or DisputeLenderStarted.
///
/// **RepaymentConfirmed** - The lender has confirmed the repayment of the entire outstanding
/// balance: principal plus interest.
///
/// If the borrower claims the collateral, transitions to Closing.
///
/// **Undercollateralized** - The loan contract is not sufficiently collateralized according to the
/// required maximum LTV.
///
/// If the lender liquidates their share of the collateral, transitions to Closing.
/// In theory, the value of the collateral may reduce the LTV enough such that the contract may not
/// be considered undercollateralized anymore.
/// In practice, we do not support this at this stage: if the contract was ever considered
/// undercollateralized, the collateral will be liquidated by the lender.
///
/// **Defaulted** - The borrower failed to pay back the loan before loan term.
///
/// If the lender liquidates their share of the collateral, transitions to Closing.
///
/// **Closing** - The transaction spending the collateral contract outputs has been published on the
/// blockchain, but is not yet confirmed.
///
/// If the spend transaction is confirmed on the blockchain, transitions to Closed.
///
/// **Closed** - The transaction spending the collateral contract outputs has been published and
/// confirmed on the blockchain.
///
/// The loan contract is now closed. This status implies that the borrower paid back the loan.
///
/// **ClosedByLiquidation** - The transaction spending the collateral contract outputs has been
/// published and confirmed on the blockchain.
///
/// The loan contract is now closed. This status indicates that the loan contract was liquidated due
/// to undercollateralization.
///
/// **ClosedByDefaulting** - The transaction spending the collateral contract outputs has been
/// published and confirmed on the blockchain.
///
/// The loan contract is now closed. This status indicates that the loan contract was liquidated
/// because the borrower defaulted on a loan repayment.
///
/// **Extended** - The loan contract was extended before the loan term.
///
/// A new contract was created in place of this one, with status PrincipalGiven. This contract now
/// serves as historical data. The contracts are linked through the extends_contract and
/// extended_by_contract fields of the Contract schema.
///
/// **Rejected** - The contract request was rejected by the lender.
///
/// **DisputeBorrowerStarted** - A dispute has been started by the borrower.
///
/// Once the dispute is resolved, the contract will (in most cases) transition back to the status
/// before the dispute was raised.
///
/// **DisputeLenderStarted** - A dispute has been started by the lender.
///
/// Once the dispute is resolved, the contract will (in most cases) transition back to the status
/// before the dispute was raised.
///
/// **Cancelled** - The contract request has been cancelled by the borrower.
///
/// **RequestExpired** - The contract request has expired because the lender did not respond in
/// time.
///
/// **ApprovalExpired** - The approved contract has expired because the borrower did not
/// collateralize it in time.
///
/// **CollateralRecoverable** - The lender failed to disburse the principal in time after the
/// contract was collateralized.
///
/// The borrower is now able to recover their collateral.
///
/// **ClosedByRecovery** - The transaction spending the collateral contract outputs has been
/// published and confirmed on the blockchain.
///
/// The loan contract is now closed. This status indicates that the loan contract was closed due to
/// the lender never disbursing the principal.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, ToSchema, Sequence)]
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
    /// The lender has accepted the contract request.
    ///
    /// - If the borrower funds the Bitcoin collateral contract, we transition to
    ///   [`ContractStatus::CollateralSeen`] or [`ContractStatus::CollateralConfirmed`].
    ///
    /// - If the borrower takes too long to fund the collateral contract, we transition to
    ///   [`ContractStatus::ApprovalExpired`].
    Approved,
    /// The collateral contract has been seen on the blockchain.
    ///
    /// If the collateral contract is _confirmed_ on the blockchain, we transition to
    /// [`ContractStatus::CollateralConfirmed`].
    CollateralSeen,
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
    /// The contract request has been cancelled by the borrower.
    Cancelled,
    /// The contract request has expired because the lender did not respond in time.
    RequestExpired,
    /// The approved contract has expired because the borrower did not collateralize it in time.
    ApprovalExpired,
    /// The contract has been marked as eligible for collateral recovery by administrators.
    ///
    /// This status is set when the lender fails to disburse the principal after the collateral
    /// has been confirmed. From this status, the borrower can recover their collateral.
    ///
    /// If the borrower recovers the collateral, the contract transitions to
    /// [`ContractStatus::ClosedByRecovery`].
    CollateralRecoverable,
    /// The transaction spending the collateral contract outputs has been published and confirmed
    /// on the blockchain. The loan contract is now closed.
    ///
    /// This status indicates that the borrower recovered their collateral due to the lender's
    /// failure to disburse the principal in a timely manner.
    ClosedByRecovery,
}

impl ContractStatus {
    // We explicitly match against every variant so that adding/removing a variant is a breaking
    // change and we are forced to handle it explicitly.
    fn can_be_checked_for_undercollateralization(&self) -> bool {
        match self {
            ContractStatus::Requested
            | ContractStatus::Approved
            | ContractStatus::CollateralSeen
            | ContractStatus::CollateralConfirmed
            | ContractStatus::RepaymentConfirmed
            | ContractStatus::Closing
            | ContractStatus::Closed
            | ContractStatus::ClosedByLiquidation
            | ContractStatus::ClosedByDefaulting
            | ContractStatus::Extended
            | ContractStatus::Rejected
            | ContractStatus::DisputeLenderStarted
            | ContractStatus::Cancelled
            | ContractStatus::RequestExpired
            | ContractStatus::ApprovalExpired
            | ContractStatus::CollateralRecoverable
            | ContractStatus::ClosedByRecovery => false,
            // We give the borrower the benefit of the doubt. TODO: Ensure that we act fast to
            // ensure that the lender does not lose money.
            ContractStatus::RepaymentProvided => false,
            // Already marked as such.
            ContractStatus::Undercollateralized => false,
            // Already lost control of the collateral for a different reason.
            ContractStatus::Defaulted => false,
            // We guard against this scenario:
            //
            // 1. Borrower repays: contract transitions to `RepaymentProvided`.
            //
            // 2. Lender fails to confirm the payment.
            //
            // 3. Borrower chooses to open a dispute: contract transitions to
            //    `DisputeBorrowerStarted`.
            //
            // 4. The price of Bitcoin falls sufficiently: the borrower gets liquidated even though
            // they already repaid the loan.
            //
            // TODO: This calls for a redesign of the `ContractStatus` enum. The inclusion of the
            // `DisputeX` statuses can be convenient, but it also hides the "true state" of the
            // contract, like it does here.
            ContractStatus::DisputeBorrowerStarted => false,
            ContractStatus::PrincipalGiven => true,
        }
    }

    pub fn can_be_checked_for_undercollateralization_variants() -> impl Iterator<Item = Self> {
        enum_iterator::all::<Self>().filter(|s| s.can_be_checked_for_undercollateralization())
    }
}

impl FromStr for ContractStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "requested" => Ok(ContractStatus::Requested),
            "approved" => Ok(ContractStatus::Approved),
            "collateralseen" | "collateral_seen" => Ok(ContractStatus::CollateralSeen),
            "collateralconfirmed" | "collateral_confirmed" => {
                Ok(ContractStatus::CollateralConfirmed)
            }
            "principalgiven" | "principal_given" => Ok(ContractStatus::PrincipalGiven),
            "repaymentprovided" | "repayment_provided" => Ok(ContractStatus::RepaymentProvided),
            "repaymentconfirmed" | "repayment_confirmed" => Ok(ContractStatus::RepaymentConfirmed),
            "undercollateralized" => Ok(ContractStatus::Undercollateralized),
            "defaulted" => Ok(ContractStatus::Defaulted),
            "closing" => Ok(ContractStatus::Closing),
            "closed" => Ok(ContractStatus::Closed),
            "closedbyliquidation" | "closed_by_liquidation" => {
                Ok(ContractStatus::ClosedByLiquidation)
            }
            "closedbydefaulting" | "closed_by_defaulting" => Ok(ContractStatus::ClosedByDefaulting),
            "extended" => Ok(ContractStatus::Extended),
            "rejected" => Ok(ContractStatus::Rejected),
            "disputeborrowerstarted" | "dispute_borrower_started" => {
                Ok(ContractStatus::DisputeBorrowerStarted)
            }
            "disputelenderstarted" | "dispute_lender_started" => {
                Ok(ContractStatus::DisputeLenderStarted)
            }
            "cancelled" => Ok(ContractStatus::Cancelled),
            "requestexpired" | "request_expired" => Ok(ContractStatus::RequestExpired),
            "approvalexpired" | "approval_expired" => Ok(ContractStatus::ApprovalExpired),
            "collateralrecoverable" | "collateral_recoverable" => {
                Ok(ContractStatus::CollateralRecoverable)
            }
            "closedbyrecovery" | "closed_by_recovery" => Ok(ContractStatus::ClosedByRecovery),
            _ => Err(format!("Invalid contract status: {s}")),
        }
    }
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

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ExtensionRequestError {
    /// Extension is not currently supported for this contract.
    NotAllowed,
    /// Extension will be possible at a later time.
    TooSoon,
    /// Extension is only possible for `max_duration_days`.
    TooManyDays { max_duration_days: u64 },
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    use time::ext::NumericalDuration;
    use time::macros::datetime;

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
