use crate::bitmex_index_pricefeed::BitmexIndexPrice;
use crate::config::Config;
use crate::db;
use crate::model;
use crate::model::db::LiquidationStatus;
use crate::model::Contract;
use crate::model::Currency;
use crate::notifications::Notifications;
use crate::LTV_THRESHOLD_MARGIN_CALL_1;
use crate::LTV_THRESHOLD_MARGIN_CALL_2;
use anyhow::Context;
use anyhow::Result;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use std::collections::HashMap;
use std::sync::Arc;
use time::Duration;
use time::OffsetDateTime;
use tokio::sync::mpsc::Receiver;

/// We don't want to check on every price update as this would be too often. Instead, we collect all
/// price updates in this interval and calculate the average. Meaning, only if the price was below
/// the liquidation/margin call threshold for this time, we do something.
const TIME_BETWEEN_PRICE_CHECKS: i64 = 5;

pub async fn monitor_positions(
    db: Pool<Postgres>,
    mut bitmex_rx: Receiver<BitmexIndexPrice>,
    config: Config,
    notifications: Arc<Notifications>,
) -> Result<()> {
    tokio::spawn({
        let config = config.clone();
        async move {
            // Maintain separate price collections for each currency
            let mut currency_prices: HashMap<Currency, Vec<Decimal>> = HashMap::new();
            // Maintain separate last update times for each currency
            let mut currency_last_updates: HashMap<Currency, OffsetDateTime> = HashMap::new();

            while let Some(price) = bitmex_rx.recv().await {
                tracing::trace!(
                    price = price.market_price.to_string(),
                    currency = ?price.currency,
                    "Received new price"
                );

                // Add price to the appropriate currency collection, maintaining max 10 entries
                let prices = currency_prices.entry(price.currency).or_default();

                prices.push(price.market_price);

                // Keep only the latest 10 prices (drop oldest if we exceed 10)
                if prices.len() > 10 {
                    prices.remove(0); // Remove the oldest (first) price
                }

                let config = config.clone();

                // Calculate average price only for the currency that just updated
                let current_currency = price.currency;

                // Get the last update time for this currency, or use a time far in the past
                let last_update_for_currency =
                    *currency_last_updates.get(&current_currency).unwrap_or(
                        &(OffsetDateTime::now_utc()
                            - Duration::minutes(TIME_BETWEEN_PRICE_CHECKS + 1)),
                    );

                if let Some(prices) = currency_prices.get(&current_currency) {
                    if !prices.is_empty() {
                        let total_updates = prices.len();
                        let average_price = prices.iter().fold(Decimal::zero(), |acc, e| acc + e)
                            / Decimal::from_usize(total_updates).expect("to fit");

                        tracing::trace!(
                            currency = ?current_currency,
                            average_price = average_price.to_string(),
                            sample_count = total_updates,
                            "Calculated average price for currency"
                        );

                        if price.timestamp - last_update_for_currency
                            > Duration::minutes(TIME_BETWEEN_PRICE_CHECKS)
                        {
                            check_margin_call_or_liquidation(
                                &db,
                                current_currency,
                                average_price,
                                config.clone(),
                                notifications.clone(),
                            )
                            .await;

                            // Update the last check time for this currency
                            currency_last_updates.insert(current_currency, price.timestamp);
                        }
                    }
                }
            }
        }
    });
    Ok(())
}

