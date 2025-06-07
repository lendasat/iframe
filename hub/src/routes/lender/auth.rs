use crate::db;
use crate::db::lenders::generate_random_string;
use crate::db::lenders::get_user_by_email;
use crate::db::lenders::get_user_by_rest_token;
use crate::db::lenders::get_user_by_verification_code;
use crate::db::lenders::register_user;
use crate::db::lenders::update_password_reset_token_for_user;
use crate::db::lenders::user_exists;
use crate::db::lenders::verify_user;
use crate::db::telegram_bot::TelegramBotToken;
use crate::db::waitlist::Error;
use crate::db::waitlist::WaitlistRole;
use crate::db::wallet_backups::NewLenderWalletBackup;
use crate::geo_location;
use crate::model::ContractStatus;
use crate::model::FinishUpgradeToPakeRequest;
use crate::model::ForgotPasswordSchema;
use crate::model::Lender;
use crate::model::PakeLoginRequest;
use crate::model::PakeLoginResponse;
use crate::model::PakeServerData;
use crate::model::PakeVerifyRequest;
use crate::model::RegisterUserSchema;
use crate::model::ResetPasswordSchema;
use crate::model::TokenClaims;
use crate::model::UpgradeToPakeRequest;
use crate::model::UpgradeToPakeResponse;
use crate::model::WalletBackupData;
use crate::routes::lender::auth::jwt_auth::auth;
use crate::routes::lender::AUTH_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use crate::utils::is_valid_email;
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
use rand::thread_rng;
use rand::RngCore;
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use sha2::Sha256;
use srp::groups::G_2048;
use srp::server::SrpServer;
use std::sync::Arc;
use time::OffsetDateTime;
use tracing::instrument;
use tracing::Level;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) mod jwt_auth;

/// Expiry time of a session cookie
const COOKIE_EXPIRY_HOURS: i64 = 1;
/// Expiry time of a password reset token
const PASSWORD_TOKEN_EXPIRES_IN_MINUTES: i64 = 10;
const PASSWORD_RESET_TOKEN_LENGTH: usize = 20;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route(
            "/api/auth/upgrade-to-pake",
            post(post_start_upgrade_to_pake),
        )
        .route(
            "/api/auth/finish-upgrade-to-pake",
            post(post_finish_upgrade_to_pake),
        )
        .route("/api/auth/pake-login", post(post_pake_login))
        .route("/api/auth/pake-verify", post(post_pake_verify))
        .route(
            "/api/auth/refresh-token",
            post(refresh_token_handler)
                .route_layer(middleware::from_fn_with_state(app_state.clone(), auth)),
        )
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
        .route("/api/auth/waitlist", post(post_add_to_waitlist))
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

pub(crate) fn router_openapi(app_state: Arc<AppState>) -> OpenApiRouter {
    OpenApiRouter::new()
        .routes(routes!(post_register))
        .with_state(app_state)
}

