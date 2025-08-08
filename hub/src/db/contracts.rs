use crate::db::contract_emails;
use crate::db::loan_deals;
use crate::db::map_to_db_extension_policy;
use crate::expiry::expiry_date;
use crate::model::db;
use crate::model::Contract;
use crate::model::ContractStatus;
use crate::model::ContractVersion;
use crate::model::Currency;
use crate::model::ExtensionPolicy;
use crate::model::LoanAsset;
use crate::model::LoanType;
use crate::model::Npub;
use anyhow::bail;
use anyhow::Context;
use anyhow::Error;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use bitcoin::bip32;
use bitcoin::Address;
use bitcoin::PublicKey;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use std::cmp::Ordering;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SortOptions {
    pub field: String,
    pub order: String,
}

impl Default for SortOptions {
    fn default() -> Self {
        Self {
            field: "created_at".to_string(),
            order: "DESC".to_string(),
        }
    }
}

pub async fn load_contracts_by_borrower_id(
    pool: &Pool<Postgres>,
    id: &str,
) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        FROM contracts
        where borrower_id = $1
        "#,
        id
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn count_contracts_by_borrower_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<u64> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as count
        FROM contracts
        WHERE borrower_id = $1
        "#,
        borrower_id
    )
    .fetch_one(pool)
    .await?;

    Ok(count.unwrap_or(0) as u64)
}

pub async fn count_contracts_by_borrower_id_and_statuses(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    statuses: &[ContractStatus],
) -> Result<u64> {
    if statuses.is_empty() {
        return count_contracts_by_borrower_id(pool, borrower_id).await;
    }

    let statuses: Vec<db::ContractStatus> = statuses
        .iter()
        .map(|s| db::ContractStatus::from(*s))
        .collect();

    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as count
        FROM contracts
        WHERE borrower_id = $1 AND status = ANY($2::contract_status[])
        "#,
        borrower_id,
        statuses as Vec<db::ContractStatus>
    )
    .fetch_one(pool)
    .await?;

    Ok(count.unwrap_or(0) as u64)
}

pub async fn load_contracts_by_borrower_id_paginated(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    limit: u32,
    offset: u32,
) -> Result<Vec<Contract>> {
    load_contracts_by_borrower_id_paginated_with_sort(
        pool,
        borrower_id,
        limit,
        offset,
        &SortOptions::default(),
    )
    .await
}

