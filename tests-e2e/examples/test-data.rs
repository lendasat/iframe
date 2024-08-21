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
use tracing::level_filters::LevelFilter;

#[tokio::main]
async fn main() -> Result<()> {
    tests_e2e::logger::init_tracing(LevelFilter::DEBUG, false, true)?;

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
        "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr"
            .parse()
            .unwrap(),
        "032e58afe51f9ed8ad3cc7897f634d881fdbe49a81564629ded8156bebd2ffd1af"
            .parse()
            .unwrap(),
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
