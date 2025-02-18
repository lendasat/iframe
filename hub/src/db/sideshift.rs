use anyhow::Result;
use rust_decimal::Decimal;
use sideshift::ShiftStatus;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(sqlx::Type, Debug, Clone)]
#[sqlx(type_name = "sideshift_asset_type")]
pub enum SideshiftAssetType {
    UsdtEth,
    UsdcEth,
    UsdtPol,
    UsdcPol,
    UsdtStrk,
    UsdcStrk,
    UsdtSol,
    UsdcSol,
    BtcMainnet,
}

impl From<(sideshift::Network, sideshift::Coin)> for SideshiftAssetType {
    fn from(value: (sideshift::Network, sideshift::Coin)) -> Self {
        match value {
            (
                sideshift::Network::Ethereum(sideshift::EthereumNetwork::Ethereum),
                sideshift::Coin::Usdt,
            ) => Self::UsdtEth,
            (
                sideshift::Network::Ethereum(sideshift::EthereumNetwork::Ethereum),
                sideshift::Coin::Usdc,
            ) => Self::UsdcEth,
            (
                sideshift::Network::Ethereum(sideshift::EthereumNetwork::Polygon),
                sideshift::Coin::Usdt,
            ) => Self::UsdtEth,
            (
                sideshift::Network::Ethereum(sideshift::EthereumNetwork::Polygon),
                sideshift::Coin::Usdc,
            ) => Self::UsdcEth,
            (sideshift::Network::Bitcoin(_), sideshift::Coin::Btc) => Self::BtcMainnet,
            (
                sideshift::Network::Solana(sideshift::SolanaNetwork::Solana),
                sideshift::Coin::Usdt,
            ) => Self::UsdtSol,
            (
                sideshift::Network::Solana(sideshift::SolanaNetwork::Solana),
                sideshift::Coin::Usdc,
            ) => Self::UsdcSol,
            (a, b) => {
                panic!("This combination is not supported {a}/{b}")
            }
        }
    }
}

// Quote struct that matches your table
#[derive(sqlx::FromRow, Clone, Debug)]
pub struct SideshiftQuote {
    pub id: Uuid,
    pub contract_id: String,
    pub created_at: OffsetDateTime,
    pub deposit_asset: SideshiftAssetType,
    pub settle_asset: SideshiftAssetType,
    pub expires_at: OffsetDateTime,
    pub deposit_amount: Decimal,
    pub settle_amount: Decimal,
    pub rate: Decimal,
    pub affiliate_id: String,
}

impl SideshiftQuote {
    pub fn new(quote: sideshift::Quote, contract_id: String) -> Self {
        let deposit_asset = (quote.deposit_network, quote.deposit_coin).into();
        let settle_asset = (quote.settle_network, quote.settle_coin).into();
        Self {
            id: quote.id,
            contract_id,
            created_at: quote.created_at,
            deposit_asset,
            settle_asset,
            expires_at: quote.expires_at,
            deposit_amount: quote.deposit_amount,
            settle_amount: quote.settle_amount,
            rate: quote.rate,
            affiliate_id: quote.affiliate_id,
        }
    }
}

pub async fn insert_quote(pool: &Pool<Postgres>, quote: SideshiftQuote) -> Result<Uuid> {
    let id = sqlx::query!(
        r#"
        INSERT INTO sideshift_quotes (
            id, 
            contract_id, 
            created_at,
            deposit_asset,
            settle_asset,
            expires_at, 
            deposit_amount, 
            settle_amount, 
            rate, 
            affiliate_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        "#,
        quote.id,
        quote.contract_id,
        quote.created_at,
        quote.deposit_asset as SideshiftAssetType,
        quote.settle_asset as SideshiftAssetType,
        quote.expires_at,
        quote.deposit_amount,
        quote.settle_amount,
        quote.rate,
        quote.affiliate_id
    )
    .fetch_one(pool)
    .await?;

    Ok(id.id)
}

// First, create the enums to match the database
#[derive(sqlx::Type)]
#[sqlx(type_name = "sideshift_shift_kind", rename_all = "lowercase")]
pub enum SideshiftShiftKind {
    Fixed,
    Variable,
}

#[derive(sqlx::Type)]
#[sqlx(type_name = "sideshift_shift_status", rename_all = "lowercase")]
pub enum SideshiftShiftStatus {
    Waiting,
    Pending,
    Processing,
    Review,
    Settling,
    Settled,
    Refund,
    Refunding,
    Refunded,
    Expired,
    Multiple,
}

// Insert query
pub async fn insert_shift(
    pool: &Pool<Postgres>,
    shift: &sideshift::FixedShiftStatus,
) -> Result<(), sqlx::Error> {
    let deposit_asset =
        SideshiftAssetType::from((shift.deposit_network.clone(), shift.deposit_coin.clone()));
    let settle_asset =
        SideshiftAssetType::from((shift.settle_network.clone(), shift.settle_coin.clone()));

    let status = match shift.status {
        ShiftStatus::Waiting => SideshiftShiftStatus::Waiting,
        ShiftStatus::Pending => SideshiftShiftStatus::Pending,
        ShiftStatus::Processing => SideshiftShiftStatus::Processing,
        ShiftStatus::Review => SideshiftShiftStatus::Review,
        ShiftStatus::Settling => SideshiftShiftStatus::Settling,
        ShiftStatus::Settled => SideshiftShiftStatus::Settled,
        ShiftStatus::Refund => SideshiftShiftStatus::Refund,
        ShiftStatus::Refunding => SideshiftShiftStatus::Refunding,
        ShiftStatus::Refunded => SideshiftShiftStatus::Refunded,
        ShiftStatus::Expired => SideshiftShiftStatus::Expired,
        ShiftStatus::Multiple => SideshiftShiftStatus::Multiple,
    };
    let kind = match shift.kind {
        sideshift::ShiftKind::Fixed => SideshiftShiftKind::Fixed,
        sideshift::ShiftKind::Variable => SideshiftShiftKind::Variable,
    };

    sqlx::query!(
        r#"
        INSERT INTO sideshift_shifts (
            id,
            quote_id,
            kind,
            deposit_amount,
            settle_amount,
            deposit_asset,
            settle_asset,
            deposit_address,
            settle_address,
            external_id,
            rate,
            status,
            average_shift_seconds,
            deposit_hash,
            settle_hash,
            deposit_received_at,
            settle_coin_network_fee,
            issue,
            expires_at,
            created_at
        )
        VALUES ($1, 
                $2, 
                $3, 
                $4, 
                $5, 
                $6, 
                $7, 
                $8, 
                $9, 
                $10, 
                $11, 
                $12, 
                $13, 
                $14, 
                $15, 
                $16, 
                $17, 
                $18, 
                $19, 
                $20
            )
        RETURNING id
        "#,
        shift.id,
        shift.quote_id,
        kind as SideshiftShiftKind,
        shift.deposit_amount,
        shift.settle_amount,
        deposit_asset as SideshiftAssetType,
        settle_asset as SideshiftAssetType,
        shift.deposit_address,
        shift.settle_address,
        shift.external_id,
        shift.rate,
        status as SideshiftShiftStatus,
        shift.average_shift_seconds,
        shift.deposit_hash,
        shift.settle_hash,
        shift.deposit_received_at,
        shift.settle_coin_network_fee,
        shift.issue,
        shift.expires_at,
        shift.created_at
    )
    .fetch_one(pool)
    .await?;

    Ok(())
}
