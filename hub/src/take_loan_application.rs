use crate::bitmex_index_price_rest::get_bitmex_index_price;
use crate::config::Config;
use crate::contract_requests;
use crate::contract_requests::calculate_origination_fee;
use crate::db;
use crate::discounted_origination_fee;
use crate::mempool;
use crate::mempool::TrackContractFunding;
use crate::model::ContractVersion;
use crate::notifications::Notifications;
use crate::routes::lender::loan_applications::TakeLoanApplicationSchema;
use crate::wallet::Wallet;
use anyhow::anyhow;
use sqlx::PgPool;
use std::sync::Arc;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Failed to interact with the database.")]
    Database(#[source] anyhow::Error),
    #[error("No origination fee configured")]
    MissingOriginationFee,
    #[error("Discount rate invalid")]
    InvalidDiscountRate(#[source] anyhow::Error),
    #[error("Failed to get price")]
    BitMexPrice(#[source] anyhow::Error),
    #[error("Failed to calculate initial collateral")]
    InitialCollateralCalculation(#[source] anyhow::Error),
    #[error("Failed to generate contract address.")]
    ContractAddress(#[source] anyhow::Error),
    #[error("Failed to calculate origination fee in sats.")]
    OriginationFeeCalculation(#[source] anyhow::Error),
    #[error("Failed to track accepted contract using Mempool API.")]
    TrackContract(#[source] anyhow::Error),
    #[error("Loan application not found")]
    LoanApplicationNotFound(String),
}

/// Takes a loan application and returns the contract id if successful
#[allow(clippy::too_many_arguments)]
pub async fn take_application(
    db: &PgPool,
    wallet: Arc<Wallet>,
    mempool_actor: &xtra::Address<mempool::Actor>,
    config: &Config,
    lender_id: &str,
    _notifications: Arc<Notifications>,
    take_application_body: TakeLoanApplicationSchema,
    loan_deal_id: &str,
) -> Result<String, Error> {
    let contract_id = Uuid::new_v4();

    let current_price = get_bitmex_index_price(config, OffsetDateTime::now_utc())
        .await
        .map_err(Error::BitMexPrice)?;

    let loan_application = db::loan_applications::get_loan_by_id(db, loan_deal_id)
        .await
        .map_err(Error::Database)?
        .ok_or(Error::LoanApplicationNotFound(loan_deal_id.to_string()))?;

    let initial_collateral = contract_requests::calculate_initial_collateral(
        loan_application.loan_amount,
        loan_application.interest_rate,
        loan_application.duration_days as u32,
        loan_application.ltv,
        current_price,
    )
    .map_err(Error::InitialCollateralCalculation)?;

    let origination_fee = config
        .origination_fee
        .first()
        .ok_or(Error::MissingOriginationFee)?;

    let origination_fee_rate =
        discounted_origination_fee::calculate_discounted_origination_fee_rate(
            db,
            origination_fee.fee,
            loan_application.borrower_id.as_str(),
        )
        .await
        .map_err(Error::from)?;

    let origination_fee = calculate_origination_fee(
        loan_application.loan_amount,
        origination_fee_rate,
        current_price,
    )
    .map_err(Error::OriginationFeeCalculation)?;

    let (contract_address, contract_index) = wallet
        .contract_address(
            loan_application.borrower_pk,
            take_application_body.lender_pk,
            ContractVersion::TwoOfThree,
        )
        .await
        .map_err(Error::ContractAddress)?;

    let contract = db::contracts::insert_new_taken_contract_application(
        db,
        contract_id,
        loan_application.borrower_id.as_str(),
        lender_id,
        loan_deal_id,
        loan_application.ltv,
        initial_collateral.to_sat(),
        origination_fee.to_sat(),
        loan_application.loan_amount,
        loan_application.duration_days,
        loan_application.borrower_pk,
        loan_application.borrower_derivation_path,
        take_application_body.lender_pk,
        take_application_body.lender_derivation_path,
        loan_application.borrower_btc_address,
        loan_application.borrower_loan_address.as_deref(),
        take_application_body.loan_repayment_address,
        loan_application.loan_type,
        ContractVersion::TwoOfThree,
        loan_application.interest_rate,
        contract_address.as_unchecked().clone(),
        contract_index,
        &loan_application.borrower_npub,
        &take_application_body.lender_npub,
        loan_application.client_contract_id,
    )
    .await
    .map_err(Error::Database)?;

    db::loan_applications::mark_as_taken_by_borrower_and_application_id(
        db,
        loan_application.borrower_id.as_str(),
        loan_application.loan_deal_id.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    mempool_actor
        .send(TrackContractFunding::new(
            contract_id.to_string(),
            contract_address,
        ))
        .await
        .expect("actor to be alive")
        .map_err(Error::TrackContract)?;

    // TODO: send notifications

    Ok(contract.id)
}

impl From<discounted_origination_fee::Error> for Error {
    fn from(value: discounted_origination_fee::Error) -> Self {
        match value {
            discounted_origination_fee::Error::InvalidDiscountRate { fee } => {
                Error::InvalidDiscountRate(anyhow!(format!("Discount rate was not valid {fee}")))
            }
            discounted_origination_fee::Error::Database(e) => Error::Database(anyhow!(e)),
        }
    }
}
