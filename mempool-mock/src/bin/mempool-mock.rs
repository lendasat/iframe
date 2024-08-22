use axum::routing::get;
use axum::routing::post;
use axum::Router;
use mempool_mock::get_address_transactions;
use mempool_mock::mine_blocks;
use mempool_mock::post_tx;
use mempool_mock::Blockchain;
use std::sync::Arc;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    let blockchain = Arc::new(Mutex::new(Blockchain {
        height: 0,
        txs: Vec::new(),
    }));

    let app = Router::new()
        .route("/tx", post(post_tx))
        .route("/mine/:blocks", post(mine_blocks))
        .route("/api/address/:address/txs", get(get_address_transactions))
        .with_state(blockchain);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:7339").await.unwrap();

    axum::serve(listener, app).await.unwrap();

    println!("mempool mock server stopped");
}
