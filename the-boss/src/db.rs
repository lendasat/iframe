pub(crate) mod user;

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

#[derive(Debug)]
struct InitialTableValues {
    id: i32,
    value: String,
}

pub async fn sample_query(pool: &Pool<Postgres>) -> Result<()> {
    let init_table_values: Vec<InitialTableValues> = sqlx::query_as!(
        InitialTableValues,
        "
        SELECT id, value
        FROM init_table
        "
    )
    .fetch_all(pool)
    .await?;

    for table_value in init_table_values {
        let id = &table_value.id;
        let value = &table_value.value;
        tracing::debug!(id, value, "init_table_values");
    }

    Ok(())
}