pub async fn load_contracts_by_borrower_id_paginated_with_sort(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    limit: u32,
    offset: u32,
    sort_options: &SortOptions,
) -> Result<Vec<Contract>> {
    // Build the dynamic query with sort options
    let query_str = format!(
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type,
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status,
            liquidation_status,
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset,
            created_at,
            updated_at
        FROM contracts
        WHERE borrower_id = $1
        ORDER BY {} {}
        LIMIT $2 OFFSET $3
        "#,
        sort_options.field, sort_options.order
    );

    let contracts: Vec<db::Contract> = sqlx::query(&query_str)
        .bind(borrower_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .try_map(|row: sqlx::postgres::PgRow| {
            use sqlx::Row;
            Ok(db::Contract {
                id: row.try_get("id")?,
                lender_id: row.try_get("lender_id")?,
                borrower_id: row.try_get("borrower_id")?,
                loan_deal_id: row.try_get("loan_deal_id")?,
                initial_ltv: row.try_get("initial_ltv")?,
                initial_collateral_sats: row.try_get("initial_collateral_sats")?,
                origination_fee_sats: row.try_get("origination_fee_sats")?,
                collateral_sats: row.try_get("collateral_sats")?,
                loan_amount: row.try_get("loan_amount")?,
                borrower_btc_address: row.try_get("borrower_btc_address")?,
                borrower_pk: row.try_get("borrower_pk")?,
                borrower_derivation_path: row.try_get("borrower_derivation_path")?,
                lender_pk: row.try_get("lender_pk")?,
                lender_derivation_path: row.try_get("lender_derivation_path")?,
                borrower_loan_address: row.try_get("borrower_loan_address")?,
                lender_loan_repayment_address: row.try_get("lender_loan_repayment_address")?,
                lender_btc_loan_repayment_address: row
                    .try_get("lender_btc_loan_repayment_address")?,
                loan_type: row.try_get::<db::LoanType, _>("loan_type")?,
                contract_address: row.try_get("contract_address")?,
                contract_index: row.try_get("contract_index")?,
                borrower_npub: row.try_get("borrower_npub")?,
                lender_npub: row.try_get("lender_npub")?,
                status: row.try_get::<db::ContractStatus, _>("status")?,
                liquidation_status: row
                    .try_get::<db::LiquidationStatus, _>("liquidation_status")?,
                duration_days: row.try_get("duration_days")?,
                expiry_date: row.try_get("expiry_date")?,
                contract_version: row.try_get("contract_version")?,
                interest_rate: row.try_get("interest_rate")?,
                client_contract_id: row.try_get("client_contract_id")?,
                extension_duration_days: row.try_get("extension_duration_days")?,
                extension_interest_rate: row.try_get("extension_interest_rate")?,
                asset: row.try_get::<LoanAsset, _>("asset")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            })
        })
        .fetch_all(pool)
        .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contracts_by_borrower_id_and_statuses_paginated(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    statuses: &[ContractStatus],
    limit: u32,
    offset: u32,
) -> Result<Vec<Contract>> {
    load_contracts_by_borrower_id_and_statuses_paginated_with_sort(
        pool,
        borrower_id,
        statuses,
        limit,
        offset,
        &SortOptions::default(),
    )
    .await
}

pub async fn load_contracts_by_borrower_id_and_statuses_paginated_with_sort(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    statuses: &[ContractStatus],
    limit: u32,
    offset: u32,
    sort_options: &SortOptions,
) -> Result<Vec<Contract>> {
    if statuses.is_empty() {
        return load_contracts_by_borrower_id_paginated_with_sort(
            pool,
            borrower_id,
            limit,
            offset,
            sort_options,
        )
        .await;
    }

    let statuses: Vec<db::ContractStatus> = statuses
        .iter()
        .map(|s| db::ContractStatus::from(*s))
        .collect();

    // Build the dynamic query with sort options
    let query_str = format!(
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type,
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status,
            liquidation_status,
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset,
            created_at,
            updated_at
        FROM contracts
        WHERE borrower_id = $1 AND status = ANY($2)
        ORDER BY {} {}
        LIMIT $3 OFFSET $4
        "#,
        sort_options.field, sort_options.order
    );

    let contracts: Vec<db::Contract> = sqlx::query(&query_str)
        .bind(borrower_id)
        .bind(&statuses)
        .bind(limit as i64)
        .bind(offset as i64)
        .try_map(|row: sqlx::postgres::PgRow| {
            use sqlx::Row;
            Ok(db::Contract {
                id: row.try_get("id")?,
                lender_id: row.try_get("lender_id")?,
                borrower_id: row.try_get("borrower_id")?,
                loan_deal_id: row.try_get("loan_deal_id")?,
                initial_ltv: row.try_get("initial_ltv")?,
                initial_collateral_sats: row.try_get("initial_collateral_sats")?,
                origination_fee_sats: row.try_get("origination_fee_sats")?,
                collateral_sats: row.try_get("collateral_sats")?,
                loan_amount: row.try_get("loan_amount")?,
                borrower_btc_address: row.try_get("borrower_btc_address")?,
                borrower_pk: row.try_get("borrower_pk")?,
                borrower_derivation_path: row.try_get("borrower_derivation_path")?,
                lender_pk: row.try_get("lender_pk")?,
                lender_derivation_path: row.try_get("lender_derivation_path")?,
                borrower_loan_address: row.try_get("borrower_loan_address")?,
                lender_loan_repayment_address: row.try_get("lender_loan_repayment_address")?,
                lender_btc_loan_repayment_address: row
                    .try_get("lender_btc_loan_repayment_address")?,
                loan_type: row.try_get::<db::LoanType, _>("loan_type")?,
                contract_address: row.try_get("contract_address")?,
                contract_index: row.try_get("contract_index")?,
                borrower_npub: row.try_get("borrower_npub")?,
                lender_npub: row.try_get("lender_npub")?,
                status: row.try_get::<db::ContractStatus, _>("status")?,
                liquidation_status: row
                    .try_get::<db::LiquidationStatus, _>("liquidation_status")?,
                duration_days: row.try_get("duration_days")?,
                expiry_date: row.try_get("expiry_date")?,
                contract_version: row.try_get("contract_version")?,
                interest_rate: row.try_get("interest_rate")?,
                client_contract_id: row.try_get("client_contract_id")?,
                extension_duration_days: row.try_get("extension_duration_days")?,
                extension_interest_rate: row.try_get("extension_interest_rate")?,
                asset: row.try_get::<LoanAsset, _>("asset")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            })
        })
        .fetch_all(pool)
        .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contracts_by_lender_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        FROM contracts
        where lender_id = $1
        "#,
        lender_id
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contracts_by_status(
    pool: &Pool<Postgres>,
    statuses: &[ContractStatus],
) -> Result<Vec<Contract>> {
    let statuses: Vec<db::ContractStatus> = statuses
        .iter()
        .map(|s| db::ContractStatus::from(*s))
        .collect();

    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        FROM contracts
        WHERE status = ANY($1::contract_status[])
        "#,
        statuses as Vec<db::ContractStatus>
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

pub async fn load_contract(pool: &Pool<Postgres>, contract_id: &str) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        FROM contracts
        where id = $1
        "#,
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn load_contract_by_contract_id_and_borrower_id(
    pool: &Pool<Postgres>,
    contract_id: &str,
    borrower_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        FROM contracts
        where id = $1 AND
        borrower_id = $2
        "#,
        contract_id,
        borrower_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub async fn load_contract_by_contract_id_and_lender_id(
    pool: &Pool<Postgres>,
    contract_id: &str,
    lender_id: &str,
) -> Result<Option<Contract>> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        FROM contracts
        where id = $1 AND
        lender_id = $2
        "#,
        contract_id,
        lender_id
    )
    .fetch_optional(pool)
    .await?;

    Ok(contract.map(|c| c.into()))
}

pub async fn load_open_contracts(pool: &Pool<Postgres>) -> Result<Vec<Contract>> {
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id as "id!",
            lender_id as "lender_id!",
            borrower_id as "borrower_id!",
            loan_deal_id as "loan_deal_id!",
            initial_ltv as "initial_ltv!",
            initial_collateral_sats as "initial_collateral_sats!",
            origination_fee_sats as "origination_fee_sats!",
            collateral_sats as "collateral_sats!",
            loan_amount as "loan_amount!",
            borrower_btc_address as "borrower_btc_address!",
            borrower_pk as "borrower_pk!",
            borrower_derivation_path,
            lender_pk as "lender_pk!",
            lender_derivation_path as "lender_derivation_path!",
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type!: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub as "borrower_npub!",
            lender_npub as "lender_npub!",
            status as "status!: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status!: crate::model::db::LiquidationStatus",
            duration_days as "duration_days!",
            expiry_date as "expiry_date!",
            contract_version as "contract_version!",
            interest_rate as "interest_rate!",
            extension_duration_days as "extension_duration_days!",
            extension_interest_rate as "extension_interest_rate!",
            asset as "asset!: crate::model::LoanAsset",
            created_at as "created_at!",
            updated_at as "updated_at!",
            client_contract_id
        FROM contracts_to_be_watched"#,
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_new_contract_request(
    pool: &Pool<Postgres>,
    id: Uuid,
    borrower_id: &str,
    lender_id: &str,
    loan_deal_id: &str,
    initial_ltv: Decimal,
    initial_collateral_sats: u64,
    origination_fee_sats: u64,
    loan_amount: Decimal,
    duration_days: i32,
    borrower_pk: PublicKey,
    borrower_derivation_path: bip32::DerivationPath,
    lender_pk: PublicKey,
    lender_derivation_path: bip32::DerivationPath,
    borrower_btc_address: Address<NetworkUnchecked>,
    lender_loan_repayment_address: String,
    lender_btc_loan_repayment_address: Option<String>,
    borrower_loan_address: Option<&str>,
    loan_type: LoanType,
    contract_version: ContractVersion,
    interest_rate: Decimal,
    borrower_npub: Npub,
    lender_npub: Npub,
    client_contract_id: Option<Uuid>,
    extension_policy: ExtensionPolicy,
    asset: LoanAsset,
) -> Result<Contract> {
    let mut db_tx = pool
        .begin()
        .await
        .context("Failed to start db transaction")?;

    let id = id.to_string();
    let initial_collateral_sats = initial_collateral_sats as i64;
    let origination_fee_sats = origination_fee_sats as i64;
    let collateral_sats = 0;
    let loan_type = db::LoanType::from(loan_type);
    let contract_version = contract_version as i32;

    let created_at = OffsetDateTime::now_utc();
    let expiry_date = expiry_date(created_at, duration_days as u64);

    let status = db::ContractStatus::Requested;

    let contract = insert_contract_request(
        &mut db_tx,
        borrower_id,
        lender_id,
        loan_deal_id,
        &id,
        initial_ltv,
        loan_amount,
        duration_days,
        borrower_btc_address,
        Some(borrower_pk),
        Some(borrower_derivation_path),
        lender_pk,
        lender_derivation_path,
        borrower_loan_address,
        Some(lender_loan_repayment_address),
        lender_btc_loan_repayment_address,
        initial_collateral_sats,
        origination_fee_sats,
        collateral_sats,
        loan_type,
        contract_version,
        created_at,
        expiry_date,
        status,
        None,
        None,
        interest_rate,
        borrower_npub,
        lender_npub,
        client_contract_id,
        extension_policy,
        asset,
    )
    .await?;

    db_tx.commit().await?;
    Ok(contract)
}

pub async fn insert_extension_contract_request(
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    new_contract_id: Uuid,
    original_contract: Contract,
    // The origination fee for the original contract plus this extension.
    total_origination_fee_sats: u64,
    extended_duration_days: i32,
    interest_rate: Decimal,
) -> Result<Contract> {
    let created_at = OffsetDateTime::now_utc();

    let total_duration_days = extended_duration_days + original_contract.duration_days;

    let new_expiry_date = expiry_date(original_contract.expiry_date, extended_duration_days as u64);

    // We immediately go back into `ContractStatus::PrincipalGiven`, because the original contract
    // was funded already.
    //
    // This means we do not require confirmation from the lender for a contract extension.
    let status = db::ContractStatus::PrincipalGiven;

    insert_contract_request(
        db_tx,
        &original_contract.borrower_id,
        &original_contract.lender_id,
        &original_contract.loan_id,
        &new_contract_id.to_string(),
        original_contract.initial_ltv,
        original_contract.loan_amount,
        total_duration_days,
        original_contract.borrower_btc_address,
        Some(original_contract.borrower_pk),
        original_contract.borrower_derivation_path,
        original_contract.lender_pk,
        original_contract.lender_derivation_path,
        original_contract.borrower_loan_address.as_deref(),
        original_contract
            .lender_loan_repayment_address
            .map(|a| a.to_string()),
        original_contract
            .lender_btc_loan_repayment_address
            .map(|a| a.to_string()),
        original_contract.initial_collateral_sats as i64,
        total_origination_fee_sats as i64,
        original_contract.collateral_sats as i64,
        original_contract.loan_type.into(),
        original_contract.contract_version as i32,
        created_at,
        new_expiry_date,
        status,
        original_contract
            .contract_address
            .map(|address| address.assume_checked().to_string()),
        original_contract.contract_index.map(|index| index as i32),
        interest_rate,
        original_contract.borrower_npub,
        original_contract.lender_npub,
        original_contract.client_contract_id,
        // An extended contract inherits the extension policy of the parent contract.
        original_contract.extension_policy,
        original_contract.asset,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn insert_contract_request(
    db_tx: &mut sqlx::Transaction<'_, Postgres>,
    borrower_id: &str,
    lender_id: &str,
    loan_deal_id: &str,
    contract_id: &str,
    initial_ltv: Decimal,
    loan_amount: Decimal,
    duration_days: i32,
    borrower_btc_address: Address<NetworkUnchecked>,
    borrower_pk: Option<PublicKey>,
    borrower_derivation_path: Option<bip32::DerivationPath>,
    lender_pk: PublicKey,
    lender_derivation_path: bip32::DerivationPath,
    borrower_loan_address: Option<&str>,
    lender_loan_repayment_address: Option<String>,
    lender_btc_loan_repayment_address: Option<String>,
    initial_collateral_sats: i64,
    origination_fee_sats: i64,
    collateral_sats: i64,
    loan_type: db::LoanType,
    contract_version: i32,
    created_at: OffsetDateTime,
    expiry_date: OffsetDateTime,
    status: db::ContractStatus,
    contract_address: Option<String>,
    contract_index: Option<i32>,
    interest_rate: Decimal,
    borrower_npub: Npub,
    lender_npub: Npub,
    client_contract_id: Option<Uuid>,
    extension_policy: ExtensionPolicy,
    asset: LoanAsset,
) -> Result<Contract, Error> {
    let (extension_duration_days, extension_interest_rate) =
        map_to_db_extension_policy(extension_policy);

    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        INSERT INTO contracts (
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            duration_days,
            status,
            liquidation_status,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type,
            contract_address,
            contract_index,
            contract_version,
            borrower_npub,
            lender_npub,
            created_at,
            expiry_date,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        "#,
        contract_id,
        lender_id,
        borrower_id,
        loan_deal_id,
        initial_ltv,
        initial_collateral_sats,
        origination_fee_sats,
        collateral_sats,
        loan_amount,
        duration_days,
        status as db::ContractStatus,
        db::LiquidationStatus::Healthy as db::LiquidationStatus,
        borrower_btc_address.assume_checked().to_string(),
        borrower_pk.map(|p| p.to_string()),
        borrower_derivation_path.map(|d| d.to_string()),
        lender_pk.to_string(),
        lender_derivation_path.to_string(),
        borrower_loan_address,
        lender_loan_repayment_address,
        lender_btc_loan_repayment_address as Option<String>,
        loan_type as db::LoanType,
        contract_address as Option<String>,
        contract_index as Option<i32>,
        contract_version,
        borrower_npub.to_string(),
        lender_npub.to_string(),
        created_at,
        expiry_date,
        interest_rate,
        client_contract_id,
        extension_duration_days,
        extension_interest_rate,
        asset as LoanAsset
    )
        .fetch_one(&mut **db_tx)
        .await?;

    contract_emails::start_tracking_contract_emails(&mut **db_tx, contract_id).await?;

    Ok(contract.into())
}

pub async fn accept_contract_request(
    transaction: &mut sqlx::Transaction<'_, Postgres>,
    lender_id: &str,
    contract_id: &str,
    contract_address: Address,
    contract_index: u32,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET status = $1,
            updated_at = $2,
            contract_address = $3,
            contract_index = $4
        WHERE lender_id = $5
          AND id = $6
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        "#,
        db::ContractStatus::Approved as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_address.to_string(),
        contract_index as i32,
        lender_id,
        contract_id
    )
    .fetch_one(&mut **transaction)
    .await?;

    Ok(contract.into())
}

pub async fn mark_contract_as_principal_given(
    pool: &Pool<Postgres>,
    contract_id: &str,
    duration_days: i32,
) -> Result<()> {
    // We update the expiry to ensure that the loan lasts long enough. We could be even more precise
    // if we checked the confirmation time of the principal transaction, but this is probably good
    // enough.
    let updated_at = OffsetDateTime::now_utc();
    let expiry_date = expiry_date(updated_at, duration_days as u64);

    sqlx::query!(
        r#"
       UPDATE contracts
       SET
           status = $1,
           expiry_date = $2,
           updated_at = $3
       WHERE id = $4
       "#,
        db::ContractStatus::PrincipalGiven as db::ContractStatus,
        expiry_date,
        updated_at,
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn mark_contract_as_repayment_provided(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::RepaymentProvided).await
}

pub async fn mark_contract_as_repayment_confirmed(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::RepaymentConfirmed).await
}

pub async fn mark_contract_as_cancelled<'a, E>(pool: E, contract_id: &str) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Cancelled).await
}

pub async fn mark_contract_as_extended<'a, E>(pool: E, contract_id: &str) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Extended).await
}

pub async fn mark_contract_as_closed(pool: &Pool<Postgres>, contract_id: &str) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Closed).await
}

pub async fn mark_contract_as_closed_by_liquidation(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::ClosedByLiquidation).await
}

