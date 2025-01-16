use anyhow::Context;
use anyhow::Result;
use bitcoin::bip32::Xpub;
use bitcoin::Address;
use bitcoin::PublicKey;
use browser_wallet::wallet;
use hub::config::Config;
use hub::db;
use hub::db::wallet_backups::NewBorrowerWalletBackup;
use hub::db::wallet_backups::NewLenderWalletBackup;
use hub::model::Borrower;
use hub::model::Contract;
use hub::model::ContractStatus;
use hub::model::ContractVersion;
use hub::model::CreateLoanOfferSchema;
use hub::model::Integration;
use hub::model::Lender;
use hub::model::LoanAssetChain;
use hub::model::LoanAssetType;
use hub::model::LoanOffer;
use hub::moon::Card;
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
use uuid::Uuid;

const RUST_LOG_ENV: &str = "RUST_LOG";

const ORIGINATION_FEE_RATE: Decimal = dec!(0.01);

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false, true)?;
    let network = std::env::var("NETWORK").expect("NETWORK must be set");

    let config = Config::init();
    let pool = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&pool).await?;

    let lender = insert_lender(&pool, network.as_str()).await?;
    tracing::debug!(id = lender.id, email = lender.email, "Lender created");
    let borrower = insert_borrower(&pool, network.as_str()).await?;
    tracing::debug!(id = borrower.id, email = borrower.email, "Borrower created");

    let offers = create_loan_offers(&pool, lender.id.as_str()).await?;

    create_sample_contracts(&pool, &borrower, &offers[0], lender.id.as_str()).await?;

    create_sample_card(&pool, &borrower).await?;

    Ok(())
}

async fn create_sample_contracts(
    pool: &Pool<Postgres>,
    borrower: &Borrower,
    offer: &LoanOffer,
    lender_id: &str,
) -> Result<(Contract, Contract)> {
    let borrower_contracts =
        db::contracts::load_contracts_by_borrower_id(pool, borrower.id.as_str()).await?;
    let requested = borrower_contracts
        .iter()
        .filter(|contract| contract.status == ContractStatus::Requested)
        .collect::<Vec<_>>();
    let approved = borrower_contracts
        .iter()
        .filter(|contract| contract.status == ContractStatus::Approved)
        .collect::<Vec<_>>();

    let (contract1, contract2) = if !requested.is_empty() && !approved.is_empty() {
        tracing::debug!("DB already contains one approved and one requested");
        let requested = requested.first().cloned().expect("to be one").clone();
        let approved = approved.first().cloned().expect("to be one").clone();
        (requested, approved)
    } else {
        let lender_xpub = offer
            .lender_xpub
            .clone()
            .expect("lender Xpub")
            .parse()
            .expect("valid lender Xpub");
        let contract1 = create_loan_request(
            pool,
            offer,
            offer.loan_amount_min,
            borrower.id.as_str(),
            lender_xpub,
        )
        .await?;
        let contract2 = create_loan_request(
            pool,
            offer,
            offer.loan_amount_max,
            borrower.id.as_str(),
            lender_xpub,
        )
        .await?;
        (contract1, contract2)
    };

    accept_loan_request(pool, &contract2, lender_id).await?;

    Ok((contract1, contract2))
}

async fn create_sample_card(pool: &Pool<Postgres>, borrower: &Borrower) -> Result<Card> {
    let borrower_id = borrower.id.as_str();
    let end_customer_id = Uuid::new_v4();

    let cards = db::moon::get_borrower_cards(pool, borrower_id).await?;
    if !cards.is_empty() {
        let card = cards
            .first()
            .cloned()
            .context("to have at least one card")?;
        tracing::debug!(card_id = card.id.to_string(), "Load sample card from tdb");
        return Ok(card);
    }

    // The data below was taken once from a stagenet run. If their data is persistant, then there
    // might be some transactions attached
    let card = Card {
        id: Uuid::from_str("0926cd27-7774-4fb3-9f9b-5f23744445e7").expect("to be valid"),
        balance: Decimal::ZERO,
        available_balance: Decimal::ZERO,
        expiration: "01/70".to_string(),
        pan: "4513650002606667".to_string(),
        cvv: "064".to_string(),
        support_token: "028084d792".to_string(),
        product_id: Uuid::from_str("8f1c611d-098d-4f61-b106-f7b6d344b1ae").expect("to be valid"),
        end_customer_id: end_customer_id.to_string(),
        borrower_id: borrower_id.to_string(),
    };

    tracing::debug!(
        card_id = card.id.to_string(),
        "Inserting sample card into DB"
    );

    db::moon::insert_card(pool, card.clone()).await?;

    Ok(card)
}

