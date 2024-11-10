use crate::model::User;
use crate::moon;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::Result;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::Extension;
use axum::Json;
use axum::Router;
use rust_decimal::Decimal;
use serde::Serialize;
use std::str::FromStr;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/cards",
            get(get_cards).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/transaction/:card_id",
            get(get_card_transaction).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .with_state(app_state)
}

#[instrument(skip(data, user), err(Debug))]
pub async fn get_cards(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let cards = data.moon.get_cards(user.id).await.map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let cards = cards.into_iter().map(Card::from).collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(cards)))
}

#[derive(Debug, Serialize, PartialEq)]
pub enum TransactionStatus {
    Authorization,
    Reversal,
    Clearing,
    Refund,
    Pending,
    #[serde(untagged)]
    Unknown(String),
}

impl From<pay_with_moon::TransactionStatus> for TransactionStatus {
    fn from(value: pay_with_moon::TransactionStatus) -> Self {
        match value {
            pay_with_moon::TransactionStatus::Authorization => TransactionStatus::Authorization,
            pay_with_moon::TransactionStatus::Reversal => TransactionStatus::Reversal,
            pay_with_moon::TransactionStatus::Clearing => TransactionStatus::Clearing,
            pay_with_moon::TransactionStatus::Refund => TransactionStatus::Refund,
            pay_with_moon::TransactionStatus::Pending => TransactionStatus::Pending,
            pay_with_moon::TransactionStatus::Unknown(u) => TransactionStatus::Unknown(u),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fee {
    #[serde(rename = "type")]
    pub fee_type: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    pub fee_description: String,
}

impl From<pay_with_moon::Fee> for Fee {
    fn from(value: pay_with_moon::Fee) -> Self {
        Fee {
            fee_type: value.fee_type,
            amount: value.amount,
            fee_description: value.fee_description,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TransactionCard {
    pub public_id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub card_type: String,
}

impl From<pay_with_moon::TransactionCard> for TransactionCard {
    fn from(value: pay_with_moon::TransactionCard) -> Self {
        TransactionCard {
            public_id: value.public_id,
            name: value.name,
            card_type: value.card_type,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct Transaction {
    pub card: TransactionCard,
    pub transaction_id: Uuid,
    pub transaction_status: TransactionStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub date: OffsetDateTime,
    pub merchant: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    pub ledger_currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_fees_in_ledger_currency: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_in_transaction_currency: Decimal,
    pub transaction_currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_fees_in_transaction_currency: Decimal,
    pub fees: Vec<Fee>,
}

impl From<pay_with_moon::Transaction> for Transaction {
    fn from(value: pay_with_moon::Transaction) -> Self {
        Transaction {
            card: value.data.card.into(),
            transaction_id: value.data.transaction_id,
            transaction_status: value.data.transaction_status.into(),
            date: value.data.datetime,
            merchant: value.data.merchant,
            amount: value.data.amount,
            ledger_currency: value.data.ledger_currency,
            amount_fees_in_ledger_currency: value.data.amount_fees_in_ledger_currency,
            amount_in_transaction_currency: value.data.amount_in_transaction_currency,
            transaction_currency: value.data.transaction_currency,
            amount_fees_in_transaction_currency: value.data.amount_fees_in_transaction_currency,
            fees: value.data.fees.into_iter().map(|fee| fee.into()).collect(),
        }
    }
}

pub async fn get_card_transaction(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Path(card_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let uuid = Uuid::from_str(card_id.as_str()).map_err(|_| {
        let error_response = ErrorResponse {
            message: "Invalid card id provided".to_string(),
        };
        (StatusCode::BAD_REQUEST, Json(error_response))
    })?;
    let cards = data.moon.get_cards(user.id).await.map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;
    if !cards.iter().any(|card| card.id == uuid) {
        // The card might exist in general but we are not aware of it and hence cannot be sure
        // that it belongs to this user
        let error_response = ErrorResponse {
            message: "Card not found".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let txs = data.moon.get_transactions(uuid).await.map_err(|error| {
        tracing::error!("Failed fetching card transactions: {:#}", error);

        let error_response = ErrorResponse {
            message: "Failed fetching card transactions".to_string(),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let txs = txs.into_iter().map(Transaction::from).collect::<Vec<_>>();
    Ok((StatusCode::OK, Json(txs)))
}

#[derive(Debug, Serialize)]
pub struct Card {
    pub id: Uuid,
    #[serde(with = "rust_decimal::serde::float")]
    pub balance: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub available_balance: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    pub expiration: OffsetDateTime,
    pub pan: String,
    pub cvv: String,
}

impl From<moon::Card> for Card {
    fn from(value: moon::Card) -> Self {
        Self {
            id: value.id,
            balance: value.balance,
            available_balance: value.available_balance,
            expiration: value.expiration,
            pan: value.pan,
            cvv: value.cvv,
        }
    }
}
