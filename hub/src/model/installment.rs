use crate::model::calculate_interest_usd;
use crate::model::usd_to_btc;
use crate::model::BitcoinInvoiceStatus;
use crate::model::RepaymentPlan;
use crate::model::ONE_MONTH;
use anyhow::bail;
use anyhow::Result;
use bitcoin::Amount;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::num::NonZeroU64;
use time::ext::NumericalStdDuration;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;

/// TODO: For the time being, missing an interest-only installment implies a full liquidation of
/// the collateral. We should eventually work on a policy that allows partial liquidation of the
/// collateral (this has been requested).
#[derive(Debug, Clone)]
pub struct Installment {
    pub id: Uuid,
    pub contract_id: Uuid,
    pub principal: Decimal,
    pub interest: Decimal,
    pub due_date: OffsetDateTime,
    pub status: InstallmentStatus,
    pub late_penalty: LatePenalty,
    pub paid_date: Option<OffsetDateTime>,
    pub payment_id: Option<String>,
}

/// A regular [`Installment`] with optional Bitcoin invoice payment fields.
///
/// The Bitcoin payment fields are present if the installment was paid (or attempted to be paid)
/// with Bitcoin.
#[derive(Debug)]
pub struct InstallmentWithBitcoinInvoice {
    pub installment: Installment,
    pub invoice_id: Option<Uuid>,
    pub invoice_amount_sats: Option<Amount>,
    pub invoice_status: Option<BitcoinInvoiceStatus>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InstallmentStatus {
    /// The installment has not yet been paid.
    Pending,
    /// The installment has been paid, according to the borrower.
    Paid,
    /// The installment has been paid, as confirmed by the lender.
    Confirmed,
    /// The installment was not paid in time.
    Late,
    /// The installment is no longer expected and was never paid.
    Cancelled,
}

/// What happens when the borrower is late to pay an installment.
#[derive(Default, Debug, Clone, Copy, Serialize, Deserialize, ToSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LatePenalty {
    /// The collateral will be liquidated for the full outstanding balance.
    #[default]
    FullLiquidation,
    /// A new installment plan will replace the existing one.
    ///
    /// For example, we may go from a 0-interest bullet loan to 3 monthly installments with
    /// interest.
    InstallmentRestructure,
}

impl Installment {
    pub fn total_amount_due(&self) -> Decimal {
        self.principal + self.interest
    }
}

pub fn generate_installments(
    now: OffsetDateTime,
    contract_id: Uuid,
    plan: RepaymentPlan,
    duration_days: NonZeroU64,
    yearly_interest_rate: Decimal,
    loan_amount_usd: Decimal,
    late_penalty: LatePenalty,
) -> Vec<Installment> {
    if loan_amount_usd <= Decimal::ZERO {
        return Vec::new();
    }

    let duration_days = duration_days.get();

    // Calculate the number of installments, and the number of extra days that do not fit into an
    // installment basket.
    let (installment_count, extra_days, interval_days) = match plan {
        RepaymentPlan::Bullet => (1, 0, duration_days),
        RepaymentPlan::InterestOnlyWeekly => {
            let interval = 7;

            let installment_count = duration_days / interval;
            let extra_days = duration_days % interval;

            (installment_count, extra_days, interval)
        }
        RepaymentPlan::InterestOnlyMonthly => {
            let interval = ONE_MONTH as u64;

            let installment_count = duration_days / interval;
            let extra_days = duration_days % interval;

            (installment_count, extra_days, interval)
        }
    };

    let mut installments = Vec::new();
    for i in 1..installment_count {
        let is_final_installment = false;
        let installment = generate_installment(
            now,
            contract_id,
            interval_days,
            i,
            0,
            yearly_interest_rate,
            loan_amount_usd,
            is_final_installment,
            late_penalty,
        );

        installments.push(installment);
    }

    let is_final_installment = true;
    let balloon_installment = generate_installment(
        now,
        contract_id,
        interval_days,
        installment_count,
        extra_days,
        yearly_interest_rate,
        loan_amount_usd,
        is_final_installment,
        late_penalty,
    );

    installments.push(balloon_installment);

    // Filter out trivial installments.
    installments
        .into_iter()
        .filter(|i| !i.interest.is_zero() || !i.principal.is_zero())
        .collect()
}

