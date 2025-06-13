use crate::db;
use crate::model::Borrower;
use crate::model::CreateLoanApplicationSchema;
use crate::model::LoanApplication;
use crate::routes::borrower::auth::jwt_or_api_auth;
use crate::routes::borrower::LOAN_APPLICATIONS_TAG;
use crate::routes::AppState;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use rust_decimal::prelude::Zero;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_loan_applications_by_borrower))
        .routes(routes!(create_loan_application))
        .routes(routes!(
            get_loan_application_by_application_and_application_id
        ))
        .routes(routes!(put_mark_loan_application_as_deleted))
        .routes(routes!(put_edit_loan_application))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ))
        .with_state(app_state)
}

// TODO: we need to handle a loan application for a debit card separately. And throw an error if the
// user has already a card. In the future we will either allow multiple cards or allow the user to
// recharge their existing card.

/// Create a new loan application.
#[utoipa::path(
post,
path = "/",
tag = LOAN_APPLICATIONS_TAG,
request_body = CreateLoanApplicationSchema,
responses(
    (
    status = 200,
    description = "Loan application created successfully",
    body = LoanApplication
    ),
    (
    status = 400,
    description = "Invalid loan application parameters",
    body = LoanApplicationErrorResponse
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, ?body), ret, err(Debug))]
async fn create_loan_application(
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
        .map_err(Error::database)?;

    Ok(AppJson(loan))
}

/// Get all loan applications for the authenticated borrower.
#[utoipa::path(
get,
path = "/",
tag = LOAN_APPLICATIONS_TAG,
responses(
    (
    status = 200,
    description = "List of loan applications for this borrower",
    body = [LoanApplication]
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn get_loan_applications_by_borrower(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
) -> Result<AppJson<Vec<LoanApplication>>, Error> {
    let loans =
        db::loan_applications::load_all_loan_applications_by_borrower(&data.db, user.id.as_str())
            .await
            .map_err(Error::database)?;

    Ok(AppJson(loans))
}

/// Get a specific loan application by ID.
#[utoipa::path(
get,
path = "/{id}",
tag = LOAN_APPLICATIONS_TAG,
params(
    (
    "id" = String, Path, description = "Loan application ID"
    )
),
responses(
    (
    status = 200,
    description = "Loan application details",
    body = LoanApplication
    ),
    (
    status = 404,
    description = "Loan application not found",
    body = LoanApplicationErrorResponse
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, err(Debug))]
async fn get_loan_application_by_application_and_application_id(
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
    .map_err(Error::database)?
    .ok_or(Error::MissingLoanApplication)?;

    Ok(AppJson(loan))
}

/// Mark a loan application as deleted.
#[utoipa::path(
put,
path = "/delete/{id}",
tag = LOAN_APPLICATIONS_TAG,
params(
    (
    "id" = String, Path, description = "Loan application ID to delete"
    )
),
responses(
    (
    status = 200,
    description = "Loan application marked as deleted successfully"
    ),
    (
    status = 404,
    description = "Loan application not found",
    body = LoanApplicationErrorResponse
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, loan_deal_id), ret, err(Debug))]
async fn put_mark_loan_application_as_deleted(
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
    .map_err(Error::database)?;

    Ok(AppJson(()))
}

#[derive(Deserialize, Debug, ToSchema)]
pub struct EditLoanApplicationRequest {
    #[serde(with = "rust_decimal::serde::float")]
    loan_amount: Decimal,
    duration_days: i32,
    #[serde(with = "rust_decimal::serde::float")]
    interest_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    ltv: Decimal,
}

/// Edit a loan application.
///
/// In practice, we replace the loan application with a new one with the new values, and mark the
/// old one as deleted.
#[utoipa::path(
put,
path = "/edit/{id}",
tag = LOAN_APPLICATIONS_TAG,
params(
    (
    "id" = String, Path, description = "Loan application ID to edit"
    )
),
request_body = EditLoanApplicationRequest,
responses(
    (
    status = 200,
    description = "Loan application edited successfully",
    body = LoanApplication
    ),
    (
    status = 404,
    description = "Loan application not found",
    body = LoanApplicationErrorResponse
    ),
    (
    status = 400,
    description = "Invalid loan application parameters",
    body = LoanApplicationErrorResponse
    )
),
security(
    (
    "api_key" = [])
    )
)
]
#[instrument(skip_all, fields(borrower_id = user.id, loan_deal_id), ret, err(Debug))]
async fn put_edit_loan_application(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
    Path(loan_deal_id): Path<String>,
    Json(body): Json<EditLoanApplicationRequest>,
) -> Result<AppJson<LoanApplication>, Error> {
    let old_application =
        db::loan_applications::get_loan_application_by_borrower_and_application_id(
            &data.db,
            &user.id,
            &loan_deal_id,
        )
        .await
        .map_err(Error::database)?
        .ok_or(Error::MissingLoanApplication)?;

    let create_body = CreateLoanApplicationSchema {
        ltv: body.ltv,
        interest_rate: body.interest_rate,
        loan_amount: body.loan_amount,
        duration_days: body.duration_days,
        loan_asset: old_application.loan_asset,
        loan_type: old_application.loan_type,
        borrower_loan_address: old_application.borrower_loan_address,
        borrower_btc_address: old_application.borrower_btc_address,
        borrower_pk: old_application.borrower_pk,
        borrower_derivation_path: old_application.borrower_derivation_path,
        borrower_npub: old_application.borrower_npub,
        client_contract_id: old_application.client_contract_id,
        repayment_plan: old_application.repayment_plan,
    };

    let new_application =
        db::loan_applications::insert_loan_application(&data.db, create_body, user.id.as_str())
            .await
            .map_err(Error::database)?;

    db::loan_applications::mark_as_deleted_by_borrower_and_application_id(
        &data.db,
        user.id.as_str(),
        loan_deal_id.as_str(),
    )
    .await
    .map_err(Error::database)?;

    Ok(AppJson(new_application))
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
    Database(#[allow(dead_code)] String),
    MissingLoanApplication,
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

impl Error {
    fn database(error: anyhow::Error) -> Self {
        Self::Database(format!("{error:#}"))
    }
}

#[derive(Serialize, ToSchema)]
pub struct LoanApplicationErrorResponse {
    message: String,
}

/// Tell `axum` how [`AppError`] should be converted into a response.
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Error::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong".to_owned(),
            ),
            Error::MissingLoanApplication => (
                StatusCode::BAD_REQUEST,
                "Loan application does not exist".to_string(),
            ),
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
        (status, AppJson(LoanApplicationErrorResponse { message })).into_response()
    }
}
