use crate::db;
use crate::model::Borrower;
use crate::moon;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::CARDS_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::AppState;
use anyhow::Context;
use anyhow::Result;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use rust_decimal::Decimal;
use serde::Deserialize;
use serde::Serialize;
use std::str::FromStr;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;
use uuid::Uuid;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_cards))
        .routes(routes!(get_card_transactions))
        .routes(routes!(topup_card))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

/// Get all cards for the authenticated borrower.
#[utoipa::path(
    get,
    path = "/cards",
    tag = CARDS_TAG,
    responses(
        (
            status = 200,
            description = "List of borrower's cards with current details",
            body = Vec<Card>
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
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

    // let mut refreshed_cards = vec![];
    // for card in cards.iter() {
    //     match data.moon.fetch_card_details_from_moon(card).await {
    //         Ok(card) => {
    //             refreshed_cards.push(card);
    //         }
    //         Err(error) => {
    //             tracing::error!(
    //                 card_id = card.id.to_string(),
    //                 "Failed to fetch card details: {error:#}"
    //             )
    //         }
    //     }
    // }

    let cards = cards.into_iter().map(Card::from).collect::<Vec<_>>();

    Ok(AppJson(cards))
}

/// Get transactions for a specific card.
#[utoipa::path(
    get,
    path = "/transactions/{card_id}",
    tag = CARDS_TAG,
    params(
        ("card_id" = String, Path, description = "Card ID")
    ),
    responses(
        (
            status = 200,
            description = "List of transactions for the specified card",
            body = Vec<CardTransaction>
        ),
        (
            status = 400,
            description = "Invalid card ID or card not found"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id = user.id, card_id), err(Debug))]
async fn get_card_transactions(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(card_id): Path<String>,
) -> Result<AppJson<Vec<CardTransaction>>, Error> {
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
        .map(CardTransaction::from)
        .collect::<Vec<_>>();

    Ok(AppJson(txs))
}

/// Request body for topping up a card.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct TopupCardRequest {
    /// The currency to use for the topup
    currency: moon::Currency,
    /// The amount in USD to add to the card
    #[serde(with = "rust_decimal::serde::float")]
    amount_usd: Decimal,
    /// The ID of the card to topup
    card_id: Uuid,
}

/// Response from topping up a card containing the invoice details.
#[derive(Debug, Serialize, ToSchema)]
struct TopupCardResponse {
    /// The invoice ID
    invoice_id: Uuid,
    /// The blockchain address to send payment to
    address: String,
    /// The amount in USD
    #[serde(with = "rust_decimal::serde::float")]
    usd_amount: Decimal,
    /// The amount in cryptocurrency
    #[serde(with = "rust_decimal::serde::float")]
    crypto_amount: Decimal,
    /// The currency to pay in
    currency: moon::Currency,
    /// When the invoice expires
    #[serde(with = "time::serde::rfc3339")]
    expires_at: OffsetDateTime,
}

/// Topup a card by generating an invoice.
#[utoipa::path(
    post,
    path = "/topup",
    tag = CARDS_TAG,
    request_body = TopupCardRequest,
    responses(
        (
            status = 200,
            description = "Invoice generated successfully",
            body = TopupCardResponse
        ),
        (
            status = 400,
            description = "Invalid request or card not found"
        ),
        (
            status = 500,
            description = "Failed to generate invoice"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id = user.id), err(Debug))]
async fn topup_card(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    AppJson(request): AppJson<TopupCardRequest>,
) -> Result<AppJson<TopupCardResponse>, Error> {
    tracing::Span::current().record("card_id", tracing::field::display(&request.card_id));
    // Verify the card belongs to this user
    let cards = data
        .moon
        .get_cards_from_db(user.id.clone())
        .await
        .map_err(Error::database)?;
    //
    if !cards.iter().any(|card| card.id == request.card_id) {
        return Err(Error::CardNotFound);
    }

    // Generate a unique contract ID for this topup
    let lendasat_id = Uuid::new_v4().to_string();

    // Generate the invoice
    let invoice = data
        .moon
        .generate_invoice(
            request.amount_usd,
            lendasat_id,
            request.card_id,
            &user.id,
            request.currency,
            data.config.card_topup_fee,
        )
        .await
        .map_err(|e| Error::InvoiceGeneration(format!("{e:#}")))?;

    // Persist the invoice
    data.moon
        .persist_invoice(&invoice)
        .await
        .context("Failed to persist invoice")
        .map_err(Error::database)?;

    Ok(AppJson(TopupCardResponse {
        invoice_id: invoice.id,
        address: invoice.address,
        usd_amount: invoice.usd_amount_owed,
        crypto_amount: invoice.crypto_amount_owed,
        currency: request.currency,
        expires_at: invoice.expires_at,
    }))
}

#[derive(Debug, Serialize, PartialEq, Clone, ToSchema)]
enum TransactionStatus {
    #[schema(title = "Authorization")]
    Authorization,
    #[schema(title = "Reversal")]
    Reversal,
    #[schema(title = "Clearing")]
    Clearing,
    #[schema(title = "Refund")]
    Refund,
    #[schema(title = "Pending")]
    Pending,
    #[schema(title = "Settled")]
    Settled,
    #[serde(untagged)]
    Unknown(#[schema(inline)] String),
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

#[derive(Debug, Serialize, PartialEq, Clone, ToSchema)]
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

#[derive(Debug, Serialize, PartialEq, Clone, ToSchema)]
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

#[derive(Debug, Serialize, PartialEq, Clone, ToSchema)]
#[serde(tag = "type", content = "data")]
enum CardTransaction {
    #[schema(title = "Card")]
    Card(TransactionData),
    #[schema(title = "CardAuthorizationRefund")]
    CardAuthorizationRefund(TransactionData),
    #[schema(title = "DeclineData")]
    DeclineData(DeclineData),
}

impl From<pay_with_moon::Transaction> for CardTransaction {
    fn from(value: pay_with_moon::Transaction) -> Self {
        match value {
            pay_with_moon::Transaction::CardTransaction(tx) => CardTransaction::Card(tx.into()),
            pay_with_moon::Transaction::CardAuthorizationRefund(tx) => {
                CardTransaction::CardAuthorizationRefund(tx.into())
            }
            pay_with_moon::Transaction::DeclineData(dd) => CardTransaction::DeclineData(dd.into()),
        }
    }
}

#[derive(Debug, Serialize, PartialEq, Clone, ToSchema)]
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

#[derive(Debug, Serialize, PartialEq, Clone, ToSchema)]
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

#[derive(Debug, Serialize, ToSchema)]
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
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// Invalid card ID provided.
    InvalidCardId,
    /// Card not found.
    CardNotFound,
    /// Failed to generate invoice.
    InvoiceGeneration(#[allow(dead_code)] String),
    /// JSON parsing error from Axum.
    JsonRejection(JsonRejection),
}

impl Error {
    fn database(e: anyhow::Error) -> Self {
        Self::Database(format!("{e:#}"))
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
            Error::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::InvalidCardId => (
                StatusCode::BAD_REQUEST,
                "Invalid card ID provided".to_owned(),
            ),
            Error::CardNotFound => (StatusCode::BAD_REQUEST, "Card not found".to_owned()),
            Error::InvoiceGeneration(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to generate invoice".to_owned(),
            ),
            Error::JsonRejection(rejection) => (
                StatusCode::BAD_REQUEST,
                format!("Invalid JSON: {rejection}"),
            ),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