async fn accept_loan_request(
    pool: &Pool<Postgres>,
    contract: &Contract,
    lender_id: &str,
) -> Result<Contract> {
    let mut transaction = pool.begin().await?;

    let contract = db::contracts::accept_contract_request(
        &mut transaction,
        lender_id,
        contract.id.as_str(),
        Address::from_str("tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3")
            .expect("to be a valid address")
            .assume_checked(),
        1,
    )
    .await?;
    transaction.commit().await?;
    Ok(contract)
}

async fn create_loan_request(
    pool: &Pool<Postgres>,
    offer: &LoanOffer,
    loan_amount: Decimal,
    borrower_id: &str,
    lender_xpub: Xpub,
) -> Result<Contract> {
    let id = Uuid::new_v4();
    let initial_ltv = dec!(0.5);
    let price = dec!(58_000);
    let one_btc_in_sats = dec!(100_000_000);
    let initial_collateral_sats = ((loan_amount / initial_ltv) / price) * one_btc_in_sats;
    let origination_fee_sats = ((loan_amount / price) * ORIGINATION_FEE_RATE) * one_btc_in_sats;
    db::contracts::insert_new_contract_request(
        pool,
        id,
        borrower_id,
        offer.lender_id.as_str(),
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
        Integration::StableCoin,
        lender_xpub,
        ContractVersion::TwoOfThree,
        offer.interest_rate,
    )
    .await
}

async fn create_loan_offers(pool: &Pool<Postgres>, lender_id: &str) -> Result<Vec<LoanOffer>> {
    let offers = db::loan_offers::load_all_loan_offers_by_lender(pool, lender_id).await?;
    if !offers.is_empty() {
        tracing::debug!("DB already contains offer(s) by lender");

        return Ok(offers);
    }

    let lender_xpub = "tpubDAenfwNu5GyCJWv8oqRAckdKMSUoZjgVF5p8WvQwHQeXjDhAHmGrPa4a4y2Fn7HF2nfCLefJanHV3ny1UY25MRVogizB2zRUdAo7Tr9XAjm".parse().expect("valid Xpub");
    let eth_offer = db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "eth-usdt".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.12),
            loan_amount_min: dec!(100),
            loan_amount_max: dec!(100_000),
            loan_amount_reserve: dec!(100_000),
            duration_months_min: 3,
            duration_months_max: 18,
            loan_asset_type: LoanAssetType::Usdt,
            loan_asset_chain: LoanAssetChain::Ethereum,
            loan_repayment_address: "0x34e3f03F5efFaF7f70Bb1FfC50274697096ebe9d".to_string(),
            auto_accept: true,
            lender_xpub,
        },
        lender_id,
    )
    .await?;

    let poly_offer = db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "poly-usdc".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.12),
            loan_amount_min: dec!(100),
            loan_amount_max: dec!(100_000),
            loan_amount_reserve: dec!(100_000),
            duration_months_min: 3,
            duration_months_max: 18,
            loan_asset_type: LoanAssetType::Usdc,
            loan_asset_chain: LoanAssetChain::Polygon,
            loan_repayment_address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619".to_string(),
            auto_accept: true,
            lender_xpub,
        },
        lender_id,
    )
    .await?;

    Ok(vec![eth_offer, poly_offer])
}

