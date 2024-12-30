use crate::db;
use crate::db::borrowers::generate_random_string;
use crate::db::borrowers::get_user_by_email;
use crate::db::borrowers::get_user_by_rest_token;
use crate::db::borrowers::get_user_by_verification_code;
use crate::db::borrowers::register_user;
use crate::db::borrowers::update_password_reset_token_for_user;
use crate::db::borrowers::update_user_password;
use crate::db::borrowers::user_exists;
use crate::db::borrowers::verify_user;
use crate::db::wallet_backups::NewBorrowerWalletBackup;
use crate::email::Email;
use crate::model::ForgotPasswordSchema;
use crate::model::LoginUserSchema;
use crate::model::RegisterUserSchema;
use crate::model::ResetPasswordSchema;
use crate::model::TokenClaims;
use crate::model::User;
use crate::model::WalletBackupData;
use crate::routes::borrower::auth::jwt_auth::auth;
use crate::routes::lender::auth::FilteredUser;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use axum::extract::Path;
use axum::extract::State;
use axum::http::header;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::routing::get;
use axum::routing::post;
use axum::routing::put;
use axum::Extension;
use axum::Json;
use axum::Router;
use axum_extra::extract::cookie::Cookie;
use axum_extra::extract::cookie::SameSite;
use jsonwebtoken::encode;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;
use tracing::Level;

pub(crate) mod jwt_auth;

