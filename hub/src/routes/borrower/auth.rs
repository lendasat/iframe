use crate::db;
use crate::db::borrowers::generate_random_string;
use crate::db::borrowers::get_user_by_email;
use crate::db::borrowers::get_user_by_rest_token;
use crate::db::borrowers::get_user_by_verification_code;
use crate::db::borrowers::register_user;
use crate::db::borrowers::update_password_reset_token_for_user;
use crate::db::borrowers::user_exists;
use crate::db::borrowers::verify_user;
use crate::db::wallet_backups::NewBorrowerWalletBackup;
use crate::email::Email;
use crate::model::Borrower;
use crate::model::ContractStatus;
use crate::model::FinishUpgradeToPakeRequest;
use crate::model::ForgotPasswordSchema;
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
use crate::routes::borrower::auth::jwt_auth::auth;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use anyhow::anyhow;
use anyhow::Context;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
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
use rust_decimal::Decimal;
use serde::Serialize;
use serde_json::json;
use sha2::Sha256;
use srp::groups::G_2048;
use srp::server::SrpServer;
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
        .route("/api/auth/register", post(post_register))
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
async fn post_register(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<RegisterUserSchema>,
) -> Result<impl IntoResponse, Error> {
    let user_exists = user_exists(&data.db, body.email.as_str())
        .await
        .map_err(Error::Database)?;

    if user_exists {
        return Err(Error::UserExists);
    }

    let referral_code_valid = match &body.invite_code {
        None => {
            return Err(Error::InviteCodeRequired);
        }
        Some(code) => db::borrowers_referral_code::is_referral_code_valid(&data.db, code.as_str())
            .await
            .map_err(|e| Error::Database(anyhow!(e)))?,
    };

    if !referral_code_valid {
        return Err(Error::InvalidReferralCode {
            referral_code: body.invite_code.unwrap_or_default(),
        });
    }

    let mut db_tx = data
        .db
        .begin()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    let user = register_user(
        &mut db_tx,
        body.name.as_str(),
        body.email.as_str(),
        body.salt.as_str(),
        body.verifier.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    if let Some(referral_code) = body.invite_code {
        db::borrowers_referral_code::insert_referred_borrower(
            &mut *db_tx,
            referral_code.as_str(),
            user.id.as_str(),
        )
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;
    }

    db::wallet_backups::insert_borrower_backup(
        &mut *db_tx,
        NewBorrowerWalletBackup {
            borrower_id: user.id.clone(),
            mnemonic_ciphertext: body.wallet_backup_data.mnemonic_ciphertext,
            network: body.wallet_backup_data.network,
            xpub: body.wallet_backup_data.xpub,
        },
    )
    .await
    .map_err(|e| Error::Database(anyhow!(e)))?;

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
    email_instance
        .send_verification_code(
            user.name().as_str(),
            user.email().as_str(),
            verification_url.as_str(),
            verification_code.as_str(),
        )
        .await
        .map_err(Error::CouldNotSendVerificationEmail)?;

    db_tx
        .commit()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    let user_response = serde_json::json!({"message": format!("We sent an email with a verification code to {}", email)});

    Ok(Json(user_response))
}

#[derive(Debug, Serialize)]
struct BorrowerLoanFeature {
    id: String,
    name: String,
}

#[derive(Debug, Serialize)]
struct FilteredUser {
    id: String,
    name: String,
    email: String,
    verified: bool,
    used_referral_code: Option<String>,
    personal_referral_code: Option<String>,
    #[serde(with = "rust_decimal::serde::float")]
    first_time_discount_rate: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    updated_at: OffsetDateTime,
}

impl FilteredUser {
    fn new_user(user: &Borrower) -> Self {
        let created_at_utc = user.created_at;
        let updated_at_utc = user.updated_at;
        Self {
            id: user.id.to_string(),
            email: user.email.to_owned(),
            name: user.name.to_owned(),
            verified: user.verified,
            used_referral_code: user.used_referral_code.clone(),
            personal_referral_code: user.personal_referral_code.clone(),
            first_time_discount_rate: user.first_time_discount_rate_referee.unwrap_or_default(),
            created_at: created_at_utc,
            updated_at: updated_at_utc,
        }
    }
}

#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_pake_login(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<PakeLoginRequest>,
) -> Result<impl IntoResponse, Error> {
    let email = body.email;
    let user = get_user_by_email(&data.db, email.as_str())
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?
        .ok_or(Error::InvalidEmail)?;

    let borrower_id = user.id;

    tracing::trace!(%borrower_id, "User attempting to log in");

    if !user.verified {
        return Err(Error::EmailNotVerified);
    }

    // The presence of a password hash indicates that the user has not upgraded to PAKE yet.
    if user.password.is_some() {
        return Err(Error::PakeUpgradeRequired);
    }

    let verifier = hex::decode(user.verifier).map_err(Error::InvalidVerifier)?;

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
        .context("PakeLoginResponse")
        .map_err(Error::BuildResponse)?;

    let mut pake_protocols = data.pake_protocols.lock().await;

    // We overwrite any PAKE data from a previous login attempt.
    pake_protocols.insert(email, PakeServerData { b: b.to_vec() });

    Ok(response)
}

