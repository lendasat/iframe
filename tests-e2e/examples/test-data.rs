use anyhow::Context;
use anyhow::Result;
use bitcoin::bip32;
use bitcoin::hex::Case;
use bitcoin::hex::DisplayHex;
use bitcoin::Address;
use bitcoin::Network;
use bitcoin::PublicKey;
use client_sdk::wallet::Wallet;
use hub::api_keys::ApiKeyHash;
use hub::config::Config;
use hub::contract_requests::calculate_initial_funding_amount;
use hub::db;
use hub::db::wallet_backups::NewBorrowerWalletBackup;
use hub::db::wallet_backups::NewLenderWalletBackup;
use hub::model::generate_installments;
use hub::model::Borrower;
use hub::model::Contract;
use hub::model::ContractStatus;
use hub::model::ContractVersion;
use hub::model::CreateLoanOfferSchema;
use hub::model::LatePenalty;
use hub::model::Lender;
use hub::model::LoanAsset;
use hub::model::LoanOffer;
use hub::model::LoanPayout;
use hub::model::LoanType;
use hub::model::Npub;
use hub::model::RepaymentPlan;
use hub::model::ONE_YEAR;
use hub::moon::Card;
use rand::thread_rng;
use rand::Rng;
use reqwest::Url;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sha2::Digest;
use sha2::Sha256;
use sqlx::postgres::PgPoolOptions;
use sqlx::Pool;
use sqlx::Postgres;
use std::num::NonZeroU64;
use std::str::FromStr;
use time::macros::format_description;
use time::OffsetDateTime;
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

    let (lender, mut lender_wallet) = init_lender(&pool, network.as_str()).await?;
    tracing::debug!(id = lender.id, email = lender.email, "Lender created");

    let (borrower, mut borrower_wallet) = init_borrower(&pool, network.as_str()).await?;
    tracing::debug!(id = borrower.id, email = borrower.email, "Borrower created");

    let offers = create_loan_offers(&pool, &lender, &mut lender_wallet).await?;

    create_sample_contracts(&pool, &borrower, &mut borrower_wallet, &lender, &offers[1]).await?;

    create_sample_card(&pool, &borrower).await?;

    tracing::info!(
        api_key = "lndst_sk_dee619e34a7e_NI2TUiMmYF9TcBavaFhUW0rZ63QOIsoldG1w0YdFMpR",
        "Borrower API key"
    );

    let api_key_hash = ApiKeyHash::new(
        "dee619e34a7e".to_string(),
        vec![
            0xad, 0xb1, 0x9d, 0x65, 0xe7, 0xeb, 0x6f, 0x0b, 0x45, 0x71, 0xb0, 0x1a, 0x89, 0x7b,
            0xe0, 0xa1,
        ],
        "066a7750b4343aa18fe3677c640ecb2078bf6f7e6a10cb71f085e753c8b5192d".to_string(),
    );

    // TODO: Just skip if the API keys already exist!
    insert_borrower_api_key(&pool, &borrower.id, &api_key_hash).await?;

    tracing::info!(
        api_key = "lndst_sk_31ce1f53b53e_VTOWwjHcsPMHvn7UJgNnvQlr0xHXBpuSHCNo8mLkph8",
        "Lender API key"
    );

    let api_key_hash = ApiKeyHash::new(
        "31ce1f53b53e".to_string(),
        vec![
            0x8e, 0x9a, 0xe8, 0x0a, 0x99, 0x4d, 0x24, 0x55, 0x87, 0xef, 0x21, 0x2e, 0x73, 0xca,
            0x06, 0xa0,
        ],
        "3597aefe66391db7f0abbfeafeb4451ca4ff9c6bd14562aca833558a1321eabe".to_string(),
    );

    insert_lender_api_key(&pool, &lender.id, &api_key_hash).await?;

    // The corresponding API account creator API key is `theboss`.
    let sha256 = create_sha256(b"theboss");
    db::api_account_creator::register(&pool, sha256.as_str(), "the boss").await?;

    Ok(())
}

