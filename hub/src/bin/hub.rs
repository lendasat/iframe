use anyhow::Context;
use anyhow::Result;
use axum::extract::ws::Message;
use bitcoin::Network;
use descriptor_wallet::DescriptorWallet;
use hub::bitmex_index_pricefeed::subscribe_index_price;
use hub::config::Config;
use hub::contract_approval_expired::add_contract_approval_expiry_job;
use hub::contract_request_expiry::add_contract_request_expiry_job;
use hub::daily_digest::add_daily_digest_job;
use hub::db::connect_to_db;
use hub::db::run_migration;
use hub::installment_close_to_due_date::add_installment_close_to_due_date_job;
use hub::late_installments::add_late_installment_job;
use hub::liquidation_engine::monitor_positions;
use hub::process_defaulted_contracts::add_process_defaulted_contracts_job;
use hub::loan_application_expiry::add_loan_application_expiry_job;
use hub::logger::init_tracing;
use hub::mempool;
use hub::moon;
use hub::notifications::websocket::NotificationCenter;
use hub::notifications::Notifications;
use hub::routes::borrower::spawn_borrower_server;
use hub::routes::lender::spawn_lender_server;
use hub::routes::AppState;
use hub::telegram_bot::TelegramBot;
use hub::wallet::Wallet;
use std::backtrace::Backtrace;
use std::collections::HashMap;
use std::sync::Arc;
use temp_dir::TempDir;
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tokio_cron_scheduler::JobScheduler;
use tracing::level_filters::LevelFilter;

#[tokio::main]
async fn main() -> Result<()> {
    std::panic::set_hook(
        #[allow(clippy::print_stderr)]
        Box::new(|info| {
            let backtrace = Backtrace::force_capture();

            tracing::error!(%info, "Aborting after panic in task");
            eprintln!("{backtrace}");

            std::process::abort()
        }),
    );

    init_tracing(LevelFilter::DEBUG, false).expect("to work");
    tracing::info!("Hello World");

    let config = Config::init();

    let db = connect_to_db(config.database_url.as_str()).await?;
    run_migration(&db).await?;

    if config.custom_db_migration {
        tracing::info!("Custom DB migration started");

        hub::db::migrate_pks::migrate_pks(&db).await?;

        tracing::info!(
            "Custom DB migration done. \
             You can unset the CUSTOM_DB_MIGRATION env variable now"
        );

        return Ok(());
    }

    let network = config.network.clone().parse().context("Invalid network")?;
    tracing::info!("Running hub on {network}");

    let hub_seed = seed_from_file(&config.seed_file).context("Could not load seed from file")?;

    let (db_path, _temp_db_dir) = match config.hub_fee_wallet_dir.as_ref() {
        None => {
            let temp_dir = TempDir::new().expect("to exist");
            let path = temp_dir.path();
            let path_str = path.to_str().map(|s| s.to_string()).expect("to work");
            let db_path = format!("{path_str}/one-time.db");
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

    let wallet = Wallet::new(
        hub_seed,
        &config.fallback_xpub,
        network,
        descriptor_wallet,
        db.clone(),
    )?;
    let wallet = Arc::new(wallet);

    let (telegram_bot_addr, telegram_bot_mailbox) = xtra::Mailbox::unbounded();

    let maybe_telegram_bot = config
        .telegram_bot_token
        .clone()
        .map(|token| TelegramBot::new(token.as_str(), db.clone()));

    let maybe_telegram_bot_addr = if let Some(telegram_bot) = maybe_telegram_bot {
        tokio::spawn(async {
            let e = xtra::run(telegram_bot_mailbox, telegram_bot).await;
            tracing::error!("TelegramBot actor stopped: {e:#}");

            // TODO: Supervise [`telegram_bot::TelegramBot`].
            panic!("Dying because we can't continue without telegram bot actor");
        });
        Some(telegram_bot_addr)
    } else {
        None
    };

    let notifications = Arc::new(Notifications::new(
        config.clone(),
        maybe_telegram_bot_addr,
        NotificationCenter::default(),
        db.clone(),
    ));

    let (mempool_addr, mempool_mailbox) = xtra::Mailbox::unbounded();
    let mempool = mempool::Actor::new(db.clone(), network, config.clone(), notifications.clone());

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
    monitor_positions(
        db.clone(),
        liquidation_rx,
        config.clone(),
        notifications.clone(),
    )
    .await?;

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

    let moon_client = Arc::new(moon::Manager::new(
        db.clone(),
        config.clone(),
        notifications.clone(),
    ));
    if config.sync_moon_tx {
        tokio::spawn({
            let moon_client = moon_client.clone();
            async move {
                match moon_client.sync_transaction_history().await {
                    Ok(_) => {
                        tracing::info!("Successfully synced card history");
                    }
                    Err(err) => {
                        tracing::error!("Failed syncing card history {err:#}");
                    }
                }
            }
        });
    } else {
        tracing::debug!("Sync moon tx is disabled");
    }

    let sideshift = Arc::new(hub::sideshift::Shifter::new(db.clone(), config.clone()));

    let app_state = Arc::new(AppState {
        db: db.clone(),
        pake_protocols: Arc::new(Mutex::new(HashMap::default())),
        wallet: wallet.clone(),
        config: config.clone(),
        mempool: mempool_addr,
        price_feed_ws_connections: broadcast_state.clone(),
        moon: moon_client.clone(),
        sideshift,
        notifications: notifications.clone(),
    });

    let borrower_server = spawn_borrower_server(config.clone(), app_state.clone()).await?;

    let lender_server = spawn_lender_server(config.clone(), app_state).await?;

    let borrower_handle = tokio::spawn(borrower_server);
    let lender_handle = tokio::spawn(lender_server);

    // We need the borrower server to be started already for this.
    tokio::spawn(register_webhook_in_thread(moon_client, network));

    let sched = JobScheduler::new().await?;

    add_contract_request_expiry_job(&sched, db.clone(), config.clone(), notifications.clone())
        .await?;
    add_loan_application_expiry_job(&sched, db.clone(), config.clone(), notifications.clone())
        .await?;
    add_late_installment_job(&sched, db.clone()).await?;
    add_process_defaulted_contracts_job(&sched, config.clone(), db.clone(), notifications.clone())
        .await?;
    add_installment_close_to_due_date_job(
        &sched,
        config.clone(),
        db.clone(),
        notifications.clone(),
    )
    .await?;
    add_contract_approval_expiry_job(&sched, db).await?;
    add_daily_digest_job(
        &sched,
        notifications,
        config.borrower_frontend_origin,
        config.lender_frontend_origin,
    )
    .await?;

    sched.start().await?;

    let _ = tokio::join!(borrower_handle, lender_handle);

    tracing::info!("Hub has stopped");

    Ok(())
}

async fn register_webhook_in_thread(
    moon_client: Arc<moon::Manager>,
    network: Network,
) -> Result<()> {
    // We wait for 5 seconds to
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;

    // Call the register_webhook function
    let res = moon_client.register_webhook().await;

    if let Err(e) = res {
        match network {
            // In production, we must ensure that the Moon webhook is registered.
            Network::Bitcoin => panic!("Failed to register Moon webhook: {e}"),
            // When testing, depending on the environment it may be complicated to register the Moon
            // webhook.
            _ => {
                tracing::warn!("Failed to register Moon webhook: {e}");
            }
        }
    }

    Ok(())
}

fn seed_from_file(path: &str) -> Result<Vec<u8>> {
    let path = std::path::Path::new(path);

    let seed = std::fs::read(path)?;

    Ok(seed)
}
