use anyhow::Result;
use hub::config::Config;
use hub::db::connect_to_db;
use hub::db::run_migration;
use hub::logger::init_tracing;
use hub::routes::borrower::spawn_borrower_server;
use hub::routes::lender::spawn_lender_server;
use tracing::level_filters::LevelFilter;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false, true).expect("to work");
    tracing::info!("Hello World");

    let config = Config::init();

    let db = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&db).await?;

    let borrower_server = spawn_borrower_server(config.clone(), db.clone()).await;

    let lender_server = spawn_lender_server(config, db).await;

    let _ = tokio::join!(borrower_server, lender_server);

    tracing::info!("Servers stopped");

    Ok(())
}