async fn check_margin_call_or_liquidation(
    db: &Pool<Postgres>,
    currency: Currency,
    latest_price: Decimal,
    config: Config,
    notifications: Arc<Notifications>,
) {
    // TODO: For performance reasons, we should not constantly load from the DB but use some form of
    // in-memory cache instead.
    match db::contracts::load_open_not_liquidated_contracts_by_currency(db, currency).await {
        Ok(contracts) => {
            tracing::trace!(
                currency = ?currency,
                contract_count = contracts.len(),
                "Checking contracts for margin call/liquidation"
            );

            for contract in contracts {
                if contract.collateral_sats == 0 {
                    // Contracts which have not been funded do not have a collateral set, hence we
                    // do not need to liquidate them. At the same time, we should not get here
                    // because we are filtering out contracts that have not been funded.
                    continue;
                }

                let installments =
                    match db::installments::get_all_for_contract_id(db, &contract.id).await {
                        Ok(installments) => installments,
                        Err(e) => {
                            tracing::error!(
                                contract_id = contract.id,
                                "Could not get installments for contract: {e:#}"
                            );
                            continue;
                        }
                    };

                let liquidation_price = contract.liquidation_price(&installments);

                match contract.ltv(&installments, latest_price) {
                    Ok(current_ltv) => {
                        tracing::trace!(
                            contract_id = contract.id,
                            currency = ?currency,
                            latest_price = latest_price.to_string(),
                            current_ltv = current_ltv.to_string(),
                            "Checking for margin call"
                        );

                        if contract.can_be_liquidated(current_ltv) {
                            liquidate_contract(
                                db,
                                &contract,
                                config.clone(),
                                latest_price,
                                current_ltv,
                                liquidation_price,
                                notifications.clone(),
                            )
                            .await;
                        } else if current_ltv >= LTV_THRESHOLD_MARGIN_CALL_2 {
                            second_margin_call(
                                db,
                                &contract,
                                config.clone(),
                                latest_price,
                                current_ltv,
                                liquidation_price,
                                notifications.clone(),
                            )
                            .await
                        } else if current_ltv >= LTV_THRESHOLD_MARGIN_CALL_1 {
                            first_margin_call_contract(
                                db,
                                &contract,
                                config.clone(),
                                latest_price,
                                current_ltv,
                                liquidation_price,
                                notifications.clone(),
                            )
                            .await
                        } else {
                            healthy_state(db, &contract).await
                        }
                    }
                    Err(error) => {
                        tracing::error!(
                            contract_id = contract.id,
                            "Failed at calculating current LTV: {error:#}"
                        );
                    }
                }
            }
        }
        Err(error) => {
            tracing::error!("Failed loading contracts from db {error:#}");
        }
    }
}

async fn healthy_state(db: &Pool<Postgres>, contract: &Contract) {
    let contract_id = &contract.id;

    if contract.liquidation_status == model::LiquidationStatus::Liquidated {
        tracing::trace!(
            contract_id,
            "Contract already liquidated, there is no way back"
        );
        return;
    }

    if contract.liquidation_status == model::LiquidationStatus::Healthy {
        tracing::trace!(
            contract_id,
            "Contract is healthy, there is nothing to do here"
        );
        return;
    }

    tracing::debug!(contract_id, "Marking contract as healthy");

    if let Err(err) =
        db::contracts::mark_liquidation_state_as(db, contract_id, LiquidationStatus::Healthy).await
    {
        tracing::error!(
            contract_id,
            "Failed updating liquidation status to healthy {err:#}"
        )
    }
}

async fn first_margin_call_contract(
    db: &Pool<Postgres>,
    contract: &Contract,
    config: Config,
    price: Decimal,
    current_ltv: Decimal,
    liquidation_price: Decimal,
    notifications: Arc<Notifications>,
) {
    let contract_id = &contract.id;
    let liquidation_status = contract.liquidation_status;

    if liquidation_status == model::LiquidationStatus::Liquidated
        || liquidation_status == model::LiquidationStatus::SecondMarginCall
        || liquidation_status == model::LiquidationStatus::FirstMarginCall
    {
        tracing::trace!(
            contract_id,
            ?liquidation_status,
            "Contract already further along than first-margin-call"
        );
        return;
    }

    tracing::debug!(contract_id, "Marking contract as first-margin-call");

    if let Err(err) = db::contracts::mark_liquidation_state_as(
        db,
        contract_id,
        LiquidationStatus::FirstMarginCall,
    )
    .await
    {
        tracing::error!(
            contract_id,
            "Failed to mark contract as first-margin-call: {err:#}"
        )
    }

    if let Err(err) = send_notification(
        db,
        contract,
        config,
        price,
        current_ltv,
        liquidation_price,
        LiquidationStatus::FirstMarginCall,
        notifications,
    )
    .await
    {
        tracing::error!(
            contract_id,
            "Failed to send first-margin-call email: {err:#}"
        )
    }
}

