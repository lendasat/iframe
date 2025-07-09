use crate::db;
use crate::routes::AppState;
use anyhow::anyhow;
use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::Json;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tracing::instrument;
use utoipa_axum::router::OpenApiRouter;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .route("/webhook", post(post_webhook).get(get_webhook))
        .with_state(app_state)
}

/// Webhook endpoint for Moon payment service notifications.
///
/// This endpoint receives payment notifications from the Moon service
/// and processes card transactions and payment events.
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
        Err(e) => Err(Error::Moon(anyhow!("Failed to process webhook: {e:#}"))),
    }
}

/// Webhook registration endpoint for Moon payment service.
///
/// This endpoint handles webhook registration requests from the Moon service.
#[instrument(err(Debug))]
async fn get_webhook() -> Result<impl IntoResponse, Error> {
    tracing::debug!("New webhook registered via http get");

    Ok((StatusCode::OK, ()))
}

// Error fields are allowed to be dead code because they are actually used when printed in logs.
/// All the errors related to the Moon webhook API.
#[derive(Debug)]
enum Error {
    /// General error from Moon service.
    Moon(#[allow(dead_code)] anyhow::Error),
}

/// Tell `axum` how [`Error`] should be converted into a response.
impl IntoResponse for Error {
    fn into_response(self) -> axum::response::Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::Moon(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
        };

        (status, Json(ErrorResponse { message })).into_response()
    }
}
