use anyhow::Context;
use anyhow::Result;
use hub::config::Config;
use hub::db;
use hub::model::User;
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

    Ok(())
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
