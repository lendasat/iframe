use crate::db;
use crate::model::Borrower;
use crate::moon;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::AppState;
use anyhow::anyhow;
use anyhow::Result;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::Value;
use std::str::FromStr;
use std::sync::Arc;
use tracing::instrument;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/cards",
            get(get_cards).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/transaction/:card_id",
            get(get_card_transactions).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route("/api/moon/webhook", post(post_webhook).get(get_webhook))
        .with_state(app_state)
}

#[instrument(skip_all, fields(borrower_id = user.id), err(Debug))]
async fn get_cards(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
) -> Result<AppJson<Vec<Card>>, Error> {
    let cards = data
        .moon
        .get_cards_from_db(user.id)
        .await
        .map_err(Error::database)?;

    let mut refreshed_cards = vec![];
    for card in cards.iter() {
        match data.moon.fetch_card_details_from_moon(card).await {
            Ok(card) => {
                refreshed_cards.push(card);
            }
            Err(error) => {
                tracing::error!(
                    card_id = card.id.to_string(),
                    "Failed to fetch card details: {error:#}"
                )
            }
        }
    }

    let cards = refreshed_cards
        .into_iter()
        .map(Card::from)
        .collect::<Vec<_>>();

    Ok(AppJson(cards))
}

#[instrument(skip_all, fields(borrower_id = user.id, card_id), err(Debug))]
async fn get_card_transactions(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(card_id): Path<String>,
) -> Result<AppJson<Vec<Transaction>>, Error> {
    let uuid = Uuid::from_str(card_id.as_str()).map_err(|_| Error::InvalidCardId)?;
    let cards = data
        .moon
        .get_cards_from_db(user.id)
        .await
        .map_err(Error::database)?;
    if !cards.iter().any(|card| card.id == uuid) {
        // The card might exist in general but we are not aware of it and hence cannot be sure
        // that it belongs to this user
        return Err(Error::CardNotFound);
    }

    let transactions = db::moon::load_moon_transactions_by_card(&data.db, uuid)
        .await
        .map_err(Error::database)?;

    let txs = transactions
        .into_iter()
        .map(Transaction::from)
        .collect::<Vec<_>>();

    Ok(AppJson(txs))
}

#[instrument(skip(data, payload), err(Debug))]
async fn post_webhook(
    State(data): State<Arc<AppState>>,
    payload: Result<Json<Value>, JsonRejection>,
) -> Result<(), Error> {
    match payload {
        // Handle request with JSON body
        Ok(Json(payload)) => {
            if let Ok(json_object) = serde_json::to_string(&payload) {
                tracing::trace!(?json_object, "Received new json webhook data");
            } else {
                tracing::warn!(?payload, "Received new webhook data which was not json");
            }

            if let Ok(moon_message) =
                serde_json::from_value::<pay_with_moon::MoonMessage>(payload.clone())
            {
                tracing::debug!(?moon_message, "Received new message from moon notification");
                if let pay_with_moon::MoonMessage::MoonInvoicePayment(invoice) = &moon_message {
                    if let Err(err) = data.moon.handle_paid_invoice(invoice).await {
                        tracing::error!("Failed at handling moon invoice {err:#}");
                    }
                } else {
                    // MoonMessage::MoonInvoicePayment is already stored in
                    // `moon.handle_paid_invoice`
                    if let Err(err) =
                        db::moon::insert_moon_transactions(&data.db, moon_message).await
                    {
                        tracing::error!("Failed at persisting moon message {err:#}");
                    }
                }
            } else {
                tracing::warn!("Received unknown webhook data");
            };
            Ok(())
        }

        // Handle request without JSON body or invalid JSON
        Err(JsonRejection::MissingJsonContentType(_))
        | Err(JsonRejection::JsonDataError(_))
        | Err(JsonRejection::JsonSyntaxError(_)) => {
            tracing::debug!(?payload, "Webhook registered but did not match");

            Ok(())
        }

        // Handle other JSON rejection cases
        Err(e) => Err(Error::moon(anyhow!("Failed to process webhook: {e:#}"))),
    }
}

#[instrument(err(Debug))]
async fn get_webhook() -> Result<impl IntoResponse, Error> {
    tracing::debug!("New webhook registered via http get");

    Ok((StatusCode::OK, ()))
}