async fn second_margin_call(
    db: &Pool<Postgres>,
    contract: &Contract,
    config: Config,
    latest_price: Decimal,
    current_ltv: Decimal,
    liquidation_price: Decimal,
    notifications: Arc<Notifications>,
) {
    let contract_id = &contract.id;
    let liquidation_status = contract.liquidation_status;

    if liquidation_status == model::LiquidationStatus::Liquidated
        || liquidation_status == model::LiquidationStatus::SecondMarginCall
    {
        tracing::trace!(
            contract_id,
            ?liquidation_status,
            "Contract already further along than second-margin-call"
        );
        return;
    }

    tracing::debug!(contract_id, "Marking contract as second margin call");

    if let Err(err) = db::contracts::mark_liquidation_state_as(
        db,
        contract_id,
        LiquidationStatus::SecondMarginCall,
    )
    .await
    {
        tracing::error!(
            contract_id,
            "Failed to mark contract as second-margin-call: {err:#}"
        )
    }

    if let Err(err) = send_notification(
        db,
        contract,
        config,
        latest_price,
        current_ltv,
        liquidation_price,
        LiquidationStatus::SecondMarginCall,
        notifications,
    )
    .await
    {
        tracing::error!(
            contract_id,
            "Failed to send second-margin-call email: {err:#}"
        )
    }
}

async fn liquidate_contract(
    db: &Pool<Postgres>,
    contract: &Contract,
    config: Config,
    latest_price: Decimal,
    current_ltv: Decimal,
    liquidation_price: Decimal,
    notifications: Arc<Notifications>,
) {
    let contract_id = &contract.id;

    if contract.liquidation_status == model::LiquidationStatus::Liquidated {
        tracing::trace!(contract_id, "Contract already liquidated");
        return;
    }

    tracing::info!(contract_id, "Marking contract as undercollateralized");

    if let Err(err) = db::contracts::mark_contract_as_undercollateralized(db, contract_id).await {
        tracing::error!(
            contract_id,
            "Failed to mark contract as undercollateralized: {err:#}"
        )
    }

    tracing::debug!(contract_id, "Updating liquidation status to liquidated");

    if let Err(err) =
        db::contracts::mark_liquidation_state_as(db, contract_id, LiquidationStatus::Liquidated)
            .await
    {
        tracing::error!(
            contract_id,
            "Failed to update liquidation status to liquidated: {err:#}"
        )
    }

    if let Err(err) = send_notification(
        db,
        contract,
        config,
        latest_price,
        current_ltv,
        liquidation_price,
        LiquidationStatus::Liquidated,
        notifications,
    )
    .await
    {
        tracing::error!(contract_id, "Failed to send liquidation email: {err:#}")
    }
}

#[allow(clippy::too_many_arguments)]
async fn send_notification(
    pool: &Pool<Postgres>,
    contract: &Contract,
    config: Config,
    price: Decimal,
    current_ltv: Decimal,
    liquidation_price: Decimal,
    status: LiquidationStatus,
    notifications: Arc<Notifications>,
) -> Result<()> {
    let contract_id = &contract.id;

    let borrower = db::borrowers::get_user_by_id(pool, contract.borrower_id.as_str())
        .await?
        .context("borrower not found")?;

    let borrower_contract_url = config
        .borrower_frontend_origin
        .join(format!("/my-contracts/{}", contract_id).as_str())?;

    match status {
        LiquidationStatus::Healthy => {
            // We don't send emails about this.
        }
        LiquidationStatus::FirstMarginCall | LiquidationStatus::SecondMarginCall => {
            notifications
                .send_borrower_margin_call(
                    borrower,
                    contract.clone(),
                    price,
                    current_ltv,
                    liquidation_price,
                    borrower_contract_url,
                )
                .await;
        }
        LiquidationStatus::Liquidated => {
            notifications
                .send_liquidation_notice_borrower(
                    borrower,
                    contract.clone(),
                    price,
                    liquidation_price,
                    borrower_contract_url,
                )
                .await;

            let lender = db::lenders::get_user_by_id(pool, contract.lender_id.as_str())
                .await?
                .context("lender not found")?;

            let lender_contract_url = config
                .lender_frontend_origin
                .join(format!("/my-contracts/{}", contract.id).as_str())?;

            notifications
                .send_liquidation_notice_lender(lender, contract.clone(), lender_contract_url)
                .await;
        }
    }

    Ok(())
}
