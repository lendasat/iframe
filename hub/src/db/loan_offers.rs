use crate::db::map_to_model_extension_policy;
use crate::model::CreateLoanOfferSchema;
use crate::model::LoanAsset;
use crate::model::LoanOffer;
use crate::model::LoanOfferStatus;
use crate::model::LoanPayout;
use crate::model::RepaymentPlan;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::Pool;
use sqlx::Postgres;
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
            lo.kyc_link,
            lo.auto_accept,
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
            lo.btc_loan_repayment_address,
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
        .map(|row| {
            let loan_amount_max = row.loan_amount_max;

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
                loan_amount_max,
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
                lender_npub: row.lender_npub.parse().expect("valid npub in database"),
                extension_policy,
                repayment_plan: row.repayment_plan,
                btc_loan_repayment_address: row.btc_loan_repayment_address.map(|addr| {
                    addr.parse::<bitcoin::Address<NetworkUnchecked>>()
                        .expect("valid address")
                        .assume_checked()
                }),
                created_at: row.created_at,
                updated_at: row.updated_at,
            }
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
        .filter(|offer| offer.loan_amount_max > dec!(0))
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
            lo.btc_loan_repayment_address,
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
                lender_npub: row.lender_npub.parse().expect("valid npub in database"),
                extension_policy,
                repayment_plan: row.repayment_plan,
                btc_loan_repayment_address: row.btc_loan_repayment_address.map(|addr| {
                    addr.parse::<bitcoin::Address<NetworkUnchecked>>()
                        .expect("valid address")
                        .assume_checked()
                }),
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
            lo.btc_loan_repayment_address,
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
        lender_npub: row.lender_npub.parse().expect("valid npub in database"),
        extension_policy,
        repayment_plan: row.repayment_plan,
        btc_loan_repayment_address: row.btc_loan_repayment_address.map(|addr| {
            addr.parse::<bitcoin::Address<NetworkUnchecked>>()
                .expect("valid address")
                .assume_checked()
        }),
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

async fn mark_as_deleted_by_lender_and_offer_id_tx(
    tx: &mut sqlx::Transaction<'_, Postgres>,
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
    .execute(&mut **tx)
    .await?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub async fn update_loan_offer(
    pool: &Pool<Postgres>,
    offer_id: &str,
    lender_id: &str,
    name: Option<String>,
    min_ltv: Option<Decimal>,
    interest_rate: Option<Decimal>,
    loan_amount_min: Option<Decimal>,
    loan_amount_max: Option<Decimal>,
    duration_days_min: Option<i32>,
    duration_days_max: Option<i32>,
    auto_accept: Option<bool>,
    loan_repayment_address: Option<String>,
    btc_loan_repayment_address: Option<bitcoin::Address>,
    extension_duration_days: Option<i32>,
    extension_interest_rate: Option<Decimal>,
    kyc_link: Option<String>,
) -> Result<Option<LoanOffer>> {
    let current_offer = get_loan_offer_by_lender_and_offer_id(pool, lender_id, offer_id).await?;

    // Start a transaction
    let mut tx = pool.begin().await?;

    // Mark the old offer as deleted
    mark_as_deleted_by_lender_and_offer_id_tx(&mut tx, lender_id, offer_id).await?;

    // Create new offer with updated values
    let new_name = name.unwrap_or(current_offer.name);
    let new_min_ltv = min_ltv.unwrap_or(current_offer.min_ltv);
    let new_interest_rate = interest_rate.unwrap_or(current_offer.interest_rate);
    let new_loan_amount_min = loan_amount_min.unwrap_or(current_offer.loan_amount_min);
    let new_loan_amount_max = loan_amount_max.unwrap_or(current_offer.loan_amount_max);
    let new_duration_days_min = duration_days_min.unwrap_or(current_offer.duration_days_min);
    let new_duration_days_max = duration_days_max.unwrap_or(current_offer.duration_days_max);
    let new_auto_accept = auto_accept.unwrap_or(current_offer.auto_accept);
    let new_loan_repayment_address =
        loan_repayment_address.unwrap_or(current_offer.loan_repayment_address);
    let new_btc_loan_repayment_address =
        btc_loan_repayment_address.or(current_offer.btc_loan_repayment_address);
    let new_btc_loan_repayment_address =
        new_btc_loan_repayment_address.map(|address| address.to_string());

    // Handle extension fields
    let new_extension_duration_days =
        extension_duration_days.unwrap_or(match current_offer.extension_policy {
            crate::model::ExtensionPolicy::DoNotExtend => 0,
            crate::model::ExtensionPolicy::AfterHalfway {
                max_duration_days, ..
            } => max_duration_days as i32,
        });

    let new_extension_interest_rate =
        extension_interest_rate.unwrap_or_else(|| match current_offer.extension_policy {
            crate::model::ExtensionPolicy::DoNotExtend => dec!(0.20),
            crate::model::ExtensionPolicy::AfterHalfway { interest_rate, .. } => interest_rate,
        });

    let new_kyc_link = kyc_link.or(current_offer.kyc_link.map(|url| url.to_string()));

    let new_id = uuid::Uuid::new_v4().to_string();
    let status = LoanOfferStatus::Available;

    // First, insert the loan deal.
    sqlx::query!(
        r#"
        INSERT INTO loan_deals (
          id,
          type
        )
        VALUES ($1, 'offer')
        "#,
        new_id,
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
          repayment_plan,
          btc_loan_repayment_address
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
          btc_loan_repayment_address,
          created_at,
          updated_at
        "#,
        new_id,
        new_id,
        lender_id,
        new_name,
        new_min_ltv,
        new_interest_rate,
        new_loan_amount_min,
        new_loan_amount_max,
        new_duration_days_min,
        new_duration_days_max,
        current_offer.loan_asset as LoanAsset,
        current_offer.loan_payout as LoanPayout,
        status as LoanOfferStatus,
        new_loan_repayment_address,
        current_offer.lender_pk.to_string(),
        current_offer.lender_derivation_path.to_string(),
        new_auto_accept,
        new_kyc_link,
        current_offer.lender_npub.to_string(),
        // Use new extension values
        new_extension_duration_days,
        new_extension_interest_rate,
        current_offer.repayment_plan as RepaymentPlan,
        new_btc_loan_repayment_address,
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
        lender_npub: row.lender_npub.parse().expect("valid npub in database"),
        extension_policy,
        repayment_plan: row.repayment_plan,
        btc_loan_repayment_address: row.btc_loan_repayment_address.map(|addr| {
            addr.parse::<bitcoin::Address<NetworkUnchecked>>()
                .expect("valid address")
                .assume_checked()
        }),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    Ok(Some(loan_offer))
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
          repayment_plan,
          btc_loan_repayment_address
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
          btc_loan_repayment_address,
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
        offer.lender_npub.to_string(),
        offer.extension_duration_days.unwrap_or_default() as i32,
        extension_interest_rate,
        offer.repayment_plan as RepaymentPlan,
        offer.btc_loan_repayment_address,
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
        lender_npub: row.lender_npub.parse().expect("valid npub in database"),
        extension_policy,
        repayment_plan: row.repayment_plan,
        btc_loan_repayment_address: row.btc_loan_repayment_address.map(|addr| {
            addr.parse::<bitcoin::Address<NetworkUnchecked>>()
                .expect("valid address")
                .assume_checked()
        }),
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
            lo.btc_loan_repayment_address,
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
            lender_npub: row.lender_npub.parse().expect("valid npub in database"),
            extension_policy,
            repayment_plan: row.repayment_plan,
            btc_loan_repayment_address: row.btc_loan_repayment_address.map(|addr| {
                addr.parse::<bitcoin::Address<NetworkUnchecked>>()
                    .expect("valid address")
                    .assume_checked()
            }),
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