#[derive(Debug, Serialize, PartialEq, Clone)]
enum TransactionStatus {
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

#[derive(Debug, Serialize, PartialEq, Clone)]
struct Fee {
    #[serde(rename = "type")]
    fee_type: String,
    #[serde(with = "rust_decimal::serde::float")]
    amount: Decimal,
    fee_description: String,
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

#[derive(Debug, Serialize, PartialEq, Clone)]
struct TransactionCard {
    public_id: Uuid,
    name: String,
    #[serde(rename = "type")]
    card_type: String,
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

#[derive(Debug, Serialize, PartialEq, Clone)]
#[serde(tag = "type", content = "data")]
enum Transaction {
    Card(TransactionData),
    CardAuthorizationRefund(TransactionData),
    DeclineData(DeclineData),
}

impl From<pay_with_moon::Transaction> for Transaction {
    fn from(value: pay_with_moon::Transaction) -> Self {
        match value {
            pay_with_moon::Transaction::CardTransaction(tx) => Transaction::Card(tx.into()),
            pay_with_moon::Transaction::CardAuthorizationRefund(tx) => {
                Transaction::CardAuthorizationRefund(tx.into())
            }
            pay_with_moon::Transaction::DeclineData(dd) => Transaction::DeclineData(dd.into()),
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Clone)]
struct TransactionData {
    card: TransactionCard,
    transaction_id: Uuid,
    transaction_status: TransactionStatus,
    /// Date when the transaction happened
    /// The date we receive has the following format: 2024-11-14 10:26:24
    datetime: String,
    merchant: String,
    #[serde(with = "rust_decimal::serde::float")]
    amount: Decimal,
    ledger_currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    amount_fees_in_ledger_currency: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    amount_in_transaction_currency: Decimal,
    transaction_currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    amount_fees_in_transaction_currency: Decimal,
    fees: Vec<Fee>,
}

impl From<pay_with_moon::TransactionData> for TransactionData {
    fn from(value: pay_with_moon::TransactionData) -> Self {
        TransactionData {
            card: value.card.into(),
            transaction_id: value.transaction_id,
            transaction_status: value.transaction_status.into(),
            datetime: value.datetime,
            merchant: value.merchant,
            amount: value.amount,
            ledger_currency: value.ledger_currency,
            amount_fees_in_ledger_currency: value.amount_fees_in_ledger_currency,
            amount_in_transaction_currency: value.amount_in_transaction_currency,
            transaction_currency: value.transaction_currency,
            amount_fees_in_transaction_currency: value.amount_fees_in_transaction_currency,
            fees: value.fees.into_iter().map(|fee| fee.into()).collect(),
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Clone)]
struct DeclineData {
    /// The date we receive has the following format: 2024-11-14 10:26:24
    datetime: String,
    merchant: String,
    customer_friendly_description: String,
    #[serde(with = "rust_decimal::serde::float")]
    amount: Decimal,
    card: TransactionCard,
}

impl From<pay_with_moon::DeclineData> for DeclineData {
    fn from(value: pay_with_moon::DeclineData) -> Self {
        DeclineData {
            datetime: value.datetime,
            merchant: value.merchant,
            customer_friendly_description: value.customer_friendly_description,
            amount: value.amount,
            card: value.card.into(),
        }
    }
}

#[derive(Debug, Serialize)]
struct Card {
    id: Uuid,
    #[serde(with = "rust_decimal::serde::float")]
    balance: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    available_balance: Decimal,
    expiration: String,
    pan: String,
    cvv: String,
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

// Create our own JSON extractor by wrapping `axum::Json`. This makes it easy to override the
// rejection and provide our own which formats errors to match our application.
//
// `axum::Json` responds with plain text if the input is invalid.
#[derive(Debug, FromRequest)]
#[from_request(via(Json), rejection(Error))]
struct AppJson<T>(T);

impl<T> IntoResponse for AppJson<T>
where
    Json<T>: IntoResponse,
{
    fn into_response(self) -> Response {
        Json(self.0).into_response()
    }
}

// Error fields are allowed to be dead code because they are actually used when printed in logs.
/// All the errors related to the `cards` REST API.
#[derive(Debug)]
enum Error {
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// General error from Moon service.
    Moon(#[allow(dead_code)] String),
    /// Invalid card ID provided.
    InvalidCardId,
    /// Card not found.
    CardNotFound,
}

impl Error {
    fn database(e: anyhow::Error) -> Self {
        Self::Database(format!("{e:#}"))
    }

    fn moon(e: anyhow::Error) -> Self {
        Self::Moon(format!("{e:#}"))
    }
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

/// Tell `axum` how [`Error`] should be converted into a response.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::JsonRejection(rejection) => {
                // This error is caused by bad user input so don't log it
                (rejection.status(), rejection.body_text())
            }
            Error::Database(_) | Error::Moon(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::InvalidCardId => (
                StatusCode::BAD_REQUEST,
                "Invalid card ID provided".to_owned(),
            ),
            Error::CardNotFound => (StatusCode::BAD_REQUEST, "Card not found".to_owned()),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