#[derive(Debug, Serialize)]
struct PakeVerifyResponse {
    server_proof: String,
    token: String,
    enabled_features: Vec<BorrowerLoanFeature>,
    user: FilteredUser,
    wallet_backup_data: WalletBackupData,
}

#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_pake_verify(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<PakeVerifyRequest>,
) -> Result<impl IntoResponse, Error> {
    let email = body.email;
    let user = get_user_by_email(&data.db, email.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::InvalidEmail)?;

    let borrower_id = &user.id;

    if !user.verified {
        return Err(Error::EmailNotVerified);
    }

    let verifier = hex::decode(&user.verifier).map_err(Error::InvalidVerifier)?;

    let a_pub = hex::decode(body.a_pub).map_err(Error::InvalidAPub)?;

    let client_proof = hex::decode(body.client_proof).map_err(Error::InvalidClientProof)?;

    let b = {
        let pake_protocols = data.pake_protocols.lock().await;
        match pake_protocols.get(&email) {
            Some(PakeServerData { b }) => b.clone(),
            None => {
                return Err(Error::UnexpectedPakeVerify);
            }
        }
    };

    let server = SrpServer::<Sha256>::new(&G_2048);

    let server_verifier = server
        .process_reply(&b, &verifier, &a_pub)
        .map_err(Error::PakeVerifyFailed)?;

    server_verifier
        .verify_client(&client_proof)
        .map_err(Error::PakeVerifyFailed)?;

    let server_proof = server_verifier.proof();
    let server_proof = hex::encode(server_proof);

    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + time::Duration::minutes(VERIFICATION_TOKEN_EXPIRY_MINUTES)).unix_timestamp();
    let claims: TokenClaims = TokenClaims {
        user_id: borrower_id.clone(),
        exp,
        iat,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(data.config.jwt_secret.as_ref()),
    )
    .map_err(Error::AuthSessionDecode)?;

    let cookie = Cookie::build(("token", token.to_owned()))
        .path("/")
        .max_age(time::Duration::hours(COOKIE_EXPIRY_HOURS))
        .same_site(SameSite::Lax)
        .http_only(true);

    let features = db::borrower_features::load_borrower_features(&data.db, borrower_id.clone())
        .await
        .map_err(|error| Error::Database(anyhow!(error)))?;

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
        return Err(Error::NoFeaturesEnabled {
            borrower_id: borrower_id.clone(),
        });
    }

    let filtered_user = FilteredUser::new_user(&user);

    let wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(|error| Error::Database(anyhow!(error)))?;

    let wallet_backup_data = WalletBackupData {
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
            json!(PakeVerifyResponse {
                server_proof,
                token,
                enabled_features: features,
                user: filtered_user,
                wallet_backup_data
            })
            .to_string(),
        )
        .context("PakeVerifyResponse")
        .map_err(Error::BuildResponse)?;

    Ok(response)
}

