use anyhow::Context;
use anyhow::Result;
use axum::extract::ws::Message;
use descriptor_wallet::DescriptorWallet;
use hub::bitmex_index_pricefeed::subscribe_index_price;
use hub::config::Config;
use hub::db::connect_to_db;
use hub::db::run_migration;
use hub::liquidation_engine::monitor_positions;
use hub::logger::init_tracing;
use hub::mempool;
use hub::routes::borrower::spawn_borrower_server;
use hub::routes::lender::spawn_lender_server;
use hub::wallet::Wallet;
use std::sync::Arc;
use temp_dir::TempDir;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tracing::level_filters::LevelFilter;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing(LevelFilter::DEBUG, false).expect("to work");
    tracing::info!("Hello World");

    let config = Config::init();

    let db = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&db).await?;

    let network = config.network.clone().parse().context("Invalid network")?;
    tracing::info!("Running hub on {network}");

    let hub_seed = seed_from_file(&config.seed_file).context("Could not load seed from file")?;

    let (db_path, _temp_db_dir) = match config.hub_fee_wallet_dir.as_ref() {
        None => {
            let temp_dir = TempDir::new().expect("to exist");
            let path = temp_dir.path();
            let path_str = path.to_str().map(|s| s.to_string()).expect("to work");
            let db_path = format!("{}/one-time.db", path_str);
            tracing::warn!(db_path, "Fee wallet is using non-persistent storage");
            (db_path, Some(temp_dir))
        }
        Some(path) => (path.clone(), None),
    };

    let descriptor_wallet = DescriptorWallet::new(
        config.hub_fee_descriptor.as_str(),
        db_path.as_str(),
        config.network.clone().as_str(),
    )?;

    let wallet = Wallet::new(hub_seed, &config.fallback_xpub, network, descriptor_wallet)?;
    let wallet = Arc::new(Mutex::new(wallet));

    let (mempool_addr, mempool_mailbox) = xtra::Mailbox::unbounded();
    let mempool = mempool::Actor::new(db.clone(), network, config.clone());

    tokio::spawn(async {
        let e = xtra::run(mempool_mailbox, mempool).await;
        tracing::error!("Mempool actor stopped: {e:#}");

        // TODO: Supervise [`mempool::Actor`].
        panic!("Dying because we can't continue without mempool actor");
    });

    // Create a channel with a buffer size of 100
    let (bitmex_tx, mut bitmex_rx) = mpsc::channel(100);
    let (liquidation_tx, liquidation_rx) = mpsc::channel(100);

    // Start the subscription in a separate task
    tokio::spawn(subscribe_index_price([bitmex_tx, liquidation_tx]));
    monitor_positions(db.clone(), liquidation_rx, config.clone()).await?;

    // Spawn a task to handle BitMEX events and broadcast to WebSocket clients
    let broadcast_state = Arc::new(Mutex::new(Vec::new()));
    tokio::spawn({
        let broadcast_state = broadcast_state.clone();
        async move {
            while let Some(event) = bitmex_rx.recv().await {
                match serde_json::to_string(&event) {
                    Ok(message) => {
                        hub::routes::price_feed_ws::broadcast_message(
                            broadcast_state.clone(),
                            Message::Text(message),
                        )
                        .await
                    }
                    Err(error) => {
                        tracing::error!("Could not serialize event {error:#}");
                    }
                }
            }
        }
    });

    let borrower_server = spawn_borrower_server(
        config.clone(),
        wallet.clone(),
        db.clone(),
        mempool_addr.clone(),
        broadcast_state.clone(),
    )
    .await?;

    let lender_server =
        spawn_lender_server(config, wallet, db, mempool_addr, broadcast_state).await?;

    let _ = tokio::join!(borrower_server, lender_server);

    tracing::info!("Servers stopped");

    Ok(())
}

fn seed_from_file(path: &str) -> Result<Vec<u8>> {
    let path = std::path::Path::new(path);

    let seed = std::fs::read(path)?;

    Ok(seed)
}
