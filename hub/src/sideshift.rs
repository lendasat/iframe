use crate::config::Config;
use crate::db;
use crate::db::sideshift::SideshiftQuote;
use crate::model::LoanAssetChain;
use crate::model::LoanAssetType;
use anyhow::anyhow;
use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use bitcoin::address::NetworkUnchecked;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sideshift::BitcoinNetwork;
use sideshift::Coin;
use sideshift::EthereumNetwork;
use sideshift::Network;
use sideshift::ShiftStatus;
use sideshift::SideShiftClient;
use sideshift::SolanaNetwork;
use sqlx::Pool;
use sqlx::Postgres;
use std::str::FromStr;
use std::time::Duration;
use tokio::time::sleep;
use tokio::time::timeout;

/// Time between two poll requests
const POLL_INTERVAL: Duration = Duration::from_secs(1);
const POLL_TIMEOUT: Duration = Duration::from_secs(30);

pub struct Shifter {
    inner: SideShiftClient,
    db: Pool<Postgres>,
}

impl Shifter {
    pub fn new(db: Pool<Postgres>, config: Config) -> Self {
        Self {
            inner: SideShiftClient::new(
                config.sideshift_secret.clone(),
                config.sideshift_base_url.clone(),
                config.sideshift_affiliate_id.clone(),
                config.sideshift_commision_rate,
            ),
            db,
        }
    }

    /// Creates a shift with SideShift.ai
    ///
    /// Returns a tripple of
    /// - `bitcoin::Address` - where to send the money to
    /// - `bitcoin::Amount` - how much to send to
    /// - `String` - where the stable coin will be sent to
    /// - `Decimal` - the final stable coin amount
    #[allow(clippy::too_many_arguments)]
    pub async fn create_shift(
        &self,
        loan_asset_type: LoanAssetType,
        loan_asset_chain: LoanAssetChain,
        amount: Decimal,
        contract_id: String,
        user_ip: String,
        bitcoin_refund_address: String,
        settle_address: String,
    ) -> Result<(
        bitcoin::Address<NetworkUnchecked>,
        bitcoin::Amount,
        String,
        Decimal,
    )> {
        let quote = self
            .get_quote(
                loan_asset_type,
                loan_asset_chain,
                amount,
                contract_id.clone(),
                user_ip.clone(),
            )
            .await
            .context("Failed getting sideshift quote")?;

        tracing::debug!(
            quote_id = quote.id.to_string(),
            contract_id = contract_id,
            rate = quote.rate.to_string(),
            "Received quote from sideshift"
        );

        let fixed_shift = self
            .inner
            .create_fixed_shift(
                settle_address,
                None,
                quote.id,
                Some(bitcoin_refund_address),
                None,
                Some(contract_id.clone()),
                user_ip,
            )
            .await
            .context("Failed creating fixed shift")?;

        tracing::debug!(
            shift_id = fixed_shift.id,
            quote_id = fixed_shift.quote_id.to_string(),
            contract_id = contract_id,
            rate = quote.rate.to_string(),
            "Received fixed shift from sideshift"
        );

        let fixed_shift_status = self.inner.get_fixed_shift(fixed_shift.id).await?;

        db::sideshift::insert_shift(&self.db, &fixed_shift_status).await?;

        let deposit_address =
            bitcoin::Address::from_str(fixed_shift_status.deposit_address.as_str())?;
        let deposit_amount = bitcoin::Amount::from_btc(
            fixed_shift_status
                .deposit_amount
                .to_f64()
                .context("Could not parse deposit amount")?,
        )?;

        Ok((
            deposit_address,
            deposit_amount,
            fixed_shift_status.settle_address,
            fixed_shift_status.settle_amount,
        ))
    }

    async fn get_quote(
        &self,
        loan_asset_type: LoanAssetType,
        loan_asset_chain: LoanAssetChain,
        amount: Decimal,
        contract_id: String,
        lender_ip: String,
    ) -> Result<SideshiftQuote> {
        let coin = match loan_asset_type {
            LoanAssetType::Usdc => Coin::Usdc,
            LoanAssetType::Usdt => Coin::Usdt,
        };

        let chain = match loan_asset_chain {
            LoanAssetChain::Ethereum => Network::Ethereum(EthereumNetwork::Ethereum),
            LoanAssetChain::Polygon => Network::Ethereum(EthereumNetwork::Polygon),
            LoanAssetChain::Solana => Network::Solana(SolanaNetwork::Solana),
            LoanAssetChain::Starknet => {
                bail!("Not supported by SideShift.ai");
            }
        };
        let quote = self
            .inner
            .get_quote(
                Coin::Btc,
                coin,
                Network::Bitcoin(BitcoinNetwork::Bitcoin),
                chain,
                lender_ip,
                None,
                Some(amount),
            )
            .await
            .context("Failed calling get quote on sideshift client")?;

        tracing::debug!(quote_id = quote.id.to_string(), "Received new quote");

        // For tracking purposes
        let quote = SideshiftQuote::new(quote.clone(), contract_id);
        let _uuid = db::sideshift::insert_quote(&self.db, quote.clone()).await?;

        Ok(quote)
    }

    /// Polls sideshift for the status of a shift until a it reaches `ShiftStatus::Settled` or
    /// timeout occurs
    ///
    /// * `poll_interval` - Duration to wait between polls
    /// * `timeout_duration` - Maximum duration to poll before timing out
    pub async fn poll_until_message(&self, shift_id: String) -> Result<()> {
        let client = self.inner.clone();

        let polling_task = async move {
            loop {
                match client.get_fixed_shift(shift_id.clone()).await {
                    Ok(s) => {
                        tracing::info!(status = ?s.status, shift_id, "Shift status");
                        if s.status == ShiftStatus::Settled {
                            return Ok(());
                        }
                        sleep(POLL_INTERVAL).await;
                    }
                    Err(err) => {
                        tracing::error!("Failed fetching shift status {err:#}");
                    }
                }
            }
        };

        // Wrap the polling task with a timeout
        timeout(POLL_TIMEOUT, polling_task)
            .await
            .unwrap_or_else(|_| {
                Err(anyhow!(
                    "Polling for shift status timed out after {:?}",
                    POLL_TIMEOUT
                ))
            })
    }
}
