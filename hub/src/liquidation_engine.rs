use crate::bitmex_index_pricefeed::BitmexIndexPrice;
use crate::config::Config;
use crate::db;
use crate::email::Email;
use crate::model;
use crate::model::db::LiquidationStatus;
use crate::model::Contract;
use crate::model::User;
use crate::utils::calculate_ltv;
use crate::LTV_THRESHOLD_LIQUIDATION;
use crate::LTV_THRESHOLD_MARGIN_CALL_1;
use crate::LTV_THRESHOLD_MARGIN_CALL_2;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use sqlx::Pool;
use sqlx::Postgres;
use time::Duration;
use time::OffsetDateTime;
use tokio::sync::mpsc::Receiver;

/// We don't want to check on every price update as this would be too often. Instead, we collect
/// all price updates in this interval and calculate the average. Meaning, only if the price was
/// below the liquidation/margin call threshold/ for this time, we do something.
const TIME_BETWEEN_PRICE_CHECKS: i64 = 5;

pub async fn monitor_positions(
    db: Pool<Postgres>,
    mut bitmex_rx: Receiver<BitmexIndexPrice>,
    config: Config,
) -> Result<()> {
    tokio::spawn({
        let config = config.clone();
        async move {
            let mut last_update = OffsetDateTime::now_utc();
            let mut last_prices = vec![];
            while let Some(price) = bitmex_rx.recv().await {
                tracing::trace!(price = price.market_price.to_string(), "Received new price");
                last_prices.push(price.market_price);

                if price.timestamp - last_update > Duration::minutes(TIME_BETWEEN_PRICE_CHECKS) {
                    let config = config.clone();
                    let total_updates = last_prices.len();
                    let average_price_in_last_five_minutes =
                        last_prices.iter().fold(Decimal::zero(), |acc, e| acc + e)
                            / Decimal::from_usize(total_updates).expect("to fit");

                    check_margin_call_or_liquidation(
                        &db,
                        average_price_in_last_five_minutes,
                        config.clone(),
                    )
                    .await;
                    last_prices.clear();
                    last_update = price.timestamp;
                }
            }
        }
    });
    Ok(())
}

