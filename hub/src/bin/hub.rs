use anyhow::Result;
use hub::config::Config;
use hub::db::connect_to_db;
use hub::db::run_migration;
use hub::logger::init_tracing;
use hub::routes::borrower::spawn_borrower_server;
use hub::routes::lender::spawn_lender_server;
use hub::wallet::Wallet;
use std::sync::Arc;
use tracing::level_filters::LevelFilter;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false, true).expect("to work");
    tracing::info!("Hello World");

    let config = Config::init();

    let db = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&db).await?;

    let hub_seed = seed_from_file(&config.seed_file)?;
    let wallet = Wallet::new(hub_seed, &config.fallback_xpub)?;
    let wallet = Arc::new(wallet);

    let borrower_server = spawn_borrower_server(config.clone(), wallet.clone(), db.clone()).await;

    let lender_server = spawn_lender_server(config, wallet, db).await;

    let _ = tokio::join!(borrower_server, lender_server);

    tracing::info!("Servers stopped");

    Ok(())
}

fn seed_from_file(path: &str) -> Result<Vec<u8>> {
    let path = std::path::Path::new(path);

    let seed = std::fs::read(path)?;

    Ok(seed)
}
