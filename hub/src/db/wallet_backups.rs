use bitcoin::bip32::Xpub;
use sqlx::Pool;
use sqlx::Postgres;
use sqlx::Result;
use time::OffsetDateTime;

#[derive(Debug, sqlx::FromRow)]
pub struct BorrowerWalletBackup {
    pub id: i32,
    pub borrower_id: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug)]
pub struct NewBorrowerWalletBackup {
    pub borrower_id: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
}

pub async fn find_by_borrower_id(
    pool: &Pool<Postgres>,
    borrower_id: &str,
) -> Result<BorrowerWalletBackup> {
    sqlx::query_as!(
        BorrowerWalletBackup,
        r#"
            SELECT
                id,
                borrower_id,
                mnemonic_ciphertext,
                network,
                xpub,
                created_at
            FROM borrower_wallet_backups
            WHERE borrower_id = $1
            ORDER BY created_at DESC
            "#,
        borrower_id
    )
    .fetch_one(pool)
    .await
}

pub async fn insert_borrower_backup<'a, E>(
    pool: E,
    backup: NewBorrowerWalletBackup,
) -> Result<BorrowerWalletBackup>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query_as!(
        BorrowerWalletBackup,
        r#"
        INSERT INTO borrower_wallet_backups (
            borrower_id,
            mnemonic_ciphertext,
            network,
            xpub
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, borrower_id, mnemonic_ciphertext, network, xpub, created_at
        "#,
        backup.borrower_id,
        backup.mnemonic_ciphertext,
        backup.network,
        backup.xpub,
    )
    .fetch_one(pool)
    .await
}

#[derive(Debug, sqlx::FromRow)]
pub struct LenderWalletBackup {
    pub id: i32,
    pub lender_id: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug)]
pub struct NewLenderWalletBackup {
    pub lender_id: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
}

pub async fn find_by_lender_id(
    pool: &Pool<Postgres>,
    lender_id: &str,
) -> Result<LenderWalletBackup> {
    sqlx::query_as!(
        LenderWalletBackup,
        r#"
            SELECT
                id,
                lender_id,
                mnemonic_ciphertext,
                network,
                xpub,
                created_at
            FROM lender_wallet_backups
            WHERE lender_id = $1
            ORDER BY created_at DESC
            "#,
        lender_id
    )
    .fetch_one(pool)
    .await
}

pub async fn insert_lender_backup<'a, E>(
    pool: E,
    backup: NewLenderWalletBackup,
) -> Result<LenderWalletBackup>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    sqlx::query_as!(
        LenderWalletBackup,
        r#"
        INSERT INTO lender_wallet_backups (
            lender_id,
            mnemonic_ciphertext,
            network,
            xpub
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, lender_id, mnemonic_ciphertext, network, xpub, created_at
        "#,
        backup.lender_id,
        backup.mnemonic_ciphertext,
        backup.network,
        backup.xpub,
    )
    .fetch_one(pool)
    .await
}

pub async fn get_xpub_for_lender<'a, E>(pool: E, lender_id: String) -> Result<Xpub>
where
    E: sqlx::Executor<'a, Database = Postgres>,
{
    let xpub = sqlx::query_scalar!(
        r#"
        SELECT xpub
        FROM lender_wallet_backups
        WHERE lender_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        "#,
        lender_id
    )
    .fetch_one(pool)
    .await?;

    let xpub = xpub.parse().expect("valid xpub");

    Ok(xpub)
}
