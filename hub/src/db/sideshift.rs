use anyhow::Result;
use rust_decimal::Decimal;
use sideshift::ShiftKind;
use sideshift::ShiftStatus;
use sqlx::Pool;
use sqlx::Postgres;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(sqlx::Type, Debug, Clone)]
#[sqlx(type_name = "sideshift_coin")]
pub enum SideshiftCoin {
    #[sqlx(rename = "usdc")]
    Usdc,
    #[sqlx(rename = "usdt")]
    Usdt,
    #[sqlx(rename = "btc")]
    Btc,
}

#[derive(sqlx::Type, Debug, Clone)]
#[sqlx(type_name = "sideshift_bitcoin_network")]
pub enum SideshiftBitcoinNetwork {
    #[sqlx(rename = "bitcoin")]
    Bitcoin,
}

#[derive(sqlx::Type, Debug, Clone)]
#[sqlx(type_name = "sideshift_ethereum_network")]
pub enum SideshiftEthereumNetwork {
    #[sqlx(rename = "mainnet")]
    Mainnet,
    #[sqlx(rename = "arbitrum")]
    Arbitrum,
    #[sqlx(rename = "polygon")]
    Polygon,
}

// Composite type for network
#[derive(sqlx::Type, Debug, Clone)]
#[sqlx(type_name = "sideshift_network")]
pub struct SideshiftNetwork {
    pub network_type: String,
    pub ethereum_network: Option<SideshiftEthereumNetwork>,
    pub bitcoin_network: Option<SideshiftBitcoinNetwork>,
}

// Quote struct that matches your table
#[derive(sqlx::FromRow, Clone, Debug)]
pub struct SideshiftQuote {
    pub id: Uuid,
    pub contract_id: String,
    pub created_at: OffsetDateTime,
    pub deposit_coin: SideshiftCoin,
    pub deposit_network: SideshiftNetwork,
    pub settle_coin: SideshiftCoin,
    pub settle_network: SideshiftNetwork,
    pub expires_at: OffsetDateTime,
    pub deposit_amount: Decimal,
    pub settle_amount: Decimal,
    pub rate: Decimal,
    pub affiliate_id: String,
}

impl SideshiftQuote {
    pub fn new(quote: sideshift::Quote, contract_id: String) -> Self {
        Self {
            id: quote.id,
            contract_id,
            created_at: quote.created_at,
            deposit_coin: quote.deposit_coin.into(),
            deposit_network: quote.deposit_network.into(),
            settle_coin: quote.settle_coin.into(),
            settle_network: quote.settle_network.into(),
            expires_at: quote.expires_at,
            deposit_amount: quote.deposit_amount,
            settle_amount: quote.settle_amount,
            rate: quote.rate,
            affiliate_id: quote.affiliate_id,
        }
    }
}

impl From<sideshift::Coin> for SideshiftCoin {
    fn from(value: sideshift::Coin) -> Self {
        match value {
            sideshift::Coin::Usdc => SideshiftCoin::Usdc,
            sideshift::Coin::Usdt => SideshiftCoin::Usdt,
            sideshift::Coin::Btc => SideshiftCoin::Btc,
        }
    }
}

impl From<sideshift::Network> for SideshiftNetwork {
    fn from(value: sideshift::Network) -> Self {
        match value {
            sideshift::Network::Ethereum(sideshift::EthereumNetwork::Aribtrum) => {
                SideshiftNetwork {
                    network_type: "ethereum".to_string(),
                    ethereum_network: Some(SideshiftEthereumNetwork::Arbitrum),
                    bitcoin_network: None,
                }
            }
            sideshift::Network::Ethereum(sideshift::EthereumNetwork::Ethereum) => {
                SideshiftNetwork {
                    network_type: "ethereum".to_string(),
                    ethereum_network: Some(SideshiftEthereumNetwork::Mainnet),
                    bitcoin_network: None,
                }
            }
            sideshift::Network::Ethereum(sideshift::EthereumNetwork::Polygon) => SideshiftNetwork {
                network_type: "ethereum".to_string(),
                ethereum_network: Some(SideshiftEthereumNetwork::Polygon),
                bitcoin_network: None,
            },
            sideshift::Network::Bitcoin(sideshift::BitcoinNetwork::Bitcoin) => SideshiftNetwork {
                network_type: "bitcoin".to_string(),
                ethereum_network: None,
                bitcoin_network: Some(SideshiftBitcoinNetwork::Bitcoin),
            },
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
            deposit_coin, 
            deposit_network, 
            settle_coin, 
            settle_network, 
            expires_at, 
            deposit_amount, 
            settle_amount, 
            rate, 
            affiliate_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
        "#,
        quote.id,
        quote.contract_id,
        quote.created_at,
        quote.deposit_coin as SideshiftCoin,
        quote.deposit_network as SideshiftNetwork,
        quote.settle_coin as SideshiftCoin,
        quote.settle_network as SideshiftNetwork,
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
    let deposit_coin = SideshiftCoin::from(shift.deposit_coin.clone());
    let deposit_network = SideshiftNetwork::from(shift.deposit_network.clone());
    let settle_coin = SideshiftCoin::from(shift.settle_coin.clone());
    let settle_network = SideshiftNetwork::from(shift.settle_network.clone());

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
        ShiftKind::Fixed => SideshiftShiftKind::Fixed,
        ShiftKind::Variable => SideshiftShiftKind::Variable,
    };

    sqlx::query!(
        r#"
        INSERT INTO sideshift_shifts (
            id,
            quote_id,
            kind,
            deposit_amount,
            settle_amount,
            deposit_coin,
            deposit_network,
            settle_coin,
            settle_network,
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
                $20, 
                $21, 
                $22
            )
        RETURNING id
        "#,
        shift.id,
        shift.quote_id,
        kind as SideshiftShiftKind,
        shift.deposit_amount,
        shift.settle_amount,
        deposit_coin as SideshiftCoin,
        deposit_network as SideshiftNetwork,
        settle_coin as SideshiftCoin,
        settle_network as SideshiftNetwork,
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
