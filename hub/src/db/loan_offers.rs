use crate::db::map_to_model_extension_policy;
use crate::model::CreateLoanOfferSchema;
use crate::model::LoanAsset;
use crate::model::LoanOffer;
use crate::model::LoanOfferStatus;
use crate::model::LoanPayout;
use crate::model::RepaymentPlan;
use anyhow::Result;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;
use time::OffsetDateTime;
use url::Url;

pub(crate) async fn load_all_available_loan_offers(
    pool: &Pool<Postgres>,
) -> Result<Vec<LoanOffer>> {
    let rows = sqlx::query!(
        r#"
        SELECT
            lo.id,
            lo.loan_deal_id,
            lo.lender_id,
            lo.name,
            lo.min_ltv,
            lo.interest_rate,
            lo.loan_amount_min,
            lo.loan_amount_max,
            lo.duration_days_min,
            lo.duration_days_max,
            lo.loan_amount_reserve,
            lo.kyc_link,
            lo.auto_accept,
            COALESCE(
                lo.loan_amount_reserve - COALESCE(
                    SUM(
                        CASE
                            WHEN c.status NOT IN ('Cancelled', 'RequestExpired')
                            THEN c.loan_amount
                            ELSE 0
                        END
                    ),
                    0
                ),
                lo.loan_amount_reserve
            ) AS loan_amount_reserve_remaining,
            lo.loan_asset AS "loan_asset: LoanAsset",
            lo.loan_payout AS "loan_payout: LoanPayout",
            lo.status AS "status: LoanOfferStatus",
            lo.loan_repayment_address,
            lo.lender_pk,
            lo.lender_derivation_path,
            lo.lender_npub,
            lo.extension_duration_days,
            lo.extension_interest_rate,
            lo.repayment_plan AS "repayment_plan: RepaymentPlan",
            lo.created_at,
            lo.updated_at
        FROM loan_offers lo
            LEFT JOIN
                contracts c ON lo.id = c.loan_deal_id
        WHERE lo.status = 'Available'
        GROUP BY
            lo.id
        "#,
    )
    .fetch_all(pool)
    .await?;

    // Map the rows to LoanOffer structs
    let loan_offers: Vec<LoanOffer> = rows
        .into_iter()
        .filter_map(|row| -> Option<LoanOffer> {
            // Manually handle the loan_amount_reserve_remaining calculation
            let loan_amount_reserve_remaining: Option<Decimal> = row
                .loan_amount_reserve_remaining
                .map(|v| Decimal::from_str(&v.to_string()).unwrap_or(row.loan_amount_max));

            let loan_amount_reserve_remaining =
                loan_amount_reserve_remaining.unwrap_or(row.loan_amount_reserve);
            // If no reserve is remaining, the loan is not available anymore
            if loan_amount_reserve_remaining < row.loan_amount_min {
                return None;
            }
            // The max amount a user can take is the smaller value of either the reserve or the max
            // defined loan amount
            let loan_amount_max = row.loan_amount_max.min(loan_amount_reserve_remaining);

            let extension_policy = map_to_model_extension_policy(
                row.extension_duration_days,
                row.extension_interest_rate,
            );

            Some(LoanOffer {
                loan_deal_id: row.loan_deal_id,
                lender_id: row.lender_id,
                name: row.name,
                min_ltv: row.min_ltv,
                interest_rate: row.interest_rate,
                loan_amount_min: row.loan_amount_min,
                loan_amount_max,
                loan_amount_reserve: row.loan_amount_reserve,
                loan_amount_reserve_remaining,
                duration_days_min: row.duration_days_min,
                duration_days_max: row.duration_days_max,
                loan_asset: row.loan_asset,
                loan_payout: row.loan_payout,
                status: row.status,
                loan_repayment_address: row.loan_repayment_address,
                lender_pk: row.lender_pk.parse().expect("valid PK"),
                lender_derivation_path: row.lender_derivation_path.parse().expect("valid path"),
                auto_accept: row.auto_accept,
                kyc_link: row.kyc_link.map(|l| Url::parse(&l).expect("valid URL")),
                lender_npub: row.lender_npub,
                extension_policy,
                repayment_plan: row.repayment_plan,
                created_at: row.created_at,
                updated_at: row.updated_at,
            })
        })
        .collect();

    Ok(loan_offers)
}