/// Handle the borrower's attempt to upgrade to the PAKE protocol.
///
/// We must first verify their email and old password.
///
/// We return their wallet backup data, so that they can decrypt it locally and send us the backup
/// encrypted using their new password.
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_start_upgrade_to_pake(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<UpgradeToPakeRequest>,
) -> Result<impl IntoResponse, Error> {
    let user = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::InvalidEmail)?;

    let borrower_id = &user.id;

    if !user.verified {
        return Err(Error::EmailNotVerified);
    }

    let is_valid = user.check_password(body.old_password.as_str());

    if !is_valid {
        return Err(Error::InvalidLegacyPassword);
    }

    let wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, borrower_id)
        .await
        .context("Missing wallet backup")
        .map_err(Error::Database)?;

    let old_wallet_backup_data = WalletBackupData {
        mnemonic_ciphertext: wallet_backup.mnemonic_ciphertext,
        network: wallet_backup.network,
        xpub: wallet_backup.xpub,
    };

    let contracts = db::contracts::load_contracts_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(Error::Database)?;

    let contract_pks = contracts
        .iter()
        // Unspent contracts.
        .filter(|c| !matches!(c.status, ContractStatus::Closed))
        // Contracts that may have been funded.
        .filter(|c| c.contract_address.is_some())
        .map(|c| c.borrower_pk)
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
        .context("UpgradeToPakeResponse")
        .map_err(Error::BuildResponse)?;

    Ok(response)
}

/// Handle the borrower's attempt to finish the upgrade to the PAKE protocol.
///
/// We must first verify their email and old password.
///
/// We then instert their new wallet backup as a separate entry.
///
/// After that, we insert in the DB values needed to authenticate the borrower via PAKE.
/// Additionally, we erase the old pasword hash from the database, as the borrower won't be
/// authenticating that way anymore.
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_finish_upgrade_to_pake(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<FinishUpgradeToPakeRequest>,
) -> Result<impl IntoResponse, Error> {
    let user = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::InvalidEmail)?;

    let borrower_id = user.id.clone();

    if !user.verified {
        return Err(Error::EmailNotVerified);
    }

    let is_valid = user.check_password(body.old_password.as_str());

    if !is_valid {
        return Err(Error::InvalidLegacyPassword);
    }

    let mut db_tx = data
        .db
        .begin()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    db::wallet_backups::insert_borrower_backup(
        &mut *db_tx,
        NewBorrowerWalletBackup {
            borrower_id,
            mnemonic_ciphertext: body.new_wallet_backup_data.mnemonic_ciphertext,
            network: body.new_wallet_backup_data.network,
            xpub: body.new_wallet_backup_data.xpub,
        },
    )
    .await
    .map_err(|error| Error::Database(anyhow!(error)))?;

    db::borrowers::upgrade_to_pake(
        &mut *db_tx,
        body.email.as_str(),
        body.salt.as_str(),
        body.verifier.as_str(),
    )
    .await
    .map_err(Error::Database)?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .body(json!({ "upgraded": true }).to_string())
        .context("PakeUpgradedResponse")
        .map_err(Error::BuildResponse)?;

    db_tx
        .commit()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    Ok(response)
}

#[instrument(skip_all, fields(borrower_id), err(Debug, level = Level::DEBUG))]
async fn verify_email_handler(
    State(data): State<Arc<AppState>>,
    Path(verification_code): Path<String>,
) -> Result<impl IntoResponse, Error> {
    let user = get_user_by_verification_code(&data.db, verification_code.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::InvalidVerificationCode)?;

    let borrower_id = &user.id;

    tracing::trace!(%borrower_id, "User attempting to verify email");

    if user.verified {
        return Err(Error::AlreadyVerified);
    }

    verify_user(&data.db, verification_code.as_str())
        .await
        .map_err(Error::Database)?;

    let response = serde_json::json!({
            "message": "Email verified successfully"
        }
    );

    Ok(Json(response))
}