pub async fn mark_contract_as_closed_by_defaulting(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::ClosedByDefaulting).await
}

pub async fn mark_contract_as_closed_by_recovery(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::ClosedByRecovery).await
}

pub async fn mark_contract_as_defaulted(pool: &Pool<Postgres>, contract_id: &str) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Defaulted).await
}

pub async fn mark_contract_as_closing(pool: &Pool<Postgres>, contract_id: &str) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Closing).await
}

pub async fn mark_contract_as_undercollateralized(
    pool: &Pool<Postgres>,
    contract_id: &str,
) -> Result<()> {
    mark_contract_state_as(pool, contract_id, db::ContractStatus::Undercollateralized).await
}

pub async fn reject_contract_request(
    pool: &Pool<Postgres>,
    lender_id: &str,
    contract_id: &str,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET status = $1,
            updated_at = $2
        WHERE lender_id = $3
          AND id = $4
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        "#,
        db::ContractStatus::Rejected as db::ContractStatus,
        OffsetDateTime::now_utc(),
        lender_id,
        contract_id
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub(crate) async fn mark_liquidation_state_as(
    pool: &Pool<Postgres>,
    contract_id: &str,
    status: db::LiquidationStatus,
) -> Result<Contract> {
    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            liquidation_status = $1,
            updated_at = $2
        WHERE id = $3
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        "#,
        status as db::LiquidationStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(contract.into())
}

pub(crate) async fn mark_contract_state_as<'a, E>(
    pool: E,
    contract_id: &str,
    status: db::ContractStatus,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query!(
        r#"
       UPDATE contracts
       SET
           status = $1,
           updated_at = $2
       WHERE id = $3
       "#,
        status as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub(crate) async fn load_open_not_liquidated_contracts_by_currency(
    pool: &Pool<Postgres>,
    currency: Currency,
) -> Result<Vec<Contract>> {
    let currency = currency.to_string();
    let contracts = sqlx::query_as!(
        db::Contract,
        r#"
        SELECT
            id as "id!",
            lender_id as "lender_id!",
            borrower_id as "borrower_id!",
            loan_deal_id as "loan_deal_id!",
            initial_ltv as "initial_ltv!",
            initial_collateral_sats as "initial_collateral_sats!",
            origination_fee_sats as "origination_fee_sats!",
            collateral_sats as "collateral_sats!",
            loan_amount as "loan_amount!",
            borrower_btc_address as "borrower_btc_address!",
            borrower_pk as "borrower_pk!",
            borrower_derivation_path,
            lender_pk as "lender_pk!",
            lender_derivation_path as "lender_derivation_path!",
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type!: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub as "borrower_npub!",
            lender_npub as "lender_npub!",
            status as "status!: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status!: crate::model::db::LiquidationStatus",
            duration_days as "duration_days!",
            expiry_date as "expiry_date!",
            contract_version as "contract_version!",
            interest_rate as "interest_rate!",
            extension_duration_days as "extension_duration_days!",
            extension_interest_rate as "extension_interest_rate!",
            asset as "asset!: crate::model::LoanAsset",
            created_at as "created_at!",
            updated_at as "updated_at!",
            client_contract_id
        FROM contracts_to_be_watched
        WHERE (
            CASE
                WHEN $1 = 'Usd' THEN asset != 'Eur'
                WHEN $1 = 'Eur' THEN asset = 'Eur'
                ELSE FALSE
            END
        )
          AND status NOT IN ('Defaulted', 'Undercollateralized')
          AND liquidation_status != 'Liquidated'
        "#,
        currency
    )
    .fetch_all(pool)
    .await?;

    let contracts = contracts
        .into_iter()
        .map(Contract::from)
        .collect::<Vec<Contract>>();

    Ok(contracts)
}

#[derive(Clone)]
pub struct DefaultedContract {
    pub contract_id: String,
    pub borrower_id: String,
    pub lender_id: String,
}

/// Update the collateral of the [`Contract`] in the database.
///
/// The `collateral_sats` and `status` columns are only updated if something actually changes based
/// on the reported `updated_collateral_sats` argument.
///
/// # Returns
///
/// A tuple with the updated [`Contract`] and a boolean indicating if the contract's collateral was
/// just confirmed.
///
/// This function is the cost we have to pay for not modelling things properly.
pub async fn update_collateral(
    pool: &Pool<Postgres>,
    contract_id: &str,
    updated_collateral_sats: u64,
) -> Result<(Contract, bool)> {
    let contract = load_contract(pool, contract_id).await?;

    let min_collateral = contract.initial_collateral_sats;
    let current_collateral_sats = contract.collateral_sats;

    // The status does not always change, but it's simpler to always write to the database if the
    // collateral changes.
    let (new_status, is_newly_confirmed) =
        match updated_collateral_sats.cmp(&current_collateral_sats) {
            Ordering::Greater => {
                tracing::debug!(
                    contract_id,
                    before = current_collateral_sats,
                    after = updated_collateral_sats,
                    "Collateral increased"
                );

                match contract.status {
                    ContractStatus::Requested => {
                        // This means that a contract's newly assigned address already has money in
                        // it. We can only get here if the _contract address_ was reused, which is a
                        // really bad idea.
                        bail!("Should not be able to add collateral to a Requested loan");
                    }
                    ContractStatus::Approved | ContractStatus::CollateralSeen => {
                        match updated_collateral_sats >= min_collateral {
                            true => {
                                tracing::debug!(
                                    contract_id,
                                    collateral_sats = updated_collateral_sats,
                                    "Collateral confirmed"
                                );

                                (ContractStatus::CollateralConfirmed, true)
                            }
                            false => (contract.status, false),
                        }
                    }
                    ContractStatus::CollateralConfirmed
                    | ContractStatus::PrincipalGiven
                    | ContractStatus::RenewalRequested
                    | ContractStatus::RepaymentProvided
                    | ContractStatus::RepaymentConfirmed
                    | ContractStatus::Undercollateralized
                    | ContractStatus::Defaulted
                    | ContractStatus::Closing
                    | ContractStatus::Closed
                    | ContractStatus::ClosedByLiquidation
                    | ContractStatus::ClosedByDefaulting
                    | ContractStatus::Extended
                    | ContractStatus::Rejected
                    | ContractStatus::DisputeBorrowerStarted
                    | ContractStatus::DisputeLenderStarted
                    | ContractStatus::DisputeBorrowerResolved
                    | ContractStatus::DisputeLenderResolved
                    | ContractStatus::Cancelled
                    | ContractStatus::RequestExpired
                    | ContractStatus::ApprovalExpired
                    | ContractStatus::CollateralRecoverable
                    | ContractStatus::ClosedByRecovery => (contract.status, false),
                }
            }
            Ordering::Less => {
                // Currently, we are only tracking adding funds to a collateral output. If the
                // collateral amount decreases, it's probably because an output was reorged
                // away, which is rare.
                tracing::warn!(
                    contract_id,
                    before = current_collateral_sats,
                    after = updated_collateral_sats,
                    "Collateral decreased. This is weird"
                );

                // This is where the limitations of our state machine come into play. Here we're
                // only considering the possibility that `CollateralConfirmed` can
                // go back to to `Approved` after a reorg, but it could happen for
                // other states too. In any case, this is all unlikely.
                match contract.status {
                    ContractStatus::CollateralConfirmed => {
                        match updated_collateral_sats < min_collateral {
                            true => {
                                tracing::warn!(
                                    contract_id,
                                    collateral_sats = updated_collateral_sats,
                                    "Moving contract from CollateralConfirmed back to Approved"
                                );

                                (ContractStatus::Approved, false)
                            }
                            false => (contract.status, false),
                        }
                    }
                    _ => (contract.status, false),
                }
            }
            Ordering::Equal => {
                tracing::trace!(
                    contract_id,
                    collateral_sats = current_collateral_sats,
                    "Collateral has not changed"
                );

                return Ok((contract, false));
            }
        };

    let new_status = db::ContractStatus::from(new_status);

    let contract = sqlx::query_as!(
        db::Contract,
        r#"
        UPDATE contracts
        SET
            collateral_sats = $1,
            status = $2,
            updated_at = $3
        WHERE id = $4
        RETURNING
            id,
            lender_id,
            borrower_id,
            loan_deal_id,
            initial_ltv,
            initial_collateral_sats,
            origination_fee_sats,
            collateral_sats,
            loan_amount,
            borrower_btc_address,
            borrower_pk,
            borrower_derivation_path,
            lender_pk,
            lender_derivation_path,
            borrower_loan_address,
            lender_loan_repayment_address,
            lender_btc_loan_repayment_address,
            loan_type as "loan_type: crate::model::db::LoanType",
            contract_address,
            contract_index,
            borrower_npub,
            lender_npub,
            status as "status: crate::model::db::ContractStatus",
            liquidation_status as "liquidation_status: crate::model::db::LiquidationStatus",
            duration_days,
            expiry_date,
            contract_version,
            interest_rate,
            client_contract_id,
            extension_duration_days,
            extension_interest_rate,
            asset as "asset: crate::model::LoanAsset",
            created_at,
            updated_at
        "#,
        updated_collateral_sats as i64,
        new_status as db::ContractStatus,
        OffsetDateTime::now_utc(),
        contract_id,
    )
    .fetch_one(pool)
    .await?;

    Ok((contract.into(), is_newly_confirmed))
}

#[derive(Clone)]
pub struct ExpiredContract {
    pub contract_id: String,
    pub borrower_id: String,
    pub lender_id: String,
}

/// Expires contracts in state Requested and returns their details
pub(crate) async fn expire_requested_contracts(
    pool: &Pool<Postgres>,
    expiry_in_hours: i64,
    pending_kyc_expiry_in_hours: i64,
) -> Result<Vec<ExpiredContract>> {
    let expiration_threshold = OffsetDateTime::now_utc() - time::Duration::hours(expiry_in_hours);

    let pending_kyc_expiration_threshold =
        OffsetDateTime::now_utc() - time::Duration::hours(pending_kyc_expiry_in_hours);

    // If there is no pending KYC, expire the contract after `expiration_threshold`.
    let regular_expired = sqlx::query_as!(
        ExpiredContract,
        r#"
            UPDATE
                contracts
            SET
                status = 'RequestExpired',
                updated_at = $1
            WHERE
                status = 'Requested' AND
                created_at <= $2 AND
                NOT EXISTS (
                  SELECT 1
                  FROM kyc
                  WHERE
                    kyc.lender_id = contracts.lender_id AND
                    kyc.borrower_id = contracts.borrower_id AND
                    kyc.is_done = false
                )
            RETURNING
                id as "contract_id",
                borrower_id as "borrower_id",
                lender_id as "lender_id"
        "#,
        OffsetDateTime::now_utc(),
        expiration_threshold
    )
    .fetch_all(pool)
    .await?;

    // If there is a pending KYC, expire the contract after `pending_kyc_expiration_threshold`.
    let kyc_expired = sqlx::query_as!(
        ExpiredContract,
        r#"
            UPDATE
                contracts
            SET
                status = 'RequestExpired',
                updated_at = $1
            WHERE
                status = 'Requested' AND
                created_at <= $2 AND
                EXISTS (
                  SELECT 1
                  FROM kyc
                  WHERE
                    kyc.lender_id = contracts.lender_id AND
                    kyc.borrower_id = contracts.borrower_id AND
                    kyc.is_done = false
                )
            RETURNING
                id as "contract_id",
                borrower_id as "borrower_id",
                lender_id as "lender_id"
        "#,
        OffsetDateTime::now_utc(),
        pending_kyc_expiration_threshold
    )
    .fetch_all(pool)
    .await?;

    // Combine both sets of expired contracts
    let all_expired = [regular_expired, kyc_expired].concat();

    Ok(all_expired)
}

pub(crate) async fn check_if_contract_belongs_to_borrower(
    pool: &Pool<Postgres>,
    contract_id: &str,
    borrower_id: &str,
) -> Result<bool> {
    let row = sqlx::query!(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM contracts WHERE id = $1 AND borrower_id = $2
            ) AS entry_exists;
        "#,
        contract_id,
        borrower_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(row.entry_exists.unwrap_or(false))
}

#[derive(sqlx::FromRow)]
pub struct ContractStats {
    pub(crate) loan_amount: Decimal,
    pub(crate) duration_days: i32,
    pub(crate) interest_rate: Decimal,
    pub(crate) created_at: OffsetDateTime,
}

/// Returns the latest [`limit`] contracts by creation date
pub async fn load_latest_contract_stats(
    pool: &Pool<Postgres>,
    limit: i64,
) -> Result<Vec<ContractStats>> {
    let contract_stats = sqlx::query_as!(
        ContractStats,
        r#"
        SELECT
            loan_amount,
            duration_days,
            interest_rate,
            created_at
        FROM contracts
        order by created_at desc limit $1
        "#,
        limit
    )
    .fetch_all(pool)
    .await?;

    Ok(contract_stats)
}

pub async fn has_contracts_before_pake_borrower(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<bool> {
    let row = sqlx::query!(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM contracts WHERE borrower_id = $1 AND created_at < '2025-01-19'
            ) AS entry_exists;
        "#,
        borrower_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(row.entry_exists.unwrap_or(false))
}

pub async fn has_contracts_before_pake_lender(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<bool> {
    let row = sqlx::query!(
        r#"
            SELECT EXISTS (
                SELECT 1 FROM contracts WHERE lender_id = $1 AND created_at < '2025-01-19'
            ) AS entry_exists;
        "#,
        lender_id,
    )
    .fetch_one(pool)
    .await?;

    Ok(row.entry_exists.unwrap_or(false))
}

/// Expires contracts in state Approved and returns their IDs
pub(crate) async fn expire_approved_contracts(
    pool: &Pool<Postgres>,
    expiry_in_hours: i64,
) -> Result<Vec<String>> {
    let expiration_threshold = OffsetDateTime::now_utc() - time::Duration::hours(expiry_in_hours);

    let rows = sqlx::query!(
        r#"
            UPDATE
                contracts
            SET
                status = 'ApprovalExpired', updated_at = $1
            WHERE
                status = 'Approved' AND
                created_at <= $2
            RETURNING id;
        "#,
        OffsetDateTime::now_utc(),
        expiration_threshold
    )
    .fetch_all(pool)
    .await?;

    let contract_ids = rows.into_iter().map(|row| row.id).collect();

    Ok(contract_ids)
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_new_taken_contract_application(
    pool: &Pool<Postgres>,
    id: Uuid,
    borrower_id: &str,
    lender_id: &str,
    loan_deal_id: &str,
    initial_ltv: Decimal,
    initial_collateral_sats: u64,
    origination_fee_sats: u64,
    loan_amount: Decimal,
    duration_days: i32,
    borrower_pk: PublicKey,
    borrower_derivation_path: bip32::DerivationPath,
    lender_pk: PublicKey,
    lender_derivation_path: bip32::DerivationPath,
    borrower_btc_address: Address<NetworkUnchecked>,
    borrower_loan_address: Option<&str>,
    lender_loan_repayment_address: String,
    loan_type: LoanType,
    contract_version: ContractVersion,
    interest_rate: Decimal,
    contract_address: Address<NetworkUnchecked>,
    contract_index: u32,
    borrower_npub: Npub,
    lender_npub: Npub,
    client_contract_id: Option<Uuid>,
) -> Result<Contract> {
    // TODO: we should probably provide this as argument
    let loan_deal = loan_deals::get_loan_deal_by_id(pool, loan_deal_id).await?;
    let asset = loan_deal.loan_asset();

    let mut db_tx = pool
        .begin()
        .await
        .context("Failed to start db transaction")?;

    let id = id.to_string();
    let initial_collateral_sats = initial_collateral_sats as i64;
    let origination_fee_sats = origination_fee_sats as i64;
    let collateral_sats = 0;
    let loan_type = db::LoanType::from(loan_type);
    let contract_version = contract_version as i32;

    let created_at = OffsetDateTime::now_utc();
    let expiry_date = expiry_date(created_at, duration_days as u64);

    // TODO: we might want to use a different state here to differentiate between contracts which
    // have been requested and approved or offered and taken. For now, we just treat them the
    // same which simplifies the frontend as from this state, everything is the same though, i.e.
    // next the borrower will need to fund the contract.
    let status = db::ContractStatus::Approved;

    let address = contract_address.assume_checked().to_string();
    let contract = insert_contract_request(
        &mut db_tx,
        borrower_id,
        lender_id,
        loan_deal_id,
        &id,
        initial_ltv,
        loan_amount,
        duration_days,
        borrower_btc_address,
        Some(borrower_pk),
        Some(borrower_derivation_path),
        lender_pk,
        lender_derivation_path,
        borrower_loan_address,
        Some(lender_loan_repayment_address),
        // Loan applications do not support BTC repayment for now.
        None,
        initial_collateral_sats,
        origination_fee_sats,
        collateral_sats,
        loan_type,
        contract_version,
        created_at,
        expiry_date,
        status,
        Some(address.to_string()),
        Some(contract_index as i32),
        interest_rate,
        borrower_npub,
        lender_npub,
        client_contract_id,
        // By default, contracts created from a loan application are set to do-not-extend.
        ExtensionPolicy::DoNotExtend,
        asset,
    )
    .await?;

    db_tx.commit().await?;
    Ok(contract)
}

/// Rolls back the status of a contract to the state before the dispute.
///
/// This function:
/// 1. Finds the current status of the contract and checks if it was actually a dispute status
/// 2. Finds the previous status from the contracts_status_log table
/// 3. Updates the contract to the previous status
pub async fn resolve_dispute(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    contract: &Contract,
) -> Result<()> {
    let current_status = db::ContractStatus::from(contract.status);
    let contract_id = &contract.id;

    // Check if the contract is actually in a dispute status
    if current_status != db::ContractStatus::DisputeBorrowerStarted
        && current_status != db::ContractStatus::DisputeLenderStarted
    {
        bail!("Contract not in dispute state. {current_status:?}");
    }

    struct ContractStatusLog {
        old_status: db::ContractStatus,
    }

    // 1. Find the previous status from the status log
    let previous_status_record: Option<ContractStatusLog> = sqlx::query_as!(
        ContractStatusLog,
        r#"SELECT
            old_status as "old_status: crate::model::db::ContractStatus"
         FROM
            contracts_status_log
         WHERE
            contract_id = $1 AND new_status = $2
         ORDER BY changed_at DESC LIMIT 1"#,
        contract_id,
        current_status as db::ContractStatus
    )
    .fetch_optional(&mut **tx)
    .await?;

    // Check if a previous status was found
    let previous_status = match previous_status_record {
        Some(record) => record.old_status,
        None => {
            // we do not roll back here as we throw an error and expect the caller to roll back
            bail!("Nothing to roll back on");
        }
    };

    // 2. Update the contract to the previous status
    sqlx::query!(
        r#"UPDATE
            contracts
        SET
            status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2"#,
        previous_status as db::ContractStatus,
        contract_id
    )
    .execute(&mut **tx)
    .await?;

    Ok(())
}

/// Update the extension policty of a contract by applying the given [`ExtensionPolicy`].
pub(crate) async fn update_extension_policy(
    pool: &Pool<Postgres>,
    id: &str,
    new_extension_policy: ExtensionPolicy,
) -> Result<()> {
    let (extension_duration_days, extension_interest_rate) =
        map_to_db_extension_policy(new_extension_policy);

    let rows_affected = sqlx::query!(
        r#"
            UPDATE
                contracts
            SET
                extension_duration_days = $1,
                extension_interest_rate = $2
            WHERE
                id = $3
        "#,
        extension_duration_days,
        extension_interest_rate,
        id,
    )
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(anyhow::anyhow!(
            "Could not update contract extension policy"
        ));
    }

    Ok(())
}

/// Update borrower_btc_address aka borrower refund address
pub async fn update_borrower_btc_address(
    pool: &Pool<Postgres>,
    contract_id: &str,
    borrower_id: &str,
    refund_address: Address,
) -> Result<bool> {
    let rows_affected = sqlx::query!(
        r#"
        UPDATE contracts
        SET
            borrower_btc_address = $1
        WHERE id = $2 AND borrower_id = $3
        "#,
        refund_address.to_string(),
        contract_id,
        borrower_id
    )
    .execute(pool)
    .await?
    .rows_affected();

    Ok(rows_affected > 0)
}

pub async fn update_expiry_date<'a, E>(
    db: E,
    contract_id: &str,
    new_expiry_date: OffsetDateTime,
) -> Result<()>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let rows_affected = sqlx::query!(
        r#"
        UPDATE contracts
        SET expiry_date = $1
        WHERE id = $2
        "#,
        new_expiry_date,
        contract_id,
    )
    .execute(db)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(anyhow::anyhow!("Could not update expiry date"));
    }

    Ok(())
}