async fn insert_lender(pool: &Pool<Postgres>, network: &str) -> Result<Lender> {
    let email = "lender@lendasat.com";
    if db::lenders::user_exists(pool, email).await? {
        tracing::debug!("DB already contains the lender, not inserting another one");

        let maybe_user = db::lenders::get_user_by_email(pool, email)
            .await?
            .expect("expect to have user");
        enable_lender_features(pool, maybe_user.id.as_str())
            .await
            .expect("to be able to enable feature");
        return Ok(maybe_user);
    }

    let user =
        db::lenders::register_user(
            pool,
            "alice the lender",
            email,
            "31ed84e76920c72530ef63744c859138",
            "0abfe7966b8b64eb14fe2b20e7da58b6e97e96cc59a5fc4185768205d0a595f2f99c5b532960f62161eff5a5e11489b2c0fd0dc3000164f6d2e0bd18e4af576bc0b445090bf27a154a484f41df85577e5aeb594b6c51c81b65aad9bbbef7614b6f2e4f98fede089b97c81710f627c258c1b8acb4dc0f125122f37ea5a831081352965dc401af81211800f92208c9aa308d344329b11701fc6bd510dbe089636514f1dd5e6e9428bb832535ad85625c7808d4b6b6557104ae0104406761f16294d1fcc405ffda44c2e326944b83a30f601aceaec2a6b1b5a9c8ad6b4e4aea8b5a07a33c4760a52ec5049b760f303c3e57b63ed0f29add39e49dc70f19b86037b7",
            None
        ).await?;
    let verification_code = user.verification_code.clone().expect("to exist");
    db::lenders::verify_user(pool, verification_code.as_str()).await?;

    enable_lender_features(pool, user.id.as_str())
        .await
        .expect("to be able to enable feature");

    // We can only have one wallet loaded at the time, hence, we need to unload any existing one
    wallet::unload_wallet();
    let (mnemonic_ciphertext, network, xpub) = wallet::new_wallet("password123", network, None)?;
    db::wallet_backups::insert_lender_backup(
        pool,
        NewLenderWalletBackup {
            lender_id: user.id.clone(),
            mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
            network: network.to_string(),
            xpub: xpub.to_string(),
        },
    )
    .await?;

    Ok(user)
}

async fn insert_borrower(pool: &Pool<Postgres>, network: &str) -> Result<Borrower> {
    let email = "borrower@lendasat.com";
    if db::borrowers::user_exists(pool, email)
        .await
        .context("Could not load borrower")?
    {
        tracing::debug!("DB already contains the borrower, not inserting another one");

        let maybe_user = db::borrowers::get_user_by_email(pool, email)
            .await?
            .expect("expect to have user");
        enable_borrower_features(pool, maybe_user.id.as_str()).await?;
        return Ok(maybe_user);
    }

    let mut tx = pool.begin().await?;
    let user = db::borrowers::register_user(&mut tx, "bob the borrower", email, "cd8c88861c37f137eb08ee009ba7974e", "9c09ebb870171a9dc4fee895a85bfee036b4a3021f685e16f55c2c4df2032fd68ccbf6aa823f130c0dbcdb59db682c54d98c4bbcb4d934a4a27223b361f3b5838970f4d708bb884078b438a7548c85d8625865af010fc9ca55ef7295eafe27dd38b2fed5b32c215f89536aaf8f989a6b155a60003ef9a161b0d25445d5338ae623893a42a5af14355d0416bd1da19e2f9af040a58f30f8a3619ff080b7e661da06d1a0afa8b7bdecf62db3066aeb28413b68fb51cea1091981b55f49aab5b9e3e6f79ac1adb5015eda5afb3a04839853f6f6e552703babd4d0420d13396b4f3a0c012e3fdac9a140b3b2ff72d27ab286690870aa251400203bc1acf7b2e2a3c0")
        .await
        .context("register user failed")?;
    db::borrowers_referral_code::insert_referred_borrower(
        &mut *tx,
        "BETA_PHASE_1",
        user.id.as_str(),
    )
    .await?;

    tx.commit().await?;

    db::borrowers_referral_code::create_referral_code(
        pool,
        "demo",
        user.id.as_str(),
        dec!(0.5),
        dec!(0.5),
        dec!(0.25),
    )
    .await
    .context("insert referral code failed")?;

    let verification_code = user.verification_code.clone().expect("to exist");
    db::borrowers::verify_user(pool, verification_code.as_str()).await?;
    enable_borrower_features(pool, user.id.as_str()).await?;

    // We can only have one wallet loaded at the time, hence, we need to unload any existing one
    wallet::unload_wallet();
    let (mnemonic_ciphertext, network, xpub) = wallet::new_wallet("password123", network, None)?;
    db::wallet_backups::insert_borrower_backup(
        pool,
        NewBorrowerWalletBackup {
            borrower_id: user.id.clone(),
            mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
            network: network.to_string(),
            xpub: xpub.to_string(),
        },
    )
    .await?;

    Ok(user)
}

async fn enable_borrower_features(pool: &Pool<Postgres>, user_id: &str) -> Result<()> {
    db::borrower_features::enable_feature(pool, user_id, "pay_with_moon").await?;
    Ok(())
}

async fn enable_lender_features(pool: &Pool<Postgres>, user_id: &str) -> Result<()> {
    db::lender_features::enable_feature(pool, user_id, "auto_approve").await?;
    Ok(())
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