fn create_sha256(value: &[u8; 7]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value);
    let result = hasher.finalize();
    result[..].to_hex_string(Case::Lower)
}

async fn create_sample_contracts(
    pool: &Pool<Postgres>,
    borrower: &Borrower,
    borrower_wallet: &mut Wallet,
    lender: &Lender,
    offer: &LoanOffer,
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
        let (pk, path) = borrower_wallet.next_hardened_pk()?;
        let npub = "npub1gh2nzlkque4fvcg722tk0st35e9qwal04cn54t8mhpxpj80jfuvq58cvlt".parse()?;

        let contract1 = create_contract_request(
            pool,
            offer,
            offer.loan_amount_min,
            borrower.id.as_str(),
            pk,
            path,
            npub,
            borrower_wallet.network(),
        )
        .await?;

        let (pk, path) = borrower_wallet.next_hardened_pk()?;
        let contract2 = create_contract_request(
            pool,
            offer,
            offer.loan_amount_min + dec!(1),
            borrower.id.as_str(),
            pk,
            path,
            npub,
            borrower_wallet.network(),
        )
        .await?;

        (contract1, contract2)
    };

    let contract_address = address_for_network(borrower_wallet.network());
    accept_loan_request(pool, &contract2, &lender.id, contract_address).await?;

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
    contract_address: Address,
) -> Result<Contract> {
    let mut transaction = pool.begin().await?;

    let contract = db::contracts::accept_contract_request(
        &mut transaction,
        lender_id,
        contract.id.as_str(),
        contract_address,
        1,
    )
    .await?;
    transaction.commit().await?;
    Ok(contract)
}

#[allow(clippy::too_many_arguments)]
async fn create_contract_request(
    pool: &Pool<Postgres>,
    offer: &LoanOffer,
    loan_amount: Decimal,
    borrower_id: &str,
    borrower_pk: PublicKey,
    borrower_derivation_path: bip32::DerivationPath,
    borrower_npub: Npub,
    network: Network,
) -> Result<Contract> {
    let contract_id = Uuid::new_v4();
    let initial_ltv = dec!(0.5);
    let price = dec!(58_000);
    let one_btc_in_sats = dec!(100_000_000);
    let origination_fee_sats = ((loan_amount / price) * ORIGINATION_FEE_RATE) * one_btc_in_sats;
    let origination_fee_sats = origination_fee_sats.to_u64().expect("to fit");

    let duration_days = offer.duration_days_max;
    let interest_rate = offer.interest_rate;

    let initial_collateral_sats = calculate_initial_funding_amount(
        loan_amount,
        interest_rate,
        duration_days as u32,
        initial_ltv,
        price,
        bitcoin::Amount::from_sat(origination_fee_sats),
    )?;

    // Generated with this mnemonic:
    // pencil say next pact puzzle praise fringe amateur slim attend desk unknown
    let borrower_loan_address = "0x7Df138d358Bf4Fd5737F1eab95Bd80dBBddb3618";

    let borrower_btc_address = address_for_network(network);

    let contract = db::contracts::insert_new_contract_request(
        pool,
        contract_id,
        borrower_id,
        offer.lender_id.as_str(),
        offer.loan_deal_id.as_str(),
        initial_ltv,
        initial_collateral_sats.to_sat(),
        origination_fee_sats,
        loan_amount,
        duration_days,
        borrower_pk,
        borrower_derivation_path,
        offer.lender_pk,
        offer.lender_derivation_path.clone(),
        borrower_btc_address.into_unchecked(),
        offer.loan_repayment_address.clone(),
        offer
            .btc_loan_repayment_address
            .clone()
            .map(|a| a.to_string()),
        Some(borrower_loan_address),
        LoanType::StableCoin,
        ContractVersion::TwoOfThree,
        interest_rate,
        borrower_npub,
        offer.lender_npub,
        Some(Uuid::new_v4()),
        offer.extension_policy,
        offer.loan_asset,
    )
    .await?;

    let installments = generate_installments(
        OffsetDateTime::now_utc(),
        contract_id,
        RepaymentPlan::Bullet,
        NonZeroU64::new(duration_days as u64).expect("non-zero"),
        interest_rate,
        loan_amount,
        LatePenalty::FullLiquidation,
    );

    db::installments::insert(pool, installments).await?;

    Ok(contract)
}

