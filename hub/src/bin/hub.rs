use anyhow::Result;
use hub::config::Config;
use hub::db::connect_to_db;
use hub::db::run_migration;
use hub::logger::init_tracing;
use hub::mempool;
use hub::routes::borrower::spawn_borrower_server;
use hub::routes::lender::spawn_lender_server;
use hub::wallet::Wallet;
use std::sync::Arc;
use tracing::level_filters::LevelFilter;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false).expect("to work");
    tracing::info!("Hello World");

    let config = Config::init();

    let db = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&db).await?;

    let hub_seed = seed_from_file(&config.seed_file)?;
    let wallet = Wallet::new(hub_seed, &config.fallback_xpub)?;
    let wallet = Arc::new(wallet);

    let (mempool_addr, mempool_mailbox) = xtra::Mailbox::unbounded();
    let mempool = mempool::Actor::new(config.mempool_url.clone(), db.clone());

    tokio::spawn(async {
        let e = xtra::run(mempool_mailbox, mempool).await;
        tracing::error!("Mempool actor stopped: {e:#}");

        // TODO: Supervise [`mempool::Actor`].
        panic!("Dying because we can't continue without mempool actor");
    });

    let borrower_server = spawn_borrower_server(
        config.clone(),
        wallet.clone(),
        db.clone(),
        mempool_addr.clone(),
    )
    .await?;

    let lender_server = spawn_lender_server(config, wallet, db, mempool_addr).await?;

    let _ = tokio::join!(borrower_server, lender_server);

    tracing::info!("Servers stopped");

    Ok(())
}

fn seed_from_file(path: &str) -> Result<Vec<u8>> {
    let path = std::path::Path::new(path);

    let seed = std::fs::read(path)?;

    Ok(seed)
}
