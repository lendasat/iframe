use crate::model::User;
use crate::moon;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::Result;
use axum::extract::rejection::JsonRejection;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use pay_with_moon::InvoicePaymentType;
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::Value;
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
        .route("/api/moon/webhook", post(post_webhook).get(get_webhook))
        .with_state(app_state)
}

#[instrument(skip(data, user), err(Debug))]
pub async fn get_cards(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let cards = data
        .moon
        .get_cards_from_db(user.id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let mut refreshed_cards = vec![];
    for card in cards.iter() {
        match data.moon.fetch_card_details_from_moon(card).await {
            Ok(card) => {
                refreshed_cards.push(card);
            }
            Err(error) => {
                tracing::error!(
                    card_id = card.id.to_string(),
                    "Failed fetching card update {error:#}"
                )
            }
        }
    }

    let cards = refreshed_cards
        .into_iter()
        .map(Card::from)
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(cards)))
}

#[derive(Debug, Serialize, PartialEq)]
pub enum TransactionStatus {
    Authorization,
    Reversal,
    Clearing,
    Refund,
    Pending,
    Settled,
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
            pay_with_moon::TransactionStatus::Settled => TransactionStatus::Settled,
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
    // TODO: this should be OffsetDateTime
    pub date: String,
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
    let cards = data
        .moon
        .get_cards_from_db(user.id)
        .await
        .map_err(|error| {
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

#[derive(Serialize)]
pub struct ApiResponse {
    status: String,
    message: Option<String>,
}

#[instrument(skip(data, payload), err(Debug))]
pub async fn post_webhook(
    State(data): State<Arc<AppState>>,
    payload: Result<Json<Value>, JsonRejection>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    match payload {
        // Handle request with JSON body
        Ok(Json(payload)) => {
            if let Ok(json_object) = serde_json::to_string(&payload) {
                tracing::debug!(?json_object, "Received new json webhook data");
            } else {
                tracing::debug!(?payload, "Received new webhook data");
            }

            if let Ok(transaction) =
                serde_json::from_value::<pay_with_moon::Transaction>(payload.clone())
            {
                tracing::info!(?transaction, "Received new card transaction notification");
                // TODO: we should persist this, for now, when we need this info, we fetch it again
                // from moon
            } else if let Ok(invoice) =
                serde_json::from_value::<pay_with_moon::InvoicePaymentWrapper>(payload.clone())
            {
                tracing::info!(?invoice, "Received payment notification");

                if let InvoicePaymentType::MoonCreditFundsCredited = invoice.kind {
                    if let Err(error) = data.moon.handle_paid_invoice(invoice.data.clone()).await {
                        tracing::error!("Failed updating moon invoice {error:#}");
                    }
                }
                tracing::warn!(?invoice, "Received payment notification with unknown type");
            } else {
                tracing::warn!("Received unknown webhook data");
            };
            Ok((StatusCode::OK, ()))
        }

        // Handle request without JSON body or invalid JSON
        Err(JsonRejection::MissingJsonContentType(_))
        | Err(JsonRejection::JsonDataError(_))
        | Err(JsonRejection::JsonSyntaxError(_)) => {
            tracing::debug!(?payload, "Webhook registered but did not match");

            Ok((StatusCode::OK, ()))
        }

        // Handle other JSON rejection cases
        Err(e) => {
            tracing::error!("Failed at registering webhook {e:#}");

            Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    message: "error".to_string(),
                }),
            ))
        }
    }
}

#[instrument(err(Debug))]
pub async fn get_webhook() -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    tracing::debug!("New webhook registered via http get");

    Ok((StatusCode::OK, ()))
}