async fn create_loan_offers(
    pool: &Pool<Postgres>,
    lender: &Lender,
    lender_wallet: &mut Wallet,
) -> Result<Vec<LoanOffer>> {
    let offers = db::loan_offers::load_all_loan_offers_by_lender(pool, &lender.id).await?;
    if !offers.is_empty() {
        tracing::debug!("DB already contains offer(s) by lender");

        return Ok(offers);
    }

    let lender_npub = "npub1x398pgcpwdnexq2zs84t9ru35l88h4txqy8586cksg45fta4ukvqqnd7tg".parse()?;

    // Generated with this mnemonic:
    // expose diagram minimum remind ribbon mushroom expect bone just theme car donate
    let loan_repayment_address = "0xd835111864Eb1Ce2Cc961fBb1ba3B8f2ce5E6fF2";

    let (pk, path) = lender_wallet.next_hardened_pk()?;

    let btc_loan_repayment_address = address_for_network(lender_wallet.network());

    let card_app_offer = db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "CardAppInstant".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.12),
            loan_amount_min: dec!(1),
            loan_amount_max: dec!(100_000),
            duration_days_min: 7,
            duration_days_max: ONE_YEAR as i32,
            loan_asset: LoanAsset::UsdcPol,
            loan_payout: LoanPayout::MoonCardInstant,
            loan_repayment_address: loan_repayment_address.to_string(),
            btc_loan_repayment_address: Some(btc_loan_repayment_address.to_string()),
            lender_pk: pk,
            lender_derivation_path: path,
            auto_accept: true,
            kyc_link: None,
            lender_npub,
            extension_duration_days: Some(7),
            extension_interest_rate: Some(dec!(0.12)),
            repayment_plan: RepaymentPlan::Bullet,
        },
        &lender.id,
    )
    .await?;
    let (pk, path) = lender_wallet.next_hardened_pk()?;

    let euro_offer = db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "Eur".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.12),
            loan_amount_min: dec!(1),
            loan_amount_max: dec!(100_000),
            duration_days_min: 7,
            duration_days_max: ONE_YEAR as i32,
            loan_asset: LoanAsset::Eur,
            loan_payout: LoanPayout::Direct,
            loan_repayment_address: loan_repayment_address.to_string(),
            btc_loan_repayment_address: None,
            lender_pk: pk,
            lender_derivation_path: path,
            auto_accept: true,
            kyc_link: Some(Url::parse("https://nokycforlife.com").expect("to be valid")),
            lender_npub,
            extension_duration_days: Some(7),
            extension_interest_rate: Some(dec!(0.12)),
            repayment_plan: RepaymentPlan::Bullet,
        },
        &lender.id,
    )
    .await?;

    let (pk, path) = lender_wallet.next_hardened_pk()?;

    let poly_offer = db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "poly-usdc".to_string(),
            min_ltv: dec!(0.5),
            interest_rate: dec!(0.12),
            loan_amount_min: dec!(10),
            loan_amount_max: dec!(100_000),
            duration_days_min: 7,
            duration_days_max: ONE_YEAR as i32,
            loan_asset: LoanAsset::UsdcPol,
            loan_payout: LoanPayout::Direct,
            loan_repayment_address: loan_repayment_address.to_string(),
            btc_loan_repayment_address: None,
            lender_pk: pk,
            lender_derivation_path: path,
            auto_accept: true,
            kyc_link: None,
            lender_npub,
            extension_duration_days: Some(7),
            extension_interest_rate: Some(dec!(0.12)),
            repayment_plan: RepaymentPlan::Bullet,
        },
        &lender.id,
    )
    .await?;

    let (pk, path) = lender_wallet.next_hardened_pk()?;

    let direct_poly_offer = db::loan_offers::insert_loan_offer(
        pool,
        CreateLoanOfferSchema {
            name: "poly-usdc".to_string(),
            min_ltv: dec!(0.7),
            interest_rate: dec!(0.08),
            loan_amount_min: dec!(10),
            loan_amount_max: dec!(100_000),
            duration_days_min: 7,
            duration_days_max: ONE_YEAR as i32,
            loan_asset: LoanAsset::UsdcPol,
            loan_payout: LoanPayout::Indirect,
            loan_repayment_address: "0xd835111864Eb1Ce2Cc961fBb1ba3B8f2ce5E6fF2".to_string(),
            btc_loan_repayment_address: None,
            lender_pk: pk,
            lender_derivation_path: path,
            auto_accept: true,
            kyc_link: None,
            lender_npub,
            extension_duration_days: Some(7),
            extension_interest_rate: Some(dec!(0.8)),
            repayment_plan: RepaymentPlan::Bullet,
        },
        &lender.id,
    )
    .await?;

    Ok(vec![
        euro_offer,
        poly_offer,
        direct_poly_offer,
        card_app_offer,
    ])
}