/// Register a new user with email and password.
#[utoipa::path(
    post,
    request_body = RegisterUserSchema,
    path = "/register",
    tag = AUTH_TAG,
    responses(
        (
            status = 200,
            description = "User successfully registered, verification email sent"
        ),
        (
            status = 400,
            description = "Invalid input or invite code"
        ),
        (
            status = 409,
            description = "User already exists"
        )
    )
)]
#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn post_register(
    State(data): State<Arc<AppState>>,
    Json(body): Json<RegisterUserSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    if !is_valid_email(body.email.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                message: "Invalid email provided".to_string(),
            }),
        ));
    }

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
        Some(code) => db::invite_code::load_invite_code_lender(&data.db, code.as_str()).await,
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

    let mut db_tx = data.db.begin().await.map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let user: Lender = register_user(
        &mut *db_tx,
        body.name.as_str(),
        body.email.as_str(),
        body.salt.as_str(),
        body.verifier.as_str(),
        Some(invite_code),
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::wallet_backups::insert_lender_backup(
        &mut *db_tx,
        NewLenderWalletBackup {
            lender_id: user.id.clone(),
            mnemonic_ciphertext: body.wallet_backup_data.mnemonic_ciphertext,
            network: body.wallet_backup_data.network,
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

    let verification_url = data
        .config
        .lender_frontend_origin
        .join(format!("/verifyemail/{}", verification_code.as_str()).as_str())
        .expect("to be a correct URL");

    data.notifications
        .send_verification_code(
            user.name().as_str(),
            user.email().as_str(),
            verification_url,
            verification_code.as_str(),
        )
        .await;

    db_tx.commit().await.map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let user_response =
        serde_json::json!({"message": format!("We sent an email with a verificaode to {}", email)});

    Ok(Json(user_response))
}

#[derive(Debug, Serialize)]
struct LenderLoanFeature {
    id: String,
    name: String,
}

#[instrument(skip_all, fields(lender_id), err(Debug))]
async fn post_pake_login(
    State(data): State<Arc<AppState>>,
    Json(body): Json<PakeLoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let email = body.email;
    let user: Lender = get_user_by_email(&data.db, email.as_str())
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

    let lender_id = &user.id;
    tracing::Span::current().record("lender_id", lender_id);

    if !user.verified {
        let error_response = ErrorResponse {
            message: "You must verify your email before you can log in".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    // The presence of a password hash indicates that the user has not upgraded to PAKE yet.
    if user.password.is_some() {
        let error_response = ErrorResponse {
            message: "upgrade-to-pake".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let verifier = hex::decode(user.verifier).map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Invalid verifier: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let server = SrpServer::<Sha256>::new(&G_2048);

    let mut b = [0u8; 64];

    {
        let mut rng = thread_rng();
        rng.fill_bytes(&mut b)
    };

    let b_pub = server.compute_public_ephemeral(&b, &verifier);

    let b_pub = hex::encode(b_pub);

    let response = Response::builder()
        .status(StatusCode::OK)
        .body(
            json!(PakeLoginResponse {
                b_pub,
                salt: user.salt
            })
            .to_string(),
        )
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed to build response: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let mut pake_protocols = data.pake_protocols.lock().await;

    // We overwrite any PAKE data from a previous login attempt.
    pake_protocols.insert(email, PakeServerData { b: b.to_vec() });

    Ok(response)
}

#[derive(Debug, Serialize)]
struct PakeVerifyResponse {
    server_proof: String,
    token: String,
    enabled_features: Vec<LenderLoanFeature>,
    user: FilteredUser,
    wallet_backup_data: WalletBackupData,
}

#[instrument(skip_all, fields(lender_id), err(Debug))]
async fn post_pake_verify(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    Json(body): Json<PakeVerifyRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let email = body.email;
    let user = get_user_by_email(&data.db, email.as_str())
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

    let lender_id = &user.id;
    tracing::Span::current().record("lender_id", lender_id);

    if !user.verified {
        let error_response = ErrorResponse {
            message: "You must verify your email before you can log in".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let verifier = hex::decode(&user.verifier).map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Invalid verifier: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let a_pub = hex::decode(body.a_pub).map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Invalid A: {}", e),
        };
        (StatusCode::BAD_REQUEST, Json(error_response))
    })?;

    let client_proof = hex::decode(body.client_proof).map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Invalid proof: {}", e),
        };
        (StatusCode::BAD_REQUEST, Json(error_response))
    })?;

    let b = {
        let pake_protocols = data.pake_protocols.lock().await;
        match pake_protocols.get(&email) {
            Some(PakeServerData { b }) => b.clone(),
            None => {
                let error_response = ErrorResponse {
                    message: "Sent verification request before login request".to_string(),
                };
                return Err((StatusCode::BAD_REQUEST, Json(error_response)));
            }
        }
    };

    let server = SrpServer::<Sha256>::new(&G_2048);

    let server_verifier = server.process_reply(&b, &verifier, &a_pub).map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Failed to verify login: {e}"),
        };
        (StatusCode::BAD_REQUEST, Json(error_response))
    })?;

    server_verifier.verify_client(&client_proof).map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Failed to verify login: {e}"),
        };
        (StatusCode::BAD_REQUEST, Json(error_response))
    })?;

    let server_proof = server_verifier.proof();
    let server_proof = hex::encode(server_proof);

    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + time::Duration::hours(COOKIE_EXPIRY_HOURS)).unix_timestamp();
    let claims: TokenClaims = TokenClaims {
        user_id: lender_id.clone(),
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

    let wallet_backup = db::wallet_backups::find_by_lender_id(&data.db, lender_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed reading wallet backup: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let wallet_backup_data = WalletBackupData {
        mnemonic_ciphertext: wallet_backup.mnemonic_ciphertext,
        network: wallet_backup.network,
    };

    let features = db::lender_features::load_lender_features(&data.db, lender_id.clone())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let enabled_features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(LenderLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    let personal_telegram_token =
        db::telegram_bot::lender::get_or_create_token_by_lender_id(&data.db, user.id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    let user_agent = connection_details
        .user_agent
        .unwrap_or("unknown".to_string());
    let ip_address = connection_details.ip.unwrap_or("unknown".to_string());
    tracing::debug!(
        lender_id = user.id.to_string(),
        ip_address,
        ?user_agent,
        "Lender logged in"
    );

    let profile_url = data
        .config
        .borrower_frontend_origin
        .join("/settings/profile")
        .expect("to be a correct URL");

    let location = geo_location::get_geo_info(ip_address.as_str()).await.ok();

    if let Err(err) = db::user_logins::insert_lender_login_activity(
        &data.db,
        user.id.as_str(),
        Some(ip_address.clone()),
        location
            .as_ref()
            .map(|l| l.country.clone())
            .unwrap_or_default(),
        location
            .as_ref()
            .map(|l| l.city.clone())
            .unwrap_or_default(),
        user_agent.as_str(),
    )
    .await
    {
        tracing::warn!(
            lender_id = user.id.to_string(),
            "Failed to track login activity {err:#}"
        )
    }

    data.notifications
        .send_login_information_lender(
            &user,
            profile_url,
            ip_address.as_str(),
            OffsetDateTime::now_utc(),
            location.map(|a| format!("{}", a)),
            user_agent.as_str(),
        )
        .await;

    let filtered_user = FilteredUser::new_user(&user, personal_telegram_token);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::SET_COOKIE.as_str(), cookie.to_string().as_str())
        .body(
            json!(PakeVerifyResponse {
                server_proof,
                token,
                enabled_features,
                user: filtered_user,
                wallet_backup_data
            })
            .to_string(),
        )
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed to build response: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    Ok(response)
}

#[instrument(skip_all, fields(lender_id = user.id), err(Debug))]
async fn refresh_token_handler(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + time::Duration::hours(COOKIE_EXPIRY_HOURS)).unix_timestamp();
    let claims: TokenClaims = TokenClaims {
        user_id: user.id.clone(),
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
            message: format!("Failed to create new token: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let cookie = Cookie::build(("token", token.to_owned()))
        .path("/")
        .max_age(time::Duration::hours(COOKIE_EXPIRY_HOURS))
        .same_site(SameSite::Lax)
        .http_only(true);

    let mut response =
        Response::new(json!({"message": "Token refreshed successfully"}).to_string());
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

/// Handle the lender's attempt to upgrade to the PAKE protocol.
///
/// We must first verify their email and old password.
///
/// We return their wallet backup data, so that they can decrypt it locally and send us the backup
/// encrypted using their new password.
#[instrument(skip_all, fields(lender_id), err(Debug))]
async fn post_start_upgrade_to_pake(
    State(data): State<Arc<AppState>>,
    Json(body): Json<UpgradeToPakeRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user = get_user_by_email(&data.db, body.email.as_str())
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

    let lender_id = &user.id;
    tracing::Span::current().record("lender_id", lender_id);

    if !user.verified {
        let error_response = ErrorResponse {
            message: "Please verify your email before you can log in".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let is_valid = user.check_password(body.old_password.as_str());

    if !is_valid {
        let error_response = ErrorResponse {
            message: "Invalid email or password".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let wallet_backup = db::wallet_backups::find_by_lender_id(&data.db, lender_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed reading wallet backup: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let old_wallet_backup_data = WalletBackupData {
        mnemonic_ciphertext: wallet_backup.mnemonic_ciphertext,
        network: wallet_backup.network,
    };

    let contracts = db::contracts::load_contracts_by_lender_id(&data.db, lender_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let contract_pks = contracts
        .iter()
        // Contracts that are not yet closed or were never approved.
        .filter(|c| {
            !matches!(
                c.status,
                ContractStatus::Closed
                    | ContractStatus::ClosedByLiquidation
                    | ContractStatus::ClosedByDefaulting
                    | ContractStatus::Cancelled
                    | ContractStatus::RequestExpired
                    | ContractStatus::ApprovalExpired
            )
        })
        // Contracts that may have been funded.
        .filter(|c| c.contract_address.is_some())
        .map(|c| c.lender_pk)
        .collect::<Vec<_>>();

    let response = Response::builder()
        .status(StatusCode::OK)
        .body(
            json!(UpgradeToPakeResponse {
                old_wallet_backup_data,
                contract_pks
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

/// Handle the lender's attempt to finish the upgrade to the PAKE protocol.
///
/// We must first verify their email and old password.
///
/// We then instert their new wallet backup as a separate entry.
///
/// After that, we insert in the DB values needed to authenticate the lender via PAKE. Additionally,
/// we erase the old pasword hash from the database, as the lender won't be authenticating that way
/// anymore.
#[instrument(skip_all, fields(lender_id), err(Debug))]
async fn post_finish_upgrade_to_pake(
    State(data): State<Arc<AppState>>,
    Json(body): Json<FinishUpgradeToPakeRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user = get_user_by_email(&data.db, body.email.as_str())
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

    let lender_id = &user.id;
    tracing::Span::current().record("lender_id", lender_id);

    if !user.verified {
        let error_response = ErrorResponse {
            message: "Please verify your email before you can log in".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let is_valid = user.check_password(body.old_password.as_str());

    if !is_valid {
        let error_response = ErrorResponse {
            message: "Invalid email or password".to_string(),
        };
        return Err((StatusCode::BAD_REQUEST, Json(error_response)));
    }

    let mut db_tx = data.db.begin().await.map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::wallet_backups::insert_lender_backup(
        &mut *db_tx,
        NewLenderWalletBackup {
            lender_id: lender_id.clone(),
            mnemonic_ciphertext: body.new_wallet_backup_data.mnemonic_ciphertext,
            network: body.new_wallet_backup_data.network,
        },
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::lenders::upgrade_to_pake(
        &mut *db_tx,
        body.email.as_str(),
        body.salt.as_str(),
        body.verifier.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Failed upgrading to PAKE: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .body(json!({ "upgraded": true }).to_string())
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed parsing cookie: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    db_tx.commit().await.map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok(response)
}

#[instrument(skip_all, fields(lender_id), err(Debug, level = Level::DEBUG))]
async fn verify_email_handler(
    State(data): State<Arc<AppState>>,
    Path(verification_code): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user: Lender = get_user_by_verification_code(&data.db, verification_code.as_str())
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

    let lender_id = &user.id;
    tracing::Span::current().record("lender_id", lender_id);

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

#[instrument(skip_all, fields(lender_id), err(Debug, level = Level::DEBUG))]
async fn forgot_password_handler(
    State(data): State<Arc<AppState>>,
    Json(body): Json<ForgotPasswordSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user: Lender = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(|e| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?
        .ok_or_else(|| {
            let error_response = ErrorResponse {
                message: "No user with that email".to_string(),
            };
            (StatusCode::NOT_FOUND, Json(error_response))
        })?;

    let lender_id = &user.id;
    tracing::Span::current().record("lender_id", lender_id);

    if !user.verified {
        let error_response = ErrorResponse {
            message: "Account not verified".to_string(),
        };
        return Err((StatusCode::FORBIDDEN, Json(error_response)));
    }

    let password_reset_token = generate_random_string(PASSWORD_RESET_TOKEN_LENGTH);
    let password_reset_at =
        OffsetDateTime::now_utc() + time::Duration::minutes(PASSWORD_TOKEN_EXPIRES_IN_MINUTES);

    let has_contracts_before_pake =
        db::contracts::has_contracts_before_pake_lender(&data.db, lender_id)
            .await
            .map_err(|e| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", e),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    let mut password_reset_url = data
        .config
        .lender_frontend_origin
        .join(format!("/resetpassword/{}/{}", password_reset_token, user.email).as_str())
        .expect("to be a correct URL");

    // If this user has contracts before the PAKE upgrade, we do not allow them to reset their
    // password using a mnemonic. Using a mnemonic would remove the passphrase embedded in their
    // encrypted local wallet, and this passphrase is needed to spend contracts created before the
    // PAKE upgrade.
    if has_contracts_before_pake {
        password_reset_url = password_reset_url
            .join("?nomn=true")
            .expect("to be valid url");
    }

    data.notifications
        .send_password_reset_token(
            user.name().as_str(),
            user.email().as_str(),
            PASSWORD_TOKEN_EXPIRES_IN_MINUTES,
            password_reset_url,
        )
        .await;

    let email_address = body.email.to_owned().to_ascii_lowercase();
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

    Ok((
        StatusCode::OK,
        Json(json!({"message": "You will receive a password reset link via email."})),
    ))
}

#[instrument(skip_all, fields(lender_id), err(Debug))]
async fn reset_password_handler(
    State(data): State<Arc<AppState>>,
    Path(password_reset_token): Path<String>,
    Json(body): Json<ResetPasswordSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user: Lender = get_user_by_rest_token(&data.db, password_reset_token.as_str())
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

    let lender_id = &user.id;
    tracing::Span::current().record("lender_id", lender_id);

    let mut db_tx = data.db.begin().await.map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::wallet_backups::insert_lender_backup(
        &mut *db_tx,
        NewLenderWalletBackup {
            lender_id: lender_id.clone(),
            mnemonic_ciphertext: body.new_wallet_backup_data.mnemonic_ciphertext,
            network: body.new_wallet_backup_data.network,
        },
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::lenders::update_verifier_and_salt(
        &mut *db_tx,
        user.email.as_str(),
        body.salt.as_str(),
        body.verifier.as_str(),
    )
    .await
    .map_err(|error| {
        let error_response = ErrorResponse {
            message: format!("Failed upgrading to PAKE: {}", error),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
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

    db_tx.commit().await.map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    Ok(response)
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn logout_handler() -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
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
struct MeResponse {
    enabled_features: Vec<LenderLoanFeature>,
    user: FilteredUser,
}

#[instrument(skip_all, fields(lender_id = user.id), err(Debug, level = Level::DEBUG))]
async fn get_me_handler(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Lender>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let personal_telegram_token =
        db::telegram_bot::lender::get_or_create_token_by_lender_id(&data.db, user.id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    let filtered_user = FilteredUser::new_user(&user, personal_telegram_token);

    let features = db::lender_features::load_lender_features(&data.db, user.id.clone())
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Database error: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    let enabled_features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(LenderLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    Ok((
        StatusCode::OK,
        Json(MeResponse {
            enabled_features,
            user: filtered_user,
        }),
    ))
}

#[derive(Debug, Serialize)]
struct FilteredUser {
    id: String,
    name: String,
    email: String,
    verified: bool,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    updated_at: OffsetDateTime,
    personal_telegram_token: String,
    timezone: Option<String>,
}

impl FilteredUser {
    fn new_user(user: &Lender, personal_telegram_token: TelegramBotToken) -> Self {
        let created_at_utc = user.created_at;
        let updated_at_utc = user.updated_at;
        Self {
            id: user.id.to_string(),
            email: user.email.to_owned(),
            name: user.name.to_owned(),
            verified: user.verified,
            created_at: created_at_utc,
            updated_at: updated_at_utc,
            personal_telegram_token: personal_telegram_token.token,
            timezone: user.timezone.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
pub(crate) struct ErrorResponse {
    message: String,
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn check_auth_handler(
    Extension(_user): Extension<Lender>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct WaitlistBody {
    email: String,
}

#[instrument(skip_all, err(Debug))]
async fn post_add_to_waitlist(
    State(data): State<Arc<AppState>>,
    Json(body): Json<WaitlistBody>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    db::waitlist::insert_into_waitlist(&data.db, body.email.as_str(), WaitlistRole::Lender)
        .await
        .map_err(|e| match e {
            Error::EmailInUse(_) => {
                let error_response = ErrorResponse {
                    message: "Email already registered".to_string(),
                };
                (StatusCode::CONFLICT, Json(error_response))
            }
            Error::DatabaseError(error) => {
                tracing::error!("Database error when inserting into mailinglist {error:#}");

                let error_response = ErrorResponse {
                    message: "Something went wrong".to_string(),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            }
        })?;

    Ok(Json(()))
}
