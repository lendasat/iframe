use crate::db;
use crate::model::Borrower;
use crate::model::CreateLoanApplicationSchema;
use crate::model::LoanApplication;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::AppState;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::delete;
use axum::routing::get;
use axum::routing::post;
use axum::Extension;
use axum::Json;
use axum::Router;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/loans/application",
            get(get_loan_applications_by_borrower),
        )
        .route(
            "/api/loans/application/:id",
            get(get_loan_application_by_application_and_application_id),
        )
        .route(
            "/api/loans/application/:id",
            delete(delete_loan_application_by_borrower_and_application_id),
        )
        .route("/api/loans/application", post(create_loan_application))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .with_state(app_state)
}

// TODO: we need to handle a loan application for a debit card separately. And throw an error if the
// user has already a card. In the future we will either allow multiple cards or allow the user to
// recharge his existing car.
#[instrument(skip_all, err(Debug))]
pub async fn create_loan_application(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Json(body): Json<CreateLoanApplicationSchema>,
) -> Result<AppJson<LoanApplication>, Error> {
    if body.ltv > dec!(1.0) || body.ltv < Decimal::zero() {
        return Err(Error::InvalidLtv { ltv: body.ltv });
    }

    if body.interest_rate > dec!(1.0) || body.interest_rate < Decimal::zero() {
        return Err(Error::InvalidInterestRate {
            rate: body.interest_rate,
        });
    }

    if body.loan_amount.is_zero() {
        return Err(Error::InvalidLoanAmount {
            amount: body.loan_amount,
        });
    }

    let loan = db::loan_applications::insert_loan_application(&data.db, body, user.id.as_str())
        .await
        .map_err(Error::Database)?;

    Ok(AppJson(loan))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_applications_by_borrower(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
) -> Result<AppJson<Vec<LoanApplication>>, Error> {
    let loans =
        db::loan_applications::load_all_loan_applications_by_borrower(&data.db, user.id.as_str())
            .await
            .map_err(Error::Database)?;

    Ok(AppJson(loans))
}

#[instrument(skip_all, err(Debug))]
pub async fn get_loan_application_by_application_and_application_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(loan_deal_id): Path<String>,
) -> Result<AppJson<LoanApplication>, Error> {
    let loan = db::loan_applications::get_loan_application_by_borrower_and_application_id(
        &data.db,
        user.id.as_str(),
        loan_deal_id.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    Ok(AppJson(loan))
}

#[instrument(skip_all, err(Debug))]
pub async fn delete_loan_application_by_borrower_and_application_id(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(loan_deal_id): Path<String>,
) -> Result<AppJson<()>, Error> {
    db::loan_applications::mark_as_deleted_by_borrower_and_application_id(
        &data.db,
        user.id.as_str(),
        loan_deal_id.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    Ok(AppJson(()))
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

/// All the errors related to the `contracts` REST API.
#[derive(Debug)]
enum Error {
    /// Failed to interact with the database.
    Database(anyhow::Error),
    InvalidLtv {
        ltv: Decimal,
    },
    InvalidInterestRate {
        rate: Decimal,
    },
    InvalidLoanAmount {
        amount: Decimal,
    },
}

/// Tell `axum` how [`AppError`] should be converted into a response.
///
/// This is also a convenient place to log errors.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        /// How we want error responses to be serialized.
        #[derive(Serialize)]
        struct ErrorResponse {
            message: String,
        }

        let (status, message) = match self {
            Error::Database(e) => {
                // If we configure `tracing` properly, we don't need to add extra context here!
                tracing::error!("Database error: {e:#}");

                // Don't expose any details about the error to the client.
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::InvalidLtv { ltv } => (
                StatusCode::BAD_REQUEST,
                format!("LTV must be between 0 and 1 but was {}", ltv),
            ),
            Error::InvalidInterestRate { rate } => (
                StatusCode::BAD_REQUEST,
                format!("Interest rate must be between 0 and 1 but was {}", rate),
            ),
            Error::InvalidLoanAmount { amount } => (
                StatusCode::BAD_REQUEST,
                format!("Loan amount not valid. Was {}", amount),
            ),
        };
        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
