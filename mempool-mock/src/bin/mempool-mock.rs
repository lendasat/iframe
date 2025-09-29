use axum::routing::get;
use axum::routing::post;
use axum::Router;
use mempool_mock::get_address_txes;
use mempool_mock::get_block_tip_height;
use mempool_mock::logger::init_tracing;
use mempool_mock::mine_blocks;
use mempool_mock::post_tx;
use mempool_mock::send_to_address;
use mempool_mock::Blockchain;
use std::sync::Arc;
use std::sync::RwLock;
use tracing::level_filters::LevelFilter;

#[tokio::main]
async fn main() {
    init_tracing(LevelFilter::DEBUG).expect("to work");

    tracing::info!("Starting mempool mock server");

    let blockchain = Arc::new(RwLock::new(Blockchain {
        height: 0,
        txs: Vec::new(),
        tracked_addresses: Vec::new(),
    }));

    let app = Router::new()
        .route("/sendtoaddress", post(send_to_address))
        .route("/mine/:blocks", post(mine_blocks))
        .route("/api/address/:address/txs", get(get_address_txes))
        .route("/api/blocks/tip/height", get(get_block_tip_height))
        .route("/api/tx", post(post_tx))
        .with_state(blockchain);

    let listen_address = "0.0.0.0:7339";
    let listener = tokio::net::TcpListener::bind(listen_address)
        .await
        .expect("to be able to bind");

    tracing::info!("Starting to listen on {listen_address}");

    axum::serve(listener, app)
        .await
        .expect("to be able to serve");

    tracing::info!("Mempool mock server stopped");
}
