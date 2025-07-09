use crate::db;
use crate::model::Borrower;
use crate::model::BorrowerLoanFeatureResponse;
use crate::model::FilteredUser;
use crate::model::MeResponse;
use crate::model::PasswordAuth;
use crate::routes::borrower::ME_TAG;
use crate::routes::AppState;
use axum::extract::FromRequest;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use serde::Serialize;
use std::sync::Arc;
use tracing::instrument;
use tracing::Level;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(get_me_handler))
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            super::auth::jwt_auth::auth,
        ))
        .with_state(app_state)
}

/// Get current user information.
#[utoipa::path(
    get,
    path = "/me",
    tag = ME_TAG,
    responses(
        (
            status = 200,
            description = "Current user information",
            body = MeResponse
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id = user.id), err(Debug, level = Level::DEBUG))]
async fn get_me_handler(
    State(data): State<Arc<AppState>>,
    Extension((user, password_auth_info)): Extension<(Borrower, PasswordAuth)>,
) -> Result<AppJson<MeResponse>, Error> {
    let personal_telegram_token =
        db::telegram_bot::borrower::get_or_create_token_by_borrower_id(&data.db, user.id.as_str())
            .await
            .map_err(Error::database)?;

    let filtered_user = FilteredUser::new_user(&user, &password_auth_info, personal_telegram_token);

    let features = db::borrower_features::load_borrower_features(&data.db, user.id.clone())
        .await
        .map_err(Error::database)?;

    let features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(BorrowerLoanFeatureResponse {
                    id: f.id.clone(),
                    name: f.name.clone(),
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if features.is_empty() {
        return Err(Error::NoFeaturesEnabled {
            borrower_id: user.id.clone(),
        });
    }

    Ok(AppJson(MeResponse {
        enabled_features: features,
        user: filtered_user,
    }))
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

#[derive(Debug)]
enum Error {
    /// Failed to interact with the database.
    Database(#[allow(dead_code)] String),
    /// No features enabled for the user.
    NoFeaturesEnabled {
        #[allow(dead_code)]
        borrower_id: String,
    },
}

impl Error {
    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
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
            Error::Database(_) | Error::NoFeaturesEnabled { .. } => {
                // Don't expose any details about the error to the client.
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
