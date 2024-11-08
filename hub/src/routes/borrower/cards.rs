use crate::model::User;
use crate::moon;
use crate::routes::borrower::auth::jwt_auth;
use crate::routes::AppState;
use crate::routes::ErrorResponse;
use anyhow::Result;
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
