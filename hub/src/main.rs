use crate::config::Config;
use crate::db::connect_to_db;
use crate::db::run_migration;
use crate::logger::init_tracing;
use crate::routes::borrower::spawn_borrower_server;
use crate::routes::lender::spawn_lender_server;
use anyhow::Result;
use tracing::level_filters::LevelFilter;

mod config;
mod db;
mod email;
mod logger;
mod model;
mod routes;

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