#[allow(clippy::too_many_arguments)]
fn generate_installment(
    now: OffsetDateTime,
    contract_id: Uuid,
    interval_days: u64,
    installment_number: u64,
    extra_days: u64,
    yearly_interest_rate: Decimal,
    loan_amount_usd: Decimal,
    is_final_installment: bool,
    late_penalty: LatePenalty,
) -> Installment {
    let due_date = now + (interval_days * installment_number + extra_days).std_days();
    let interest = calculate_interest_usd(
        loan_amount_usd,
        yearly_interest_rate,
        (interval_days + extra_days) as u32,
    );

    let principal = if is_final_installment {
        loan_amount_usd
    } else {
        Default::default()
    };

    Installment {
        id: Uuid::new_v4(),
        contract_id,
        principal,
        interest,
        due_date,
        status: InstallmentStatus::Pending,
        late_penalty,
        paid_date: None,
        payment_id: None,
    }
}

/// What the borrower still owes to the lender, in USD.
#[derive(Clone, Copy, Debug, Default)]
pub struct OutstandingBalanceUsd {
    principal: Decimal,
    interest: Decimal,
}

impl OutstandingBalanceUsd {
    pub fn principal(&self) -> Decimal {
        self.principal
    }

    pub fn interest(&self) -> Decimal {
        self.interest
    }

    pub fn total(&self) -> Decimal {
        self.principal() + self.interest()
    }

    pub fn as_btc(&self, price: Decimal) -> Result<OutstandingBalanceBtc> {
        let principal = usd_to_btc(self.principal, price)?;
        let interest = usd_to_btc(self.interest, price)?;

        Ok(OutstandingBalanceBtc {
            principal,
            interest,
        })
    }
}

/// What the borrower still owes to the lender, in Bitcoin.
#[derive(Clone, Copy, Debug, Default)]
pub struct OutstandingBalanceBtc {
    principal: Amount,
    interest: Amount,
}

impl OutstandingBalanceBtc {
    pub fn principal(&self) -> Amount {
        self.principal
    }

    pub fn interest(&self) -> Amount {
        self.interest
    }

    pub fn total(&self) -> Amount {
        self.principal() + self.interest()
    }
}

/// Calculate what the borrower still owes to the lender, based on the state of the
/// [`Installment`]s.
pub fn compute_outstanding_balance(installments: &[Installment]) -> OutstandingBalanceUsd {
    installments.iter().fold(
        OutstandingBalanceUsd::default(),
        |acc, installment| match installment.status {
            // A `Paid` installment has not yet been confirmed by the lender, so it is still
            // considered outstanding.
            InstallmentStatus::Pending | InstallmentStatus::Paid | InstallmentStatus::Late => {
                OutstandingBalanceUsd {
                    principal: acc.principal + installment.principal,
                    interest: acc.interest + installment.interest,
                }
            }
            InstallmentStatus::Confirmed | InstallmentStatus::Cancelled => acc,
        },
    )
}

/// Calculate the total interest, including paid and owed interest.
pub fn compute_total_interest(installments: &[Installment]) -> Decimal {
    installments
        .iter()
        .fold(Decimal::ZERO, |acc, installment| match installment.status {
            InstallmentStatus::Pending
            | InstallmentStatus::Paid
            | InstallmentStatus::Confirmed
            | InstallmentStatus::Late => acc + installment.interest,

            InstallmentStatus::Cancelled => acc,
        })
}