#[instrument(skip_all, fields(borrower_id), err(Debug, level = Level::DEBUG))]
async fn forgot_password_handler(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<ForgotPasswordSchema>,
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
                message: "No user with that email".to_string(),
            };
            (StatusCode::NOT_FOUND, Json(error_response))
        })?;

    let borrower_id = &user.id;

    if !user.verified {
        let error_response = ErrorResponse {
            message: "Account not verified".to_string(),
        };
        return Err((StatusCode::FORBIDDEN, Json(error_response)));
    }

    // TODO: We could support this, but it's even more convoluted. We can implement it if any user
    // runs into this.
    if user.password.is_some() {
        let error_response = ErrorResponse {
            message: "Cannot change password before upgrading to PAKE".to_string(),
        };
        return Err((StatusCode::FORBIDDEN, Json(error_response)));
    }

    let password_reset_token = generate_random_string(PASSWORD_RESET_TOKEN_LENGTH);
    let password_reset_at =
        OffsetDateTime::now_utc() + time::Duration::minutes(PASSWORD_TOKEN_EXPIRES_IN_MINUTES);

    let has_contracts_before_pake =
        db::contracts::has_contracts_before_pake_borrower(&data.db, borrower_id)
            .await
            .map_err(|e| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", e),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    let mut password_reset_url = format!(
        "{}/resetpassword/{}/{}",
        data.config.borrower_frontend_origin.to_owned(),
        password_reset_token,
        user.email
    );

    // If this user has contracts before the PAKE upgrade, we do not allow them to reset their
    // password using a mnemonic. Using a mnemonic would remove the passphrase embedded in their
    // encrypted local wallet, and this passphrase is needed to spend contracts created before the
    // PAKE upgrade.
    if has_contracts_before_pake {
        password_reset_url.push_str("?nomn=true");
    }

    let email_instance = Email::new(data.config.clone());
    if let Err(error) = email_instance
        .send_password_reset_token(
            user.name().as_str(),
            user.email().as_str(),
            PASSWORD_TOKEN_EXPIRES_IN_MINUTES,
            password_reset_url.as_str(),
        )
        .await
    {
        tracing::error!(borrower_id, "Failed resetting user password {error:#}");
        let json_error = ErrorResponse {
            message: "Something bad happened while sending the password reset code".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json_error)));
    }

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

#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn reset_password_handler(
    State(data): State<Arc<AppState>>,
    Path(password_reset_token): Path<String>,
    AppJson(body): AppJson<ResetPasswordSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let user = get_user_by_rest_token(&data.db, password_reset_token.as_str())
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

    let borrower_id = &user.id;

    let old_wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(|error| {
            let error_response = ErrorResponse {
                message: format!("Failed reading wallet backup: {}", error),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
        })?;

    // We can only run this check if the account is PAKE-compatible. The Xpub _changes_ after a PAKE
    // upgrade.
    if old_wallet_backup.xpub != body.new_wallet_backup_data.xpub {
        let error_response = ErrorResponse {
            message: "New Xpub does not match old one".to_string(),
        };
        return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)));
    }

    let mut db_tx = data.db.begin().await.map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::wallet_backups::insert_borrower_backup(
        &mut *db_tx,
        NewBorrowerWalletBackup {
            borrower_id: borrower_id.clone(),
            mnemonic_ciphertext: body.new_wallet_backup_data.mnemonic_ciphertext,
            network: body.new_wallet_backup_data.network,
            xpub: body.new_wallet_backup_data.xpub,
        },
    )
    .await
    .map_err(|e| {
        let error_response = ErrorResponse {
            message: format!("Database error: {}", e),
        };
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
    })?;

    db::borrowers::update_verifier_and_salt(
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
    enabled_features: Vec<BorrowerLoanFeature>,
    user: FilteredUser,
}