async fn check_margin_call_or_liquidation(
    db: &Pool<Postgres>,
    latest_price: Decimal,
    config: Config,
) {
    // TODO: for performance reasons we should not constantly load from DB but use some form of
    // in-memory cache
    match db::contracts::load_open_not_liquidated_contracts(db).await {
        Ok(contracts) => {
            for contract in contracts {
                match calculate_ltv(
                    latest_price,
                    contract.loan_amount,
                    Decimal::from_u64(contract.initial_collateral_sats).expect(
                        "to fit into
                u64",
                    ),
                ) {
                    Ok(current_ltv) => {
                        tracing::trace!(
                            contract_id = contract.id,
                            latest_price = latest_price.to_string(),
                            current_ltv = current_ltv.to_string(),
                            "Checking for margin call"
                        );

                        if current_ltv >= LTV_THRESHOLD_LIQUIDATION {
                            liquidate_contract(
                                db,
                                &contract,
                                config.clone(),
                                latest_price,
                                current_ltv,
                            )
                            .await;
                        } else if current_ltv >= LTV_THRESHOLD_MARGIN_CALL_1 {
                            second_margin_call(
                                db,
                                &contract,
                                config.clone(),
                                latest_price,
                                current_ltv,
                            )
                            .await
                        } else if current_ltv >= LTV_THRESHOLD_MARGIN_CALL_2 {
                            first_margin_call_contract(
                                db,
                                &contract,
                                config.clone(),
                                latest_price,
                                current_ltv,
                            )
                            .await
                        } else {
                            healthy_state(db, &contract).await
                        }
                    }
                    Err(error) => {
                        tracing::error!(
                            contract_id = contract.id,
                            "Failed at calculating current ltv {error:#}"
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
    if contract.liquidation_status == model::LiquidationStatus::Liquidated {
        tracing::debug!(
            contract_id = contract.id,
            "Contract already liquidated, there is no way back"
        );
        return;
    }
    if contract.liquidation_status == model::LiquidationStatus::Healthy {
        tracing::trace!(
            contract_id = contract.id,
            "Contract is healthy, there is nothing todo here"
        );
        return;
    }
    tracing::info!(contract_id = contract.id, "Marking contract as healthy");

    if let Err(err) = db::contracts::mark_liquidation_state_as(
        db,
        contract.id.as_str(),
        LiquidationStatus::Healthy,
    )
    .await
    {
        tracing::error!(
            contract_id = contract.id,
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
) {
    if contract.liquidation_status == model::LiquidationStatus::Liquidated
        || contract.liquidation_status == model::LiquidationStatus::SecondMarginCall
        || contract.liquidation_status == model::LiquidationStatus::FirstMarginCall
    {
        tracing::debug!(
            contract_id = contract.id,
            "Contract already in a later state"
        );
        return;
    }
    tracing::info!(
        contract_id = contract.id,
        "Marking contract for first margin call"
    );
    if let Err(err) = db::contracts::mark_liquidation_state_as(
        db,
        contract.id.as_str(),
        LiquidationStatus::FirstMarginCall,
    )
    .await
    {
        tracing::error!(
            contract_id = contract.id,
            "Failed updating liquidation status to first margin call{err:#}"
        )
    }

    if let Err(err) = send_email(
        db,
        contract,
        config,
        price,
        current_ltv,
        LiquidationStatus::FirstMarginCall,
    )
    .await
    {
        tracing::error!(contract_id = contract.id, "Failed at sending email {err:#}")
    }
}

async fn second_margin_call(
    db: &Pool<Postgres>,
    contract: &Contract,
    config: Config,
    latest_price: Decimal,
    current_ltv: Decimal,
) {
    if contract.liquidation_status == model::LiquidationStatus::Liquidated
        || contract.liquidation_status == model::LiquidationStatus::SecondMarginCall
    {
        tracing::debug!(
            contract_id = contract.id,
            "Contract already in a later state"
        );
        return;
    }
    tracing::info!(
        contract_id = contract.id,
        "Marking contract for second margin call"
    );

    if let Err(err) = db::contracts::mark_liquidation_state_as(
        db,
        contract.id.as_str(),
        LiquidationStatus::SecondMarginCall,
    )
    .await
    {
        tracing::error!(
            contract_id = contract.id,
            "Failed updating liquidation status to second margin call{err:#}"
        )
    }

    if let Err(err) = send_email(
        db,
        contract,
        config,
        latest_price,
        current_ltv,
        LiquidationStatus::SecondMarginCall,
    )
    .await
    {
        tracing::error!(contract_id = contract.id, "Failed at sending email {err:#}")
    }
}

async fn liquidate_contract(
    db: &Pool<Postgres>,
    contract: &Contract,
    config: Config,
    latest_price: Decimal,
    current_ltv: Decimal,
) {
    if contract.liquidation_status == model::LiquidationStatus::Liquidated {
        tracing::debug!(contract_id = contract.id, "Contract already liquidated");
        return;
    }

    tracing::info!(
        contract_id = contract.id,
        "Marking contract for being liquidated"
    );
    if let Err(err) = db::contracts::mark_liquidation_state_as(
        db,
        contract.id.as_str(),
        LiquidationStatus::Liquidated,
    )
    .await
    {
        tracing::error!(
            contract_id = contract.id,
            "Failed updating liquidation status to liquidated {err:#}"
        )
    }
    if let Err(err) = send_email(
        db,
        contract,
        config,
        latest_price,
        current_ltv,
        LiquidationStatus::Liquidated,
    )
    .await
    {
        tracing::error!(contract_id = contract.id, "Failed at sending email {err:#}")
    }
}

async fn send_email(
    pool: &Pool<Postgres>,
    contract: &Contract,
    config: Config,
    price: Decimal,
    current_ltv: Decimal,
    status: LiquidationStatus,
) -> Result<()> {
    let user = db::borrowers::get_user_by_id(pool, contract.borrower_id.as_str())
        .await?
        .context("user not found")?;

    let email = Email::new(
        User {
            email: "test@philipp.ai".to_string(),
            ..user
        },
        "".to_string(),
        config,
    );

    match status {
        LiquidationStatus::Healthy => {
            //none
        }
        LiquidationStatus::FirstMarginCall | LiquidationStatus::SecondMarginCall => {
            if let Err(err) = email
                .send_user_about_margin_call(contract.clone(), price, current_ltv)
                .await
            {
                bail!("Failed sending email {err:#}")
            }
        }
        LiquidationStatus::Liquidated => {
            if let Err(err) = email
                .send_user_about_liquidation_notice(contract.clone(), price)
                .await
            {
                bail!("Failed sending email {err:#}")
            }
        }
    }

    Ok(())
}