/// Apply an extension to a set of existing [`Installment`]s.
///
/// Existing installments (excluding the balloon installment) should not be shifted in any way, so
/// that the lender can still rely on this expected income.
pub fn apply_extension_to_installments(
    extension_contract_id: Uuid,
    installments: &[Installment],
    // Only used when extending bullet loans.
    original_duration_days: NonZeroU64,
    extension_duration_days: NonZeroU64,
    extension_yearly_interest_rate: Decimal,
    loan_amount_usd: Decimal,
    // For sanity, the repayment plan for the extension _should_ match the original, but we cannot
    // check that here in general. The caller is responsible for that.
    plan: RepaymentPlan,
) -> Result<Vec<Installment>> {
    // We expect there to be a single (non-cancelled) principal installment in all cases.
    //
    // We are strict here because we want to shift that one balloon installment to the end of the
    // new period.
    if installments
        .iter()
        .filter(|i| !matches!(i.status, InstallmentStatus::Cancelled))
        .filter(|i| i.principal > Decimal::ZERO)
        .take(2)
        .count()
        == 2
    {
        bail!("Cannot extend when more than one existing installment pays principal");
    }

    if installments
        .iter()
        .any(|i| matches!(i.status, InstallmentStatus::Late))
    {
        bail!("Cannot extend due to late installment payment");
    }

    if installments
        .iter()
        .any(|i| matches!(i.status, InstallmentStatus::Paid))
    {
        bail!("Cannot extend due to unconfirmed installment payment");
    }

    let (balloon_index, balloon_installment) = installments
        .iter()
        .enumerate()
        .find(|(_, installment)| installment.principal > Decimal::ZERO)
        .expect("balloon installment");

    if balloon_installment.principal != loan_amount_usd {
        bail!(
            "Cannot extend due to loan amount mismatch: {} != {loan_amount_usd}",
            balloon_installment.principal
        )
    }

    match plan {
        // We handle bullet loans separately because we want to always have a single installment for
        // these.
        RepaymentPlan::Bullet => {
            if installments
                .iter()
                .filter(|i| !matches!(i.status, InstallmentStatus::Cancelled))
                .count()
                != 1
            {
                bail!(
                    "Cannot extend based on bullet repayment plan \
                     with more than one existing installment"
                );
            }

            let original_start_date =
                balloon_installment.due_date - original_duration_days.get().std_days();

            let installments = generate_installments(
                original_start_date,
                extension_contract_id,
                plan,
                original_duration_days
                    .checked_add(extension_duration_days.get())
                    .expect("valid duration"),
                extension_yearly_interest_rate,
                loan_amount_usd,
                LatePenalty::FullLiquidation,
            );

            return Ok(installments);
        }
        RepaymentPlan::InterestOnlyWeekly => {
            if extension_duration_days.get() < 7 {
                bail!("Weekly interest-only loans cannot be extended for less than 7 days");
            }
        }
        RepaymentPlan::InterestOnlyMonthly => {
            if extension_duration_days.get() < ONE_MONTH as u64 {
                bail!(
                    "Monthly interest-only loans cannot be extended for less than {ONE_MONTH} days"
                );
            }
        }
    }

    // We prepare the existing installments to reference the extension contract ID. We will append
    // the extension installments to these.
    let mut installments = installments
        .iter()
        .map(|i| Installment {
            // We give them a new ID so that they can be inserted in the database without any
            // collisions.
            id: Uuid::new_v4(),
            contract_id: extension_contract_id,
            ..i.clone()
        })
        .collect::<Vec<_>>();

    // The principal component of the original balloon installment will be shifted to the new
    // balloon installment.
    installments[balloon_index].principal = Decimal::ZERO;

    let extension_start_date = balloon_installment.due_date;

    let mut extension_installments = generate_installments(
        extension_start_date,
        extension_contract_id,
        plan,
        extension_duration_days,
        extension_yearly_interest_rate,
        loan_amount_usd,
        LatePenalty::FullLiquidation,
    );

    installments.append(&mut extension_installments);

    Ok(installments)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::RepaymentPlan;
    use insta::assert_debug_snapshot;
    use insta::with_settings;
    use rust_decimal_macros::dec;
    use time::macros::datetime;

    #[test]
    fn test_generate_installments_bullet() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::Bullet;
        let duration_days = NonZeroU64::new(30).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });
    }

    #[test]
    fn test_generate_installments_interest_only_weekly() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyWeekly;
        let duration_days = NonZeroU64::new(30).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });
    }

    #[test]
    fn test_generate_installments_interest_only_monthly() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyMonthly;
        let duration_days = NonZeroU64::new(60).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });
    }

    #[test]
    fn test_generate_installments_interest_only_weekly_single_installment() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyWeekly;
        let duration_days = NonZeroU64::new(13).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });
    }

    #[test]
    fn test_generate_installments_interest_only_monthly_single_installment() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyMonthly;
        let duration_days = NonZeroU64::new(37).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });
    }

    #[test]
    fn test_generate_installments_interest_zero() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyWeekly;
        let duration_days = NonZeroU64::new(14).unwrap();
        let yearly_interest_rate = Decimal::ZERO;
        let loan_amount_usd = dec!(1_000);

        let installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });
    }

    #[test]
    fn test_generate_installments_loan_amount_zero() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyWeekly;
        let duration_days = NonZeroU64::new(14).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = Decimal::ZERO;

        let installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });
    }

    #[test]
    fn test_extend_installments_bullet() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let contract_id = "1cabfa80-2756-4389-8549-130abf1b3368".parse().unwrap();
        let plan = RepaymentPlan::Bullet;
        let original_duration_days = NonZeroU64::new(30).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let original_installments = generate_installments(
            now,
            contract_id,
            plan,
            original_duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        let extension_contract_id = "d403c9b8-c05f-4f24-9395-3f60817174c1".parse().unwrap();
        let extension_duration_days = NonZeroU64::new(20).unwrap();
        let extension_yearly_interest_rate = dec!(0.08);

        let installments = apply_extension_to_installments(
            extension_contract_id,
            &original_installments,
            original_duration_days,
            extension_duration_days,
            extension_yearly_interest_rate,
            loan_amount_usd,
            plan,
        )
        .unwrap();

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });

        assert!(installments
            .iter()
            .all(|i| i.contract_id == extension_contract_id));
    }

    #[test]
    fn test_extend_installments_interest_only_weekly() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyWeekly;
        let original_duration_days = NonZeroU64::new(28).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let original_installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            original_duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        let extension_contract_id = "d403c9b8-c05f-4f24-9395-3f60817174c1".parse().unwrap();
        let extension_duration_days = NonZeroU64::new(14).unwrap();
        let extension_yearly_interest_rate = dec!(0.05);

        let installments = apply_extension_to_installments(
            extension_contract_id,
            &original_installments,
            original_duration_days,
            extension_duration_days,
            extension_yearly_interest_rate,
            loan_amount_usd,
            plan,
        )
        .unwrap();

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });

        assert!(installments
            .iter()
            .all(|i| i.contract_id == extension_contract_id));
    }

    #[test]
    fn test_extend_installments_interest_only_monthly() {
        let now = datetime!(2025-05-22 0:00 UTC);

        let plan = RepaymentPlan::InterestOnlyMonthly;
        let original_duration_days = NonZeroU64::new(60).unwrap();
        let yearly_interest_rate = dec!(0.05);
        let loan_amount_usd = dec!(1_000);

        let original_installments = generate_installments(
            now,
            Uuid::new_v4(),
            plan,
            original_duration_days,
            yearly_interest_rate,
            loan_amount_usd,
            LatePenalty::default(),
        );

        let extension_contract_id = "d403c9b8-c05f-4f24-9395-3f60817174c1".parse().unwrap();
        let extension_duration_days = NonZeroU64::new(90).unwrap();
        let extension_yearly_interest_rate = dec!(0.10);

        let installments = apply_extension_to_installments(
            extension_contract_id,
            &original_installments,
            original_duration_days,
            extension_duration_days,
            extension_yearly_interest_rate,
            loan_amount_usd,
            plan,
        )
        .unwrap();

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });

        assert!(installments
            .iter()
            .all(|i| i.contract_id == extension_contract_id));
    }

    #[test]
    fn test_extend_multiple_principal_installments() {
        let multiple_principal_installments = vec![
            Installment {
                id: Uuid::new_v4(),
                contract_id: Uuid::new_v4(),
                principal: dec!(1_000),
                interest: dec!(10),
                due_date: datetime!(2025-05-22 0:00 UTC),
                status: InstallmentStatus::Pending,
                late_penalty: LatePenalty::FullLiquidation,
                paid_date: None,
                payment_id: None,
            },
            Installment {
                id: Uuid::new_v4(),
                contract_id: Uuid::new_v4(),
                principal: dec!(1_000),
                interest: dec!(10),
                due_date: datetime!(2025-05-29 0:00 UTC),
                status: InstallmentStatus::Pending,
                late_penalty: LatePenalty::FullLiquidation,
                paid_date: None,
                payment_id: None,
            },
        ];

        let res = apply_extension_to_installments(
            Uuid::new_v4(),
            &multiple_principal_installments,
            NonZeroU64::new(14).unwrap(),
            NonZeroU64::new(14).unwrap(),
            dec!(0.10),
            dec!(1_000),
            RepaymentPlan::InterestOnlyWeekly,
        );

        assert!(res.is_err());
    }

    #[test]
    fn test_extend_principal_mismatch() {
        let installments = vec![Installment {
            id: Uuid::new_v4(),
            contract_id: Uuid::new_v4(),
            principal: dec!(1_000),
            interest: dec!(10),
            due_date: datetime!(2025-05-22 0:00 UTC),
            status: InstallmentStatus::Pending,
            late_penalty: LatePenalty::FullLiquidation,
            paid_date: None,
            payment_id: None,
        }];

        let res = apply_extension_to_installments(
            Uuid::new_v4(),
            &installments,
            NonZeroU64::new(7).unwrap(),
            NonZeroU64::new(14).unwrap(),
            dec!(0.10),
            dec!(2_000),
            RepaymentPlan::InterestOnlyWeekly,
        );

        assert!(res.is_err());
    }

    #[test]
    fn test_extend_late_installment() {
        let installments = vec![Installment {
            id: Uuid::new_v4(),
            contract_id: Uuid::new_v4(),
            principal: dec!(1_000),
            interest: dec!(10),
            due_date: datetime!(2025-05-22 0:00 UTC),
            status: InstallmentStatus::Late,
            late_penalty: LatePenalty::FullLiquidation,
            paid_date: None,
            payment_id: None,
        }];

        let res = apply_extension_to_installments(
            Uuid::new_v4(),
            &installments,
            NonZeroU64::new(7).unwrap(),
            NonZeroU64::new(14).unwrap(),
            dec!(0.10),
            dec!(1_000),
            RepaymentPlan::InterestOnlyWeekly,
        );

        assert!(res.is_err());
    }

    #[test]
    fn test_extend_unconfirmed_installment() {
        let installments = vec![Installment {
            id: Uuid::new_v4(),
            contract_id: Uuid::new_v4(),
            principal: dec!(1_000),
            interest: dec!(10),
            due_date: datetime!(2025-05-22 0:00 UTC),
            status: InstallmentStatus::Paid,
            late_penalty: LatePenalty::FullLiquidation,
            paid_date: None,
            payment_id: None,
        }];

        let res = apply_extension_to_installments(
            Uuid::new_v4(),
            &installments,
            NonZeroU64::new(7).unwrap(),
            NonZeroU64::new(14).unwrap(),
            dec!(0.10),
            dec!(1_000),
            RepaymentPlan::InterestOnlyWeekly,
        );

        assert!(res.is_err());
    }

    #[test]
    fn test_extend_with_cancelled_and_confirmed_installment() {
        let contract_id = Uuid::new_v4();

        let original_installments = vec![
            Installment {
                id: Uuid::new_v4(),
                contract_id,
                principal: Decimal::ZERO,
                interest: dec!(10),
                due_date: datetime!(2025-05-22 0:00 UTC),
                status: InstallmentStatus::Cancelled,
                late_penalty: LatePenalty::FullLiquidation,
                paid_date: None,
                payment_id: None,
            },
            Installment {
                id: Uuid::new_v4(),
                contract_id,
                principal: Decimal::ZERO,
                interest: dec!(10),
                due_date: datetime!(2025-05-22 0:00 UTC),
                status: InstallmentStatus::Confirmed,
                late_penalty: LatePenalty::FullLiquidation,
                paid_date: None,
                payment_id: None,
            },
            Installment {
                id: Uuid::new_v4(),
                contract_id,
                principal: dec!(1_000),
                interest: dec!(10),
                due_date: datetime!(2025-05-29 0:00 UTC),
                status: InstallmentStatus::Pending,
                late_penalty: LatePenalty::FullLiquidation,
                paid_date: None,
                payment_id: None,
            },
        ];

        let extension_contract_id = "d403c9b8-c05f-4f24-9395-3f60817174c1".parse().unwrap();

        let installments = apply_extension_to_installments(
            extension_contract_id,
            &original_installments,
            NonZeroU64::new(14).unwrap(),
            NonZeroU64::new(14).unwrap(),
            dec!(0.10),
            dec!(1_000),
            RepaymentPlan::InterestOnlyWeekly,
        )
        .unwrap();

        with_settings!({filters => vec![
            (r"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
                "[UUID]"),
        ]}, {
            assert_debug_snapshot!(installments);
        });

        assert!(installments
            .iter()
            .all(|i| i.contract_id == extension_contract_id));
    }

    #[test]
    fn test_extend_bullet_loan_with_multiple_installments() {
        let installments = vec![
            Installment {
                id: Uuid::new_v4(),
                contract_id: Uuid::new_v4(),
                principal: Decimal::ZERO,
                interest: dec!(10),
                due_date: datetime!(2025-05-22 0:00 UTC),
                status: InstallmentStatus::Confirmed,
                late_penalty: LatePenalty::FullLiquidation,
                paid_date: None,
                payment_id: None,
            },
            Installment {
                id: Uuid::new_v4(),
                contract_id: Uuid::new_v4(),
                principal: dec!(1_000),
                interest: dec!(10),
                due_date: datetime!(2025-05-29 0:00 UTC),
                status: InstallmentStatus::Pending,
                late_penalty: LatePenalty::FullLiquidation,
                paid_date: None,
                payment_id: None,
            },
        ];

        let res = apply_extension_to_installments(
            Uuid::new_v4(),
            &installments,
            NonZeroU64::new(14).unwrap(),
            NonZeroU64::new(28).unwrap(),
            dec!(0.10),
            dec!(1_000),
            RepaymentPlan::Bullet,
        );

        assert!(res.is_err());
    }

    #[test]
    fn test_extend_interest_only_weekly_less_than_7_days() {
        let installments = vec![Installment {
            id: Uuid::new_v4(),
            contract_id: Uuid::new_v4(),
            principal: dec!(1_000),
            interest: dec!(10),
            due_date: datetime!(2025-05-22 0:00 UTC),
            status: InstallmentStatus::Pending,
            late_penalty: LatePenalty::FullLiquidation,
            paid_date: None,
            payment_id: None,
        }];

        let res = apply_extension_to_installments(
            Uuid::new_v4(),
            &installments,
            NonZeroU64::new(7).unwrap(),
            NonZeroU64::new(5).unwrap(),
            dec!(0.10),
            dec!(1_000),
            RepaymentPlan::InterestOnlyWeekly,
        );

        assert!(res.is_err());
    }

    #[test]
    fn test_extend_interest_only_monthly_less_than_30_days() {
        let installments = vec![Installment {
            id: Uuid::new_v4(),
            contract_id: Uuid::new_v4(),
            principal: dec!(1_000),
            interest: dec!(10),
            due_date: datetime!(2025-05-22 0:00 UTC),
            status: InstallmentStatus::Pending,
            late_penalty: LatePenalty::FullLiquidation,
            paid_date: None,
            payment_id: None,
        }];

        let res = apply_extension_to_installments(
            Uuid::new_v4(),
            &installments,
            NonZeroU64::new(30).unwrap(),
            NonZeroU64::new(28).unwrap(),
            dec!(0.10),
            dec!(1_000),
            RepaymentPlan::InterestOnlyMonthly,
        );

        assert!(res.is_err());
    }
}
