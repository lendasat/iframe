use sqlx::Pool;
use sqlx::Postgres;
use sqlx::Result;
use time::OffsetDateTime;

#[derive(Debug, sqlx::FromRow)]
pub struct BorrowerWalletBackup {
    pub id: i32,
    pub borrower_id: String,
    pub passphrase_hash: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug)]
pub struct NewBorrowerWalletBackup {
    pub borrower_id: String,
    pub passphrase_hash: String,
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
                passphrase_hash, 
                mnemonic_ciphertext, 
                network, 
                xpub, 
                created_at
            FROM borrower_wallet_backups
            WHERE borrower_id = $1
            "#,
        borrower_id
    )
    .fetch_one(pool)
    .await
}

pub async fn insert_borrower_backup(
    pool: &Pool<Postgres>,
    new_wallet: NewBorrowerWalletBackup,
) -> Result<BorrowerWalletBackup> {
    sqlx::query_as!(
        BorrowerWalletBackup,
        r#"
        INSERT INTO borrower_wallet_backups (
            borrower_id, 
            passphrase_hash, 
            mnemonic_ciphertext, 
            network, 
            xpub
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, borrower_id, passphrase_hash, mnemonic_ciphertext, network, xpub, created_at
        "#,
        new_wallet.borrower_id,
        new_wallet.passphrase_hash,
        new_wallet.mnemonic_ciphertext,
        new_wallet.network,
        new_wallet.xpub,
    )
    .fetch_one(pool)
    .await
}

#[derive(Debug, sqlx::FromRow)]
pub struct LenderWalletBackup {
    pub id: i32,
    pub lender_id: String,
    pub passphrase_hash: String,
    pub mnemonic_ciphertext: String,
    pub network: String,
    pub xpub: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug)]
pub struct NewLenderWalletBackup {
    pub lender_id: String,
    pub passphrase_hash: String,
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
                passphrase_hash, 
                mnemonic_ciphertext, 
                network, 
                xpub, 
                created_at
            FROM lender_wallet_backups
            WHERE lender_id = $1
            "#,
        lender_id
    )
    .fetch_one(pool)
    .await
}

pub async fn insert_lender_backup(
    pool: &Pool<Postgres>,
    new_wallet: NewLenderWalletBackup,
) -> Result<LenderWalletBackup> {
    sqlx::query_as!(
        LenderWalletBackup,
        r#"
        INSERT INTO lender_wallet_backups (
            lender_id, 
            passphrase_hash, 
            mnemonic_ciphertext, 
            network, 
            xpub
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, lender_id, passphrase_hash, mnemonic_ciphertext, network, xpub, created_at
        "#,
        new_wallet.lender_id,
        new_wallet.passphrase_hash,
        new_wallet.mnemonic_ciphertext,
        new_wallet.network,
        new_wallet.xpub,
    )
    .fetch_one(pool)
    .await
}