#[instrument(skip_all, fields(borrower_id = user.id), err(Debug, level = Level::DEBUG))]
async fn get_me_handler(
    State(data): State<Arc<AppState>>,
    Extension(user): Extension<Borrower>,
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

#[derive(Debug, Serialize)]
pub(crate) struct ErrorResponse {
    message: String,
}

#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn check_auth_handler(
    Extension(_user): Extension<Borrower>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    Ok(())
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
    /// The request body contained invalid JSON.
    JsonRejection(JsonRejection),
    /// Failed to interact with the database.
    Database(anyhow::Error),
    /// User with this email already exists.
    UserExists,
    /// User with this email does not exist.
    InvalidEmail,
    /// No invite code provided.
    InviteCodeRequired,
    /// Invalid or expired referral code.
    InvalidReferralCode { referral_code: String },
    /// Failed sending notification email.
    CouldNotSendVerificationEmail(anyhow::Error),
    /// User did not verify their email.
    EmailNotVerified,
    /// The verification code provided does not exist.
    InvalidVerificationCode,
    /// User already verified.
    AlreadyVerified,
    /// User legacy password and email did not match.
    InvalidLegacyPassword,
    /// Could not decode the user's authentication session token.
    AuthSessionDecode(jsonwebtoken::errors::Error),
    /// Failed to build a response.
    BuildResponse(anyhow::Error),
    /// No features enabled for the user.
    NoFeaturesEnabled { borrower_id: String },
    /// Cannot log in without first upgrading to PAKE.
    PakeUpgradeRequired,
    /// Invalid PAKE verifier value coming from the client.
    InvalidVerifier(hex::FromHexError),
    /// Invalid PAKE A value coming from the client.
    InvalidAPub(hex::FromHexError),
    /// Invalid PAKE client proof.
    InvalidClientProof(hex::FromHexError),
    /// Unexpected PAKE verify request.
    UnexpectedPakeVerify,
    /// Failed to process the client's PAKE verify request.
    PakeVerifyFailed(srp::types::SrpAuthError),
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

/// Tell `axum` how [`Error`] should be converted into a response.
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
            Error::JsonRejection(rejection) => {
                // This error is caused by bad user input so don't log it
                (rejection.status(), rejection.body_text())
            }
            Error::Database(e) => {
                // If we configure `tracing` properly, we don't need to add extra context here!
                tracing::error!("Database error: {e:#}");

                // Don't expose any details about the error to the client.
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::UserExists => (StatusCode::CONFLICT, "Email already used".to_owned()),
            Error::InviteCodeRequired => (
                StatusCode::BAD_REQUEST,
                "An invite code is required at this time".to_owned(),
            ),
            Error::InvalidReferralCode { referral_code } => {
                tracing::warn!(referral_code, "User tried invalid referral code");

                (StatusCode::BAD_REQUEST, "Invalid referral code".to_owned())
            }
            Error::CouldNotSendVerificationEmail(e) => {
                tracing::error!("Could not send mail to verify email: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong".to_owned(),
                )
            }
            Error::InvalidEmail => (
                StatusCode::BAD_REQUEST,
                "Invalid email or password".to_owned(),
            ),
            Error::EmailNotVerified => (
                StatusCode::BAD_REQUEST,
                "Please verify your email before you can log in".to_owned(),
            ),
            Error::InvalidVerificationCode => (
                StatusCode::UNAUTHORIZED,
                "Invalid verification code or user does not exist".to_owned(),
            ),
            Error::AlreadyVerified => (StatusCode::CONFLICT, "User already verified".to_owned()),
            Error::InvalidLegacyPassword => (
                StatusCode::UNAUTHORIZED,
                "Invalid email or password".to_owned(),
            ),
            Error::AuthSessionDecode(e) => {
                tracing::error!("Failed at decoding auth session: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong.".to_owned(),
                )
            }
            Error::BuildResponse(e) => {
                tracing::error!("Failed to build response: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong.".to_owned(),
                )
            }
            Error::NoFeaturesEnabled { borrower_id } => {
                tracing::error!(borrower_id, "No features enabled for user");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong.".to_owned(),
                )
            }
            // IMPORTANT NOTE: We rely on the presence of the string `upgrade-to-pake` for the
            // client to understand what to do next.
            Error::PakeUpgradeRequired => (StatusCode::BAD_REQUEST, "upgrade-to-pake".to_owned()),
            Error::InvalidVerifier(e) => {
                tracing::error!("Invalid PAKE verifier in DB: {e:#}");

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Something went wrong.".to_owned(),
                )
            }
            Error::InvalidAPub(e) => {
                tracing::error!("Invalid PAKE `A` value coming from client: {e:#}");

                (StatusCode::BAD_REQUEST, "Invalid credentials.".to_owned())
            }
            Error::InvalidClientProof(e) => {
                tracing::error!("Invalid PAKE client proof coming from client: {e:#}");

                (StatusCode::BAD_REQUEST, "Invalid credentials.".to_owned())
            }
            Error::UnexpectedPakeVerify => {
                tracing::error!("Got PAKE verify before PAKE login");

                (StatusCode::BAD_REQUEST, "Invalid login attempt.".to_owned())
            }
            Error::PakeVerifyFailed(e) => {
                tracing::error!("PAKE verify failed: {e:#}");

                (StatusCode::BAD_REQUEST, "Invalid credentials.".to_owned())
            }
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