/// Expiry time of a session cookie
const COOKIE_EXPIRY_HOURS: i64 = 1;
/// Expiry time of an activation code
const VERIFICATION_TOKEN_EXPIRY_MINUTES: i64 = 60;
/// Expiry time of a password reset token
const PASSWORD_TOKEN_EXPIRES_IN_MINUTES: i64 = 10;
const PASSWORD_RESET_TOKEN_LENGTH: usize = 20;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/auth/register", post(register_user_handler))
        .route("/api/auth/login", post(login_user_handler))
        .route(
            "/api/auth/logout",
            get(logout_handler)
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth)),
        )
        .route(
            "/api/auth/check",
            get(check_auth_handler)
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth)),
        )
        .route(
            "/api/auth/verifyemail/:verification_code",
            get(verify_email_handler),
        )
        .route("/api/auth/forgotpassword", post(forgot_password_handler))
        .route(
            "/api/auth/resetpassword/:password_reset_token",
            put(reset_password_handler),
        )
        .route(
            "/api/users/me",
            get(get_me_handler)
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth)),
        )
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
pub async fn register_user_handler(
    State(data): State<Arc<AppState>>,
    Json(body): Json<RegisterUserSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user_exists = user_exists(&data.db, body.email.as_str())
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    message: format!("Database error: {}", e),
                }),
            )
        })?;

    if user_exists {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                message: "User with that email already exists".to_string(),
            }),
        ));
    }

    let invite_code = match body.invite_code {
        None => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    message: "An invite code is required at this time".to_string(),
                }),
            ));
        }
        Some(code) => db::invite_code::load_invite_code_borrower(&data.db, code.as_str()).await,
    };

    let invite_code = match invite_code {
        Ok(Some(code)) => code,
        Ok(None) | Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    message: "Provided invite code does not exist".to_string(),
                }),
            ));
        }
    };

    if !invite_code.active {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "Provided invite code is expired".to_string(),
            }),
        ));
    }

    let user: User = register_user(
        &data.db,
        body.name.as_str(),
        body.email.as_str(),
        body.password.as_str(),
        Some(invite_code),
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::wallet_backups::insert_borrower_backup(
        &data.db,
        NewBorrowerWalletBackup {
            borrower_id: user.id.clone(),
            passphrase_hash: body.wallet_backup_data.passphrase_hash,
            mnemonic_ciphertext: body.wallet_backup_data.mnemonic_ciphertext,
            network: body.wallet_backup_data.network,
            xpub: body.wallet_backup_data.xpub,
        },
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    //  Create an Email instance
    let email = user.email.clone();
    let verification_code = user
        .clone()
        .verification_code
        .expect("to have verification code for new user");
    let verification_url = format!(
        "{}/verifyemail/{}",
        data.config.borrower_frontend_origin.to_owned(),
        verification_code.as_str()
    );

    let email_instance = Email::new(data.config.clone());
    if let Err(err) = email_instance
        .send_verification_code(user, verification_url.as_str(), verification_code.as_str())
        .await
    {
        tracing::error!("Failed sending email {err:#}");
        let json_error = ErrorResponse {
            message: "Something bad happended while sending the verification code".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
    }

    let user_response = serde_json::json!({"message": format!("We sent an email with a verification code to {}", email)});

    Ok(Json(user_response))
}

#[derive(Debug, Serialize)]
pub struct BorrowerLoanFeature {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub enabled_features: Vec<BorrowerLoanFeature>,
    pub user: FilteredUser,
    pub wallet_backup_data: WalletBackupData,
}

pub async fn login_user_handler(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    Json(body): Json<LoginUserSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user: User = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .ok_or_else(|| {
            let error_response = ErrorResponse {
                message: "Invalid email or password".to_string(),
            };
            (StatusCode::BAD_REQUEST, Json(error_response))
        })?;

    if !user.verified {
        let error_response = ErrorResponse {
            message: "Please verify your email before you can log in".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let is_valid = user.check_password(body.password.as_str());

    if !is_valid {
        let error_response = ErrorResponse {
            message: "Invalid email or password".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + time::Duration::minutes(VERIFICATION_TOKEN_EXPIRY_MINUTES)).unix_timestamp();
    let claims: TokenClaims = TokenClaims {
        user_id: user.id.to_string(),
        exp,
        iat,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(data.config.jwt_secret.as_ref()),
    )
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Failed parsing token: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let cookie = Cookie::build(("token", token.to_owned()))
        .path("/")
        .max_age(time::Duration::hours(COOKIE_EXPIRY_HOURS))
        .same_site(SameSite::Lax)
        .http_only(true);

    let features = db::borrower_features::load_borrower_features(&data.db, user.id.clone())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(BorrowerLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if features.is_empty() {
        let error_response = ErrorResponse {
            message: "No features enabled".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
    }

    let filtered_user = FilteredUser::new_user(&user);

    let wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, user.id.as_str())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed reading wallet backup: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let wallet_backup_data = WalletBackupData {
        passphrase_hash: wallet_backup.passphrase_hash,
        mnemonic_ciphertext: wallet_backup.mnemonic_ciphertext,
        network: wallet_backup.network,
        xpub: wallet_backup.xpub,
    };

    let user_agent = connection_details
        .user_agent
        .unwrap_or("unknown".to_string());
    let ip_address = connection_details.ip.unwrap_or("unknown".to_string());
    tracing::debug!(
        borrower_id = user.id.to_string(),
        ip_address,
        ?user_agent,
        "User logged in"
    );

    if let Err(err) = db::user_logins::insert_borrower_login_activity(
        &data.db,
        user.id.as_str(),
        Some(ip_address),
        user_agent.as_str(),
    )
    .await
    {
        tracing::warn!(
            borrower_id = user.id.to_string(),
            "Failed to track login activity {err:#}"
        )
    }

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::SET_COOKIE.as_str(), cookie.to_string().as_str())
        .body(
            json!(LoginResponse {
                token,
                enabled_features: features,
                user: filtered_user,
                wallet_backup_data
            })
            .to_string(),
        )
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed parsing cookie: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;
    Ok(response)
}

#[instrument(skip_all, err(Debug))]
pub async fn verify_email_handler(
    State(data): State<Arc<AppState>>,
    Path(verification_code): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user: User = get_user_by_verification_code(&data.db, verification_code.as_str())
        .await
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .ok_or_else(|| {
            let error_response = ErrorResponse {
                message: "Invalid verification code or user doesn't exist".to_string(),
            };
            (StatusCode::UNAUTHORIZED, Json(error_response))
        })?;

    if user.verified {
        let error_response = ErrorResponse {
            message: "User already verified".to_string(),
        };
        return Err((StatusCode::CONFLICT, Json(error_response)));
    }

    verify_user(&data.db, verification_code.as_str())
        .await
        .map_err(|e| {
            let json_error = ErrorResponse {
                message: format!("Error updating user: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json_error))
        })?;

    let response = serde_json::json!({
            "message": "Email verified successfully"
        }
    );

    Ok(Json(response))
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
pub async fn forgot_password_handler(
    State(data): State<Arc<AppState>>,
    Json(body): Json<ForgotPasswordSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let success_message = "You will receive a password reset link via email.";
    let email_address = body.email.to_owned().to_ascii_lowercase();

    let user: User = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .ok_or_else(|| {
            let error_response = ErrorResponse {
                message: success_message.to_string(),
            };
            (StatusCode::NOT_FOUND, Json(error_response))
        })?;

    if !user.verified {
        let error_response = ErrorResponse {
            message: "Account not verified".to_string(),
        };
        return Err((StatusCode::FORBIDDEN, Json(error_response)));
    }

    let password_reset_token = generate_random_string(PASSWORD_RESET_TOKEN_LENGTH);
    let password_reset_at =
        OffsetDateTime::now_utc() + time::Duration::minutes(PASSWORD_TOKEN_EXPIRES_IN_MINUTES);

    let password_reset_url = format!(
        "{}/resetpassword/{}",
        data.config.borrower_frontend_origin.to_owned(),
        password_reset_token
    );

    let email_instance = Email::new(data.config.clone());
    if let Err(error) = email_instance
        .send_password_reset_token(
            user.clone(),
            PASSWORD_TOKEN_EXPIRES_IN_MINUTES,
            password_reset_url.as_str(),
        )
        .await
    {
        let user_id = user.id;
        tracing::error!(user_id, "Failed resetting user password {error:#}");
        let json_error = ErrorResponse {
            message: "Something bad happened while sending the password reset code".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
    }

    update_password_reset_token_for_user(
        &data.db,
        password_reset_token.as_str(),
        password_reset_at,
        email_address.as_str(),
    )
    .await
    .map_err(|e| {
        let json_error = ErrorResponse {
            message: format!("Error updating user: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(json_error))
    })?;

    Ok((StatusCode::OK, Json(json!({"message": success_message}))))
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
pub async fn reset_password_handler(
    State(data): State<Arc<AppState>>,
    Path(password_reset_token): Path<String>,
    Json(body): Json<ResetPasswordSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    if body.password != body.password_confirm {
        let error_response = ErrorResponse {
            message: "Passwords do not match".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let user: User = get_user_by_rest_token(&data.db, password_reset_token.as_str())
        .await
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .ok_or_else(|| {
            let error_response = ErrorResponse {
                message: "The password reset token is invalid or has expired".to_string(),
            };
            (StatusCode::FORBIDDEN, Json(error_response))
        })?;

    update_user_password(&data.db, body.password.as_str(), user.email.as_str())
        .await
        .map_err(|e| {
            let json_error = ErrorResponse {
                message: format!("Error updating user: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json_error))
        })?;

    let cookie = Cookie::build(("token", ""))
        .path("/")
        .max_age(time::Duration::minutes(-1))
        .same_site(SameSite::Lax)
        .http_only(true);

    let mut response = Response::new(
        json!({"message": "Password changed successfully. Please continue to login."}).to_string(),
    );
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie.to_string().parse().map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed parsing cookie: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?,
    );
    Ok(response)
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
pub async fn logout_handler() -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let cookie = Cookie::build(("token", ""))
        .path("/")
        .max_age(time::Duration::hours(-1))
        .same_site(SameSite::Lax)
        .http_only(true);

    let mut response = Response::new(json!({"message": "Successfully logged out"}).to_string());
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie.to_string().parse().map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed parsing cookie: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?,
    );
    Ok(response)
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub enabled_features: Vec<BorrowerLoanFeature>,
    pub user: FilteredUser,
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
pub async fn get_me_handler(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let filtered_user = FilteredUser::new_user(&user);

    let features = db::borrower_features::load_borrower_features(&data.db, user.id.clone())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(BorrowerLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if features.is_empty() {
        let error_response = ErrorResponse {
            message: "No features enabled".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
    }

    Ok((
        StatusCode::OK,
        Json(MeResponse {
            enabled_features: features,
            user: filtered_user,
        }),
    ))
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
pub async fn check_auth_handler(
    Extension(_user): Extension<User>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    Ok(())
}

#[derive(Serialize, Debug)]
pub struct UserData {
    pub user: FilteredUser,
}

#[derive(Serialize, Debug)]
pub struct UserResponse {
    pub status: String,
    pub data: UserData,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