async fn init_lender(pool: &Pool<Postgres>, network: &str) -> Result<(Lender, Wallet)> {
    let mnemonic =
        "myself hollow clog kitchen glimpse hard submit media resource report educate luxury"
            .parse()?;

    let mut rng = thread_rng();
    let contract_index = rng.gen_range(0..(2_u32.pow(31)));

    let (wallet, mnemonic_ciphertext) =
        Wallet::new(&mut rng, mnemonic, "password123", network, contract_index)?;

    let email = "lender@lendasat.com";
    if db::lenders::user_exists(pool, email).await? {
        tracing::debug!("DB already contains the lender, not inserting another one");

        let lender = db::lenders::get_user_by_email(pool, email)
            .await?
            .expect("expect to have user");
        enable_lender_features(pool, lender.id.as_str())
            .await
            .expect("to be able to enable feature");

        return Ok((lender, wallet));
    }

    let lender =
        db::lenders::register_user(
            pool,
            "alice the lender",
            email,
            "2020e9cd8b43d9202e83ef88734680d0",
            "8233a91075c28c58c7aea7b748fafc3bf8c563c863d740e4ecf815228cb92642644110fa5776ffe94e7f797570f039a523759324ff1ae11858b0da689dc5d9f46c9eee5b44df33094e76ee8a073851c48b3cef6d8c81a6953d3c64919ae1c29fb0a2a884244e4187b13578e68d72d7d8c83c045179eef062e2454b29fb87052a4d31cca7eff4fad75746db3cb468a5421dd6f56592af836723e478de327ab39238bbba47ceb6470fc0e92483a8f910279a883877fec38ced03574cfc09f1ad94da5630566300d87ea1838949a684e0fbd84086c4c012f1ad1562cb5b6e248dba67dc0f5c84048bbc023a4e0cc0596e37e234fba7070df96563d3f10153ad4e95",
            None
        ).await?;
    let verification_code = lender.verification_code.clone().expect("to exist");
    db::lenders::verify_user(pool, verification_code.as_str()).await?;

    enable_lender_features(pool, lender.id.as_str())
        .await
        .expect("to be able to enable feature");

    db::wallet_backups::insert_lender_backup(
        pool,
        NewLenderWalletBackup {
            lender_id: lender.id.clone(),
            mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
            network: network.to_string(),
        },
    )
    .await?;

    Ok((lender, wallet))
}

