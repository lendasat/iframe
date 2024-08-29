use anyhow::Context;
use anyhow::Result;
use hub::config::Config;
use hub::db;
use hub::model::Contract;
use hub::model::CreateLoanOfferSchema;
use hub::model::LoanAssetChain;
use hub::model::LoanAssetType;
use hub::model::LoanOffer;
use hub::model::User;
use rust_decimal_macros::dec;
use sqlx::postgres::PgPoolOptions;
use sqlx::Pool;
use sqlx::Postgres;
use time::macros::format_description;
use tracing::level_filters::LevelFilter;
use tracing_subscriber::filter::Directive;
use tracing_subscriber::fmt::time::UtcTime;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::Layer;

const RUST_LOG_ENV: &str = "RUST_LOG";

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

    let loan_offer = insert_loan_offer(&pool, lender.clone()).await?;
    insert_contract(&pool, lender, borrower, loan_offer).await?;

    Ok(())
}

async fn insert_contract(
    pool: &Pool<Postgres>,
    lender: User,
    borrower: User,
    loan_offer: LoanOffer,
) -> Result<Contract> {
    let lender_loans = db::contracts::load_contracts_by_lender_id(pool, lender.id.as_str()).await?;
    if lender_loans
        .iter()
        .any(|contract| contract.borrower_id == borrower.id)
    {
        tracing::debug!(
            "DB already contains contract for test lender and test borrower, not inserting more"
        );
    }

    let contract = db::contracts::insert_contract_request(
        pool,
        borrower.id,
        loan_offer.id,
        loan_offer.min_ltv,
        10_000_000,
        dec!(1_000),
        12,
        "bcrt1q39c0vrwpgfjkhasu5mfke9wnym45nydfwaeems"
            .parse()
            .expect("to be valid"),
        "032e58afe51f9ed8ad3cc7897f634d881fdbe49a81564629ded8156bebd2ffd1af"
            .parse()
            .expect("to be valid"),
    )
    .await?;
    Ok(contract)
}

async fn insert_loan_offer(pool: &Pool<Postgres>, lender: User) -> Result<LoanOffer> {
    let lender_loans =
        db::loan_offers::load_all_loan_offers_by_lender(pool, lender.id.clone()).await?;

    if !lender_loans.is_empty() {
        tracing::debug!("DB already contains offers from test lender, not inserting more");
        let offer = lender_loans.first().expect("to be one").clone();
        return Ok(offer);
    }

    let loan_offer = db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "just a sample loan".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(12),
            loan_amount_min: dec!(1000),
            loan_amount_max: dec!(100_000),
            duration_months_min: 1,
            duration_months_max: 12,
            loan_asset_type: LoanAssetType::Usdc,
            loan_asset_chain: LoanAssetChain::Ethereum,
            loan_repayment_address: "0x4B0897b0513fdc7C541B6d9D7E929C4e5364D2dB".to_string(),
        },
        lender.id,
    )
    .await?;
    Ok(loan_offer)
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
    let user = db::lenders::register_user(pool, "alice the lender", email, "password123").await?;
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
    let user = db::borrowers::register_user(pool, "bob the borrower", email, "password123").await?;
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
