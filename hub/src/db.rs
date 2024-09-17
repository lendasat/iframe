pub mod borrowers;
pub mod contracts;
pub mod invite_code;
pub mod lenders;
pub mod loan_offers;

use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::Pool;
use sqlx::Postgres;

pub async fn connect_to_db(db_connection: &str) -> Result<Pool<Postgres>> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(db_connection)
        .await?;
    Ok(pool)
}

pub async fn run_migration(pool: &Pool<Postgres>) -> Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}