async fn init_borrower(pool: &Pool<Postgres>, network: &str) -> Result<(Borrower, Wallet)> {
    let mnemonic =
        "black usage cross fiscal ostrich park glass canoe talk return live anchor".parse()?;

    let mut rng = thread_rng();
    let contract_index = rng.gen_range(0..(2_u32.pow(31)));

    let (wallet, mnemonic_ciphertext) =
        Wallet::new(&mut rng, mnemonic, "password123", network, contract_index)?;

    let email = "borrower@lendasat.com";
    if db::borrowers::user_exists(pool, email)
        .await
        .context("Could not load borrower")?
    {
        tracing::debug!("DB already contains the borrower, not inserting another one");

        let (borrower, _) = db::borrowers::get_user_by_email(pool, email)
            .await?
            .expect("expect to have user");
        enable_borrower_features(pool, borrower.id.as_str()).await?;

        return Ok((borrower, wallet));
    }

    let mut tx = pool.begin().await?;
    let (borrower, password_auth_info) = db::borrowers::register_password_auth_user(&mut tx, "bob the borrower", email, "cd8c88861c37f137eb08ee009ba7974e", "9c09ebb870171a9dc4fee895a85bfee036b4a3021f685e16f55c2c4df2032fd68ccbf6aa823f130c0dbcdb59db682c54d98c4bbcb4d934a4a27223b361f3b5838970f4d708bb884078b438a7548c85d8625865af010fc9ca55ef7295eafe27dd38b2fed5b32c215f89536aaf8f989a6b155a60003ef9a161b0d25445d5338ae623893a42a5af14355d0416bd1da19e2f9af040a58f30f8a3619ff080b7e661da06d1a0afa8b7bdecf62db3066aeb28413b68fb51cea1091981b55f49aab5b9e3e6f79ac1adb5015eda5afb3a04839853f6f6e552703babd4d0420d13396b4f3a0c012e3fdac9a140b3b2ff72d27ab286690870aa251400203bc1acf7b2e2a3c0")
        .await
        .context("register user failed")?;
    db::borrowers_referral_code::insert_referred_borrower(
        &mut *tx,
        "BETA_PHASE_1",
        borrower.id.as_str(),
    )
    .await?;

    tx.commit().await?;

    db::borrowers_referral_code::create_referral_code(
        pool,
        Some("demo".to_string()),
        borrower.id.as_str(),
    )
    .await
    .context("insert referral code failed")?;

    let verification_code = password_auth_info
        .verification_code
        .clone()
        .expect("to exist");
    db::borrowers::verify_user(pool, verification_code.as_str()).await?;
    enable_borrower_features(pool, borrower.id.as_str()).await?;

    db::wallet_backups::insert_borrower_backup(
        pool,
        NewBorrowerWalletBackup {
            borrower_id: borrower.id.clone(),
            mnemonic_ciphertext: mnemonic_ciphertext.serialize(),
            network: network.to_string(),
        },
    )
    .await?;

    Ok((borrower, wallet))
}

async fn enable_borrower_features(pool: &Pool<Postgres>, user_id: &str) -> Result<()> {
    db::borrower_features::enable_feature(pool, user_id, "pay_with_moon").await?;
    Ok(())
}

async fn enable_lender_features(pool: &Pool<Postgres>, user_id: &str) -> Result<()> {
    db::lender_features::enable_feature(pool, user_id, "auto_approve").await?;
    db::lender_features::enable_feature(pool, user_id, "kyc_offers").await?;
    Ok(())
}

async fn insert_borrower_api_key(
    pool: &Pool<Postgres>,
    borrower_id: &str,
    api_key_hash: &ApiKeyHash,
) -> Result<()> {
    db::api_keys::insert_borrower(pool, api_key_hash, borrower_id, "test").await?;

    Ok(())
}

async fn insert_lender_api_key(
    pool: &Pool<Postgres>,
    lender_id: &str,
    api_key_hash: &ApiKeyHash,
) -> Result<()> {
    db::api_keys::insert_lender(pool, api_key_hash, lender_id, "test").await?;

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

pub fn address_for_network(network: Network) -> Address {
    match network {
        Network::Signet => Address::from_str("tb1qtsasnju08gh7ptqg7260qujgasvtexkf9t3yj3")
            .expect("to be a valid address")
            .assume_checked(),
        _ => Address::from_str("bcrt1qm7h898p7fjftemh7hpr40djwhysa9secqyjxlj")
            .expect("to be a valid address")
            .assume_checked(),
    }
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
