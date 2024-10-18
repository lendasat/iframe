use anyhow::Context;
use anyhow::Result;
use bitcoin::bip32::Xpub;
use bitcoin::Address;
use bitcoin::PublicKey;
use hub::config::Config;
use hub::db;
use hub::model::Contract;
use hub::model::ContractStatus;
use hub::model::CreateLoanOfferSchema;
use hub::model::LoanAssetChain;
use hub::model::LoanAssetType;
use hub::model::LoanOffer;
use hub::model::User;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::postgres::PgPoolOptions;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;
use time::macros::format_description;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::filter::Directive;
use tracing_subscriber::fmt::time::UtcTime;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::Layer;

const RUST_LOG_ENV: &str = "RUST_LOG";

const ORIGINATION_FEE_RATE: Decimal = dec!(0.01);

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false, true)?;

    let config = Config::init();
    let pool = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&pool).await?;

    let lender = insert_lender(&pool).await?;
    tracing::debug!(id = lender.id, email = lender.email, "Lender created");
    let borrower = insert_borrower(&pool).await?;
    tracing::debug!(id = borrower.id, email = borrower.email, "Borrower created");

    let offer = create_loan_offer(&pool, lender.id.as_str()).await?;

    create_sample_contracts(&pool, &borrower, &offer, lender.id.as_str()).await?;

    Ok(())
}

async fn create_sample_contracts(
    pool: &Pool<Postgres>,
    borrower: &User,
    offer: &LoanOffer,
    lender_id: &str,
) -> Result<()> {
    let borrower_contracts =
        db::contracts::load_contracts_by_borrower_id(pool, borrower.id.as_str()).await?;
    let requested = borrower_contracts
        .iter()
        .filter(|contract| contract.status == ContractStatus::Requested)
        .count();
    let approved = borrower_contracts
        .iter()
        .filter(|contract| contract.status == ContractStatus::Approved)
        .count();

    if requested > 0 && approved > 0 {
        tracing::debug!("DB already contains one approved and one requested");

        return Ok(());
    }

    let _contract1 =
        create_loan_request(pool, offer, offer.loan_amount_min, borrower.id.as_str()).await?;
    let contract2 =
        create_loan_request(pool, offer, offer.loan_amount_max, borrower.id.as_str()).await?;

    accept_loan_request(pool, contract2, lender_id).await?;
    Ok(())
}

async fn accept_loan_request(
    pool: &Pool<Postgres>,
    contract: Contract,
    lender_id: &str,
) -> Result<Contract> {
    db::contracts::accept_contract_request(
        pool,
        lender_id,
        contract.id.as_str(),
        Address::from_str("tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3")
            .expect("to be a valid address")
            .assume_checked(),
        1,
        Xpub::from_str("tpubDAenfwNu5GyCJWv8oqRAckdKMSUoZjgVF5p8WvQwHQeXjDhAHmGrPa4a4y2Fn7HF2nfCLefJanHV3ny1UY25MRVogizB2zRUdAo7Tr9XAjm")
            .expect("valid xpub"),
    )
    .await
}

async fn create_loan_request(
    pool: &Pool<Postgres>,
    offer: &LoanOffer,
    loan_amount: Decimal,
    borrower_id: &str,
) -> Result<Contract> {
    let initial_ltv = dec!(0.5);
    let price = dec!(58_000);
    let one_btc_in_sats = dec!(100_000_000);
    let initial_collateral_sats = ((loan_amount / initial_ltv) / price) * one_btc_in_sats;
    let origination_fee_sats = ((loan_amount / price) * ORIGINATION_FEE_RATE) * one_btc_in_sats;
    db::contracts::insert_contract_request(
        pool,
        borrower_id,
        offer.id.as_str(),
        initial_ltv,
        initial_collateral_sats.to_u64().expect("to fit"),
        origination_fee_sats.to_u64().expect("to fit"),
        loan_amount,
        offer.duration_months_max,
        Address::from_str("tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3")
            .expect("to be valid address"),
        PublicKey::from_str("0363b379acd22b63c29179ad1bff81251e5c0df43a4f53f0e9d9c1f4b800a4243c")
            .expect("to be valid pk"),
        "0x34e3f03F5efFaF7f70Bb1FfC50274697096ebe9d",
    )
    .await
}