pub async fn load_available_loan_offers_by_lender(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<Vec<LoanOffer>> {
    // This can be optimized with a separate query but I was too lazy
    let all_offers = load_all_loan_offers_by_lender(pool, lender_id).await?;
    let available_offers = all_offers
        .into_iter()
        .filter(|offer| offer.loan_amount_reserve_remaining > dec!(0))
        .filter(|offer| offer.status == LoanOfferStatus::Available)
        .collect();

    Ok(available_offers)
}

pub async fn load_all_loan_offers_by_lender(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<Vec<LoanOffer>> {
    let rows = sqlx::query!(
        r#"
        SELECT
            lo.id,
            lo.loan_deal_id,
            lo.lender_id,
            lo.name,
            lo.min_ltv,
            lo.interest_rate,
            lo.loan_amount_min,
            lo.loan_amount_max,
            lo.duration_days_min,
            lo.duration_days_max,
            lo.loan_amount_reserve,
            COALESCE(
                lo.loan_amount_reserve - COALESCE(
                    SUM(
                        CASE
                            WHEN c.status NOT IN ('Cancelled', 'RequestExpired')
                            THEN c.loan_amount
                            ELSE 0
                        END
                    ),
                    0
                ),
                lo.loan_amount_reserve
            ) AS loan_amount_reserve_remaining,
            lo.loan_asset AS "loan_asset: LoanAsset",
            lo.loan_payout AS "loan_payout: LoanPayout",
            lo.status AS "status: LoanOfferStatus",
            lo.loan_repayment_address,
            lo.lender_pk,
            lo.lender_derivation_path,
            lo.auto_accept,
            lo.kyc_link,
            lo.lender_npub,
            lo.extension_duration_days,
            lo.extension_interest_rate,
            lo.repayment_plan AS "repayment_plan: RepaymentPlan",
            lo.created_at,
            lo.updated_at
        FROM loan_offers lo
            LEFT JOIN
                contracts c ON lo.id = c.loan_deal_id
        WHERE lo.lender_id = $1
        GROUP BY
            lo.id
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    // Map the rows to LoanOffer structs
    let loan_offers: Vec<LoanOffer> = rows
        .into_iter()
        .map(|row| -> LoanOffer {
            // Manually handle the loan_amount_reserve_remaining calculation
            let loan_amount_reserve_remaining: Option<Decimal> = row
                .loan_amount_reserve_remaining
                .map(|v| Decimal::from_str(&v.to_string()).unwrap_or(row.loan_amount_max));

            let extension_policy = map_to_model_extension_policy(
                row.extension_duration_days,
                row.extension_interest_rate,
            );

            LoanOffer {
                loan_deal_id: row.loan_deal_id,
                lender_id: row.lender_id,
                name: row.name,
                min_ltv: row.min_ltv,
                interest_rate: row.interest_rate,
                loan_amount_min: row.loan_amount_min,
                loan_amount_max: row.loan_amount_max,
                loan_amount_reserve: row.loan_amount_reserve,
                loan_amount_reserve_remaining: loan_amount_reserve_remaining
                    .unwrap_or(row.loan_amount_reserve),
                duration_days_min: row.duration_days_min,
                duration_days_max: row.duration_days_max,
                loan_asset: row.loan_asset,
                loan_payout: row.loan_payout,
                status: row.status,
                loan_repayment_address: row.loan_repayment_address,
                lender_pk: row.lender_pk.parse().expect("valid PK"),
                lender_derivation_path: row.lender_derivation_path.parse().expect("valid path"),
                auto_accept: row.auto_accept,
                kyc_link: row.kyc_link.map(|l| Url::parse(&l).expect("valid URL")),
                lender_npub: row.lender_npub,
                extension_policy,
                repayment_plan: row.repayment_plan,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }
        })
        .collect();

    Ok(loan_offers)
}

pub async fn get_loan_offer_by_lender_and_offer_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
    offer_id: &str,
) -> Result<LoanOffer> {
    let row = sqlx::query!(
        r#"
        SELECT
            lo.id,
            lo.loan_deal_id,
            lo.lender_id,
            lo.name,
            lo.min_ltv,
            lo.interest_rate,
            lo.loan_amount_min,
            lo.loan_amount_max,
            lo.duration_days_min,
            lo.duration_days_max,
            lo.loan_amount_reserve,
            COALESCE(
                lo.loan_amount_reserve - COALESCE(
                    SUM(
                        CASE
                            WHEN c.status NOT IN ('Cancelled', 'RequestExpired')
                            THEN c.loan_amount
                            ELSE 0
                        END
                    ),
                    0
                ),
                lo.loan_amount_reserve
            ) AS loan_amount_reserve_remaining,
            lo.loan_asset AS "loan_asset: LoanAsset",
            lo.loan_payout AS "loan_payout: LoanPayout",
            lo.status AS "status: LoanOfferStatus",
            lo.loan_repayment_address,
            lo.lender_pk,
            lo.lender_derivation_path,
            lo.auto_accept,
            lo.kyc_link,
            lo.lender_npub,
            lo.extension_duration_days,
            lo.extension_interest_rate,
            lo.repayment_plan AS "repayment_plan: RepaymentPlan",
            lo.created_at,
            lo.updated_at
        FROM loan_offers lo
            LEFT JOIN
                contracts c ON lo.id = c.loan_deal_id
        WHERE lo.lender_id = $1 and lo.id = $2
        GROUP BY
            lo.id
        "#,
        lender_id,
        offer_id
    )
    .fetch_one(pool)
    .await?;

    // Manually handle the fields and create the LoanOffer struct
    let loan_amount_reserve_remaining: Option<Decimal> = row
        .loan_amount_reserve_remaining
        .map(|v| Decimal::from_str(&v.to_string()).unwrap_or(row.loan_amount_max));

    let extension_policy =
        map_to_model_extension_policy(row.extension_duration_days, row.extension_interest_rate);

    let loan_offer = LoanOffer {
        loan_deal_id: row.loan_deal_id,
        lender_id: row.lender_id,
        name: row.name,
        min_ltv: row.min_ltv,
        interest_rate: row.interest_rate,
        loan_amount_min: row.loan_amount_min,
        loan_amount_max: row.loan_amount_max,
        loan_amount_reserve: row.loan_amount_reserve,
        loan_amount_reserve_remaining: loan_amount_reserve_remaining
            .unwrap_or(row.loan_amount_reserve),
        duration_days_min: row.duration_days_min,
        duration_days_max: row.duration_days_max,
        loan_asset: row.loan_asset,
        loan_payout: row.loan_payout,
        status: row.status,
        loan_repayment_address: row.loan_repayment_address,
        lender_pk: row.lender_pk.parse().expect("valid PK"),
        lender_derivation_path: row.lender_derivation_path.parse().expect("valid path"),
        auto_accept: row.auto_accept,
        kyc_link: row.kyc_link.map(|l| Url::parse(&l).expect("valid URL")),
        lender_npub: row.lender_npub,
        extension_policy,
        repayment_plan: row.repayment_plan,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok(loan_offer)
}

pub async fn mark_as_deleted_by_lender_and_offer_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
    offer_id: &str,
) -> Result<()> {
    sqlx::query_as!(
        LoanOffer,
        r#"
        UPDATE loan_offers set
            status = $1,
            updated_at = $2
        WHERE lender_id = $3 and id = $4
        "#,
        LoanOfferStatus::Deleted as LoanOfferStatus,
        OffsetDateTime::now_utc(),
        lender_id,
        offer_id
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_loan_offer(
    pool: &Pool<Postgres>,
    offer: CreateLoanOfferSchema,
    lender_id: &str,
) -> Result<LoanOffer> {
    let mut tx = pool.begin().await?;

    let id = uuid::Uuid::new_v4().to_string();
    let status = LoanOfferStatus::Available;

    // We choose a safe default value of 20% if the extension interest rate is not specified.
    let extension_interest_rate = offer.extension_interest_rate.unwrap_or(dec!(0.20));

    // First, insert the loan deal.
    sqlx::query!(
        r#"
        INSERT INTO loan_deals (
          id,
          type
        )
        VALUES ($1, 'offer')
        "#,
        id,
    )
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query!(
        r#"
        INSERT INTO loan_offers (
          id,
          loan_deal_id,
          lender_id,
          name,
          min_ltv,
          interest_rate,
          loan_amount_min,
          loan_amount_max,
          loan_amount_reserve,
          duration_days_min,
          duration_days_max,
          loan_asset,
          loan_payout,
          status,
          loan_repayment_address,
          lender_pk,
          lender_derivation_path,
          auto_accept,
          kyc_link,
          lender_npub,
          extension_duration_days,
          extension_interest_rate,
          repayment_plan
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING
          id,
          loan_deal_id,
          lender_id,
          name,
          min_ltv,
          interest_rate,
          loan_amount_min,
          loan_amount_max,
          loan_amount_reserve,
          loan_amount_reserve as loan_amount_reserve_remaining,
          duration_days_min,
          duration_days_max,
          loan_asset AS "loan_asset: LoanAsset",
          loan_payout AS "loan_payout: LoanPayout",
          status AS "status: crate::model::LoanOfferStatus",
          loan_repayment_address,
          lender_pk,
          lender_derivation_path,
          auto_accept,
          kyc_link,
          lender_npub,
          extension_duration_days,
          extension_interest_rate,
          repayment_plan AS "repayment_plan: RepaymentPlan",
          created_at,
          updated_at
        "#,
        id,
        id,
        lender_id,
        offer.name,
        offer.min_ltv,
        offer.interest_rate,
        offer.loan_amount_min,
        offer.loan_amount_max,
        offer.loan_amount_reserve,
        offer.duration_days_min,
        offer.duration_days_max,
        offer.loan_asset as LoanAsset,
        offer.loan_payout as LoanPayout,
        status as LoanOfferStatus,
        offer.loan_repayment_address,
        offer.lender_pk.to_string(),
        offer.lender_derivation_path.to_string(),
        offer.auto_accept,
        offer.kyc_link.map(|l| l.to_string()),
        offer.lender_npub,
        offer.extension_duration_days.unwrap_or_default() as i32,
        extension_interest_rate,
        offer.repayment_plan as RepaymentPlan,
    )
    .fetch_one(&mut *tx)
    .await?;

    // Commit the transaction
    tx.commit().await?;

    let extension_policy =
        map_to_model_extension_policy(row.extension_duration_days, row.extension_interest_rate);

    let loan_offer = LoanOffer {
        loan_deal_id: row.loan_deal_id,
        lender_id: row.lender_id,
        name: row.name,
        min_ltv: row.min_ltv,
        interest_rate: row.interest_rate,
        loan_amount_min: row.loan_amount_min,
        loan_amount_max: row.loan_amount_max,
        loan_amount_reserve: row.loan_amount_reserve,
        loan_amount_reserve_remaining: row.loan_amount_reserve_remaining,
        duration_days_min: row.duration_days_min,
        duration_days_max: row.duration_days_max,
        loan_asset: row.loan_asset,
        loan_payout: row.loan_payout,
        status: row.status,
        loan_repayment_address: row.loan_repayment_address,
        lender_pk: row.lender_pk.parse().expect("valid PK"),
        lender_derivation_path: row.lender_derivation_path.parse().expect("valid path"),
        auto_accept: row.auto_accept,
        kyc_link: row.kyc_link.map(|l| Url::parse(&l).expect("valid URL")),
        lender_npub: row.lender_npub,
        extension_policy,
        repayment_plan: row.repayment_plan,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok(loan_offer)
}

pub(crate) async fn loan_by_id(
    pool: &Pool<Postgres>,
    loan_deal_id: &str,
) -> Result<Option<LoanOffer>> {
    let row = sqlx::query!(
        r#"
        SELECT
            lo.id,
            lo.loan_deal_id,
            lo.lender_id,
            lo.name,
            lo.min_ltv,
            lo.interest_rate,
            lo.loan_amount_min,
            lo.loan_amount_max,
            lo.duration_days_min,
            lo.duration_days_max,
            lo.loan_amount_reserve,
            COALESCE(
                lo.loan_amount_reserve - COALESCE(
                    SUM(
                        CASE
                            WHEN c.status NOT IN ('Cancelled', 'RequestExpired')
                            THEN c.loan_amount
                            ELSE 0
                        END
                    ),
                    0
                ),
                lo.loan_amount_reserve
            ) AS loan_amount_reserve_remaining,
            lo.loan_asset AS "loan_asset: LoanAsset",
            lo.loan_payout AS "loan_payout: LoanPayout",
            lo.status AS "status: LoanOfferStatus",
            lo.loan_repayment_address,
            lo.lender_pk,
            lo.lender_derivation_path,
            lo.auto_accept,
            lo.kyc_link,
            lo.lender_npub,
            lo.extension_duration_days,
            lo.extension_interest_rate,
            lo.repayment_plan AS "repayment_plan: RepaymentPlan",
            lo.created_at,
            lo.updated_at
        FROM loan_offers lo
            LEFT JOIN
                contracts c ON lo.id = c.loan_deal_id
        WHERE lo.id = $1
        GROUP BY
            lo.id
    "#,
        loan_deal_id
    )
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        // We need to manually handle the Option<Decimal> for loan_amount_reserve_remaining
        let loan_amount_reserve_remaining: Option<Decimal> = row
            .loan_amount_reserve_remaining
            .map(|v| Decimal::from_str(&v.to_string()).unwrap_or(row.loan_amount_max));

        let extension_policy =
            map_to_model_extension_policy(row.extension_duration_days, row.extension_interest_rate);

        // Map the result into the LoanOffer struct
        let loan_offer = LoanOffer {
            loan_deal_id: row.loan_deal_id,
            lender_id: row.lender_id,
            name: row.name,
            min_ltv: row.min_ltv,
            interest_rate: row.interest_rate,
            loan_amount_min: row.loan_amount_min,
            loan_amount_max: row.loan_amount_max,
            loan_amount_reserve: row.loan_amount_reserve,
            loan_amount_reserve_remaining: loan_amount_reserve_remaining
                .unwrap_or(row.loan_amount_reserve),
            duration_days_min: row.duration_days_min,
            duration_days_max: row.duration_days_max,
            loan_asset: row.loan_asset,
            loan_payout: row.loan_payout,
            status: row.status,
            loan_repayment_address: row.loan_repayment_address,
            lender_pk: row.lender_pk.parse().expect("valid PK"),
            lender_derivation_path: row
                .lender_derivation_path
                .parse()
                .expect("valid derivation path"),
            auto_accept: row.auto_accept,
            kyc_link: row.kyc_link.map(|l| Url::parse(&l).expect("valid URL")),
            lender_npub: row.lender_npub,
            extension_policy,
            repayment_plan: row.repayment_plan,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };

        Ok(Some(loan_offer))
    } else {
        Ok(None)
    }
}

#[derive(sqlx::FromRow)]
pub struct InterestRateStats {
    pub(crate) avg: Decimal,
    pub(crate) min: Decimal,
    pub(crate) max: Decimal,
}

pub async fn calculate_loan_offer_stats(pool: &Pool<Postgres>) -> Result<InterestRateStats> {
    let stats = sqlx::query_as!(
        InterestRateStats,
        r#"SELECT
            AVG(interest_rate) as "avg!: Decimal",
            MIN(interest_rate) as "min!: Decimal",
            MAX(interest_rate) as "max!: Decimal"
        FROM
            loan_offers
        WHERE
            status = 'Available'"#
    )
    .fetch_one(pool)
    .await?;

    Ok(stats)
}

/// Sets loan offers to unavailable based on contract IDs and returns the updated loan offer IDs
pub async fn set_loan_offers_unavailable_by_contract_id(
    pool: &Pool<Postgres>,
    contract_ids: &[String],
) -> Result<Vec<String>, sqlx::Error> {
    let records = sqlx::query!(
        r#"
        UPDATE loan_offers
        SET
            status = 'Unavailable',
            updated_at = CURRENT_TIMESTAMP
        WHERE
            id IN (
                SELECT loan_deal_id
                FROM contracts
                WHERE contracts.id = ANY($1)
            )
        RETURNING id
        "#,
        contract_ids as &[String]
    )
    .fetch_all(pool)
    .await?;

    Ok(records.into_iter().map(|r| r.id).collect())
}