async fn create_loan_offer(pool: &Pool<Postgres>, lender_id: &str) -> Result<LoanOffer> {
    let offers = db::loan_offers::load_all_loan_offers_by_lender(pool, lender_id).await?;
    if !offers.is_empty() {
        tracing::debug!("DB already contains offer by lender");

        return offers.first().context("to have one ").cloned();
    }

    db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "sample_offer".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.12),
            loan_amount_min: dec!(1_000),
            loan_amount_max: dec!(100_000),
            duration_months_min: 3,
            duration_months_max: 18,
            loan_asset_type: LoanAssetType::Usdt,
            loan_asset_chain: LoanAssetChain::Ethereum,
            loan_repayment_address: "0x34e3f03F5efFaF7f70Bb1FfC50274697096ebe9d".to_string(),
        },
        lender_id,
    )
    .await
}

async fn insert_lender(pool: &Pool<Postgres>) -> Result<User> {
    let email = "lender@lendasat.com";
    if db::lenders::user_exists(pool, email).await? {
        tracing::debug!("DB already contains the lender, not inserting another one");

        let maybe_user = db::lenders::get_user_by_email(pool, email)
            .await?
            .expect("expect to have user");
        return Ok(maybe_user);
    }
    let user =
        db::lenders::register_user(pool, "alice the lender", email, "password123", None).await?;
    let verification_code = user.verification_code.clone().expect("to exist");
    db::lenders::verify_user(pool, verification_code.as_str()).await?;

    Ok(user)
}

async fn insert_borrower(pool: &Pool<Postgres>) -> Result<User> {
    let email = "borrower@lendasat.com";
    if db::borrowers::user_exists(pool, email).await? {
        tracing::debug!("DB already contains the borrower, not inserting another one");

        let maybe_user = db::borrowers::get_user_by_email(pool, email)
            .await?
            .expect("expect to have user");
        return Ok(maybe_user);
    }
    let user =
        db::borrowers::register_user(pool, "bob the borrower", email, "password123", None).await?;
    let verification_code = user.verification_code.clone().expect("to exist");
    db::borrowers::verify_user(pool, verification_code.as_str()).await?;

    Ok(user)
}

pub async fn connect_to_db(db_connection: &str) -> Result<Pool<Postgres>> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(db_connection)
        .await?;
    Ok(pool)
}

pub async fn run_migration(pool: &Pool<Postgres>) -> Result<()> {
    sqlx::migrate!("../hub/migrations").run(pool).await?;
    Ok(())
}

pub fn init_tracing(level: LevelFilter, json_format: bool, is_console: bool) -> Result<()> {
    if level == LevelFilter::OFF {
        return Ok(());
    }

    let mut filter = EnvFilter::new("")
        .add_directive("sqlx::query=warn".parse()?)
        .add_directive(Directive::from(level));

    // Parse additional log directives from env variable
    let filter = match std::env::var_os(RUST_LOG_ENV).map(|s| s.into_string()) {
        Some(Ok(env)) => {
            for directive in env.split(',') {
                #[allow(clippy::print_stdout)]
                match directive.parse() {
                    Ok(d) => filter = filter.add_directive(d),
                    Err(e) => println!("WARN ignoring log directive: `{directive}`: {e}"),
                };
            }
            filter
        }
        _ => filter,
    };

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_writer(std::io::stderr)
        .with_ansi(is_console);

    let fmt_layer = if json_format {
        fmt_layer.json().with_timer(UtcTime::rfc_3339()).boxed()
    } else {
        fmt_layer
            .with_timer(UtcTime::new(format_description!(
                "[year]-[month]-[day] [hour]:[minute]:[second]"
            )))
            .boxed()
    };

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer)
        .try_init()
        .context("Failed to init tracing")?;

    tracing::debug!("Initialized logger");

    Ok(())
}
