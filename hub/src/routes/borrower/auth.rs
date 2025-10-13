use crate::db;
use crate::db::borrowers::generate_random_string;
use crate::db::borrowers::get_password_auth_info_by_reset_token;
use crate::db::borrowers::get_password_auth_info_by_verification_code;
use crate::db::borrowers::get_user_by_email;
use crate::db::borrowers::get_user_by_id;
use crate::db::borrowers::register_password_auth_user;
use crate::db::borrowers::update_password_reset_token_for_user;
use crate::db::borrowers::user_exists;
use crate::db::borrowers::verify_user;
use crate::db::waitlist::WaitlistRole;
use crate::db::wallet_backups::NewBorrowerWalletBackup;
use crate::geo_location;
use crate::model::empty_string_is_none;
use crate::model::Borrower;
use crate::model::BorrowerLoanFeature;
use crate::model::FilteredUser;
use crate::model::ForgotPasswordSchema;
use crate::model::PakeLoginRequest;
use crate::model::PakeLoginResponse;
use crate::model::PakeServerData;
use crate::model::PakeVerifyRequest;
use crate::model::PasswordAuth;
use crate::model::RegisterUserSchema;
use crate::model::ResetLegacyPasswordSchema;
use crate::model::ResetPasswordSchema;
use crate::model::TokenClaims;
use crate::model::WalletBackupData;
use crate::routes::borrower::AUTH_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use crate::routes::PubkeyChallengeData;
use crate::totp::create_totp_borrower;
use crate::totp::TOTP_TMP_ID_PREFIX;
use crate::utils::is_valid_email;
use anyhow::Context;
use axum::extract::rejection::JsonRejection;
use axum::extract::FromRequest;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::header;
use axum::http::StatusCode;
use axum::middleware;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use axum::Json;
use axum_extra::extract::cookie::Cookie;
use axum_extra::extract::cookie::SameSite;
use bitcoin::secp256k1::ecdsa::Signature;
use bitcoin::secp256k1::Message as Secp256k1Message;
use bitcoin::secp256k1::PublicKey as Secp256k1PublicKey;
use bitcoin::secp256k1::Secp256k1;
use jsonwebtoken::decode;
use jsonwebtoken::encode;
use jsonwebtoken::DecodingKey;
use jsonwebtoken::EncodingKey;
use jsonwebtoken::Header;
use jsonwebtoken::Validation;
use rand::thread_rng;
use rand::RngCore;
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use sha2::Digest;
use sha2::Sha256;
use srp::groups::G_2048;
use srp::server::SrpServer;
use std::str::FromStr;
use std::sync::Arc;
use time::OffsetDateTime;
use totp_rs::Secret;
use tracing::instrument;
use tracing::Level;
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) mod api_account_creator_auth;
pub(crate) mod jwt_auth;
pub(crate) mod jwt_or_api_auth;

/// Expiry time of a session cookie for the browser.
const BROWSER_COOKIE_EXPIRY_HOURS: time::Duration = time::Duration::hours(1);

/// Expiry time of a session cookie for mobile.
const MOBILE_COOKIE_EXPIRY_HOURS: time::Duration = time::Duration::days(7);

/// Expiry time of a JWT for the browser.
const BROWSER_JWT_EXPIRY_HOURS: time::Duration = time::Duration::hours(1);

/// Expiry time of a JWT for mobile.
const MOBILE_JWT_EXPIRY_HOURS: time::Duration = time::Duration::days(7);

/// Expiry time of a password reset token.
const PASSWORD_TOKEN_EXPIRES_IN_MINUTES: i64 = 10;
const PASSWORD_RESET_TOKEN_LENGTH: usize = 20;

/// Expiry time of a pubkey challenge.
const CHALLENGE_EXPIRY_MINUTES: i64 = 5;
const CHALLENGE_LENGTH: usize = 32;

pub(crate) fn router(app_state: Arc<AppState>) -> OpenApiRouter {
    // Routes without authentication
    let public_routes = OpenApiRouter::new()
        .routes(routes!(get_is_registered))
        .routes(routes!(post_register))
        .routes(routes!(post_pake_login))
        .routes(routes!(post_pake_verify))
        .routes(routes!(post_pake_verify_mobile))
        .routes(routes!(post_totp_verify_login))
        .routes(routes!(post_totp_verify_mobile))
        .routes(routes!(verify_email_handler))
        .routes(routes!(forgot_password_handler))
        .routes(routes!(reset_password_handler))
        .routes(routes!(reset_legacy_password_handler))
        .routes(routes!(post_add_to_waitlist))
        .routes(routes!(post_pubkey_challenge))
        .routes(routes!(post_pubkey_register))
        .routes(routes!(post_pubkey_verify));

    // Routes requiring JWT authentication
    let jwt_routes = OpenApiRouter::new()
        .routes(routes!(refresh_token_handler))
        .routes(routes!(refresh_token_handler_mobile))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_auth::auth,
        ));

    // Routes requiring JWT or API key authentication
    let jwt_or_api_routes = OpenApiRouter::new()
        .routes(routes!(logout_handler))
        .routes(routes!(check_auth_handler))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            jwt_or_api_auth::auth,
        ));

    public_routes
        .merge(jwt_routes)
        .merge(jwt_or_api_routes)
        .layer(
            tower::ServiceBuilder::new().layer(middleware::from_fn_with_state(
                app_state.clone(),
                user_connection_details_middleware::ip_user_agent,
            )),
        )
        .with_state(app_state)
}

/// Check if a user is registered and verified with the given email.
#[utoipa::path(
    get,
    path = "/is-registered",
    tag = AUTH_TAG,
    params(
        ("email" = String, Query, description = "Email address to check")
    ),
    responses(
        (
            status = 200,
            description = "Registration and verification status",
            body = IsRegisteredResponse
        ),
        (
            status = 400,
            description = "Invalid email address"
        )
    )
)]
async fn get_is_registered(
    State(data): State<Arc<AppState>>,
    query_params: Query<IsRegisteredParams>,
) -> Result<AppJson<IsRegisteredResponse>, Error> {
    let email = &query_params.email;

    if !is_valid_email(email) {
        return Err(Error::InvalidEmail);
    }

    let res = get_user_by_email(&data.db, email)
        .await
        .map_err(Error::database)?;

    let res = match res {
        Some((_, auth)) => IsRegisteredResponse {
            is_registered: true,
            is_verified: auth.verified,
        },
        None => IsRegisteredResponse {
            is_registered: false,
            is_verified: false,
        },
    };

    Ok(AppJson(res))
}

/// Register a new user with email and password. To create borrower API accounts (using a master API
/// key), refer to /api/create-api-account.
///
/// Possible error types:
/// - Invalid Email: The provided email address format is invalid
/// - User Exists: A user with this email address already exists
/// - Invite Code Required: No invite code was provided (required at this time)
/// - Invalid Referral Code: The provided referral/invite code is invalid or expired
/// - Database Error: Internal database error during user creation or referral code processing
#[utoipa::path(
post,
request_body = RegisterUserSchema,
path = "/register",
tag = AUTH_TAG,
responses(
    (
        status = 200,
        description = "Message if the registration was successful",
        body = RegistrationResponse
    ),
    (
        status = 400,
        description = "Invalid email, invite code required, or invalid referral code"
    ),
    (
        status = 500,
        description = "Internal server error during registration process"
    )
)
)]
#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn post_register(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<RegisterUserSchema>,
) -> Result<AppJson<RegistrationResponse>, Error> {
    if !is_valid_email(body.email.as_str()) {
        return Err(Error::InvalidEmail);
    }

    let user_exists = user_exists(&data.db, body.email.as_str())
        .await
        .map_err(Error::database)?;

    if user_exists {
        return Err(Error::UserExists);
    }

    let referral_code_valid = match &body.invite_code {
        None => {
            if data.config.borrower_invite_code_required {
                return Err(Error::InviteCodeRequired);
            } else {
                true
            }
        }
        Some(code) => db::borrowers_referral_code::is_referral_code_valid(&data.db, code.as_str())
            .await
            .map_err(Error::database)?,
    };

    if !referral_code_valid {
        return Err(Error::InvalidReferralCode {
            referral_code: body.invite_code.unwrap_or_default(),
        });
    }

    let mut db_tx = data.db.begin().await.map_err(Error::database)?;

    let (user, password_auth_info) = register_password_auth_user(
        &mut db_tx,
        body.name.as_str(),
        body.email.as_str(),
        body.salt.as_str(),
        body.verifier.as_str(),
    )
    .await
    .map_err(Error::database)?;

    if let Some(referral_code) = body.invite_code {
        db::borrowers_referral_code::insert_referred_borrower(
            &mut *db_tx,
            referral_code.as_str(),
            user.id.as_str(),
        )
        .await
        .map_err(Error::database)?;
    }

    db::wallet_backups::insert_borrower_backup(
        &mut *db_tx,
        NewBorrowerWalletBackup {
            borrower_id: user.id.clone(),
            mnemonic_ciphertext: body.wallet_backup_data.mnemonic_ciphertext,
            network: body.wallet_backup_data.network,
        },
    )
    .await
    .map_err(Error::database)?;

    let email = password_auth_info.email.clone();
    let verification_code = password_auth_info
        .verification_code
        .expect("to have verification code for new user");
    data.notifications
        .send_verification_code_borrower(&user, verification_code.as_str())
        .await;

    db_tx.commit().await.map_err(Error::database)?;

    // needs to be after the tx as the user needs to exist in the database.
    if let Err(err) =
        db::borrowers_referral_code::create_referral_code(&data.db, None, user.id.as_str()).await
    {
        tracing::error!(
            user_id = user.id,
            "Failed inserting referral code for new user {err}"
        );
    }

    Ok(AppJson(RegistrationResponse {
        message: format!("We sent an email with a verification code to {email}"),
    }))
}

/// Initiate PAKE authentication login.
#[utoipa::path(
    post,
    path = "/pake-login",
    tag = AUTH_TAG,
    request_body = PakeLoginRequest,
    responses(
        (
            status = 200,
            description = "PAKE login challenge response",
            body = PakeLoginResponse
        ),
        (
            status = 400,
            description = "Invalid email, email not verified"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_pake_login(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<PakeLoginRequest>,
) -> Result<AppJson<PakeLoginResponse>, Error> {
    let email = body.email;
    let (user, password_auth_info) = get_user_by_email(&data.db, email.as_str())
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let borrower_id = user.id;
    tracing::Span::current().record("borrower_id", &borrower_id);

    if !password_auth_info.verified {
        return Err(Error::EmailNotVerified);
    }

    // The presence of a password hash indicates that the user has not upgraded to PAKE yet.
    // We removed the upgrade path as all contracts have been upgraded
    if password_auth_info.password.is_some() {
        tracing::error!(email = email.as_str(), "User never upgraded to pake.");
        return Err(Error::PrePakeUser);
    }

    let verifier = hex::decode(password_auth_info.verifier).map_err(Error::InvalidVerifier)?;

    let server = SrpServer::<Sha256>::new(&G_2048);

    let mut b = [0u8; 64];

    {
        let mut rng = thread_rng();
        rng.fill_bytes(&mut b)
    };

    let b_pub = server.compute_public_ephemeral(&b, &verifier);

    let b_pub = hex::encode(b_pub);

    let mut pake_protocols = data.pake_protocols.lock().await;

    // We overwrite any PAKE data from a previous login attempt.
    pake_protocols.insert(email, PakeServerData { b: b.to_vec() });

    Ok(AppJson(PakeLoginResponse {
        b_pub,
        salt: password_auth_info.salt,
    }))
}

/// Complete PAKE authentication verification.
#[utoipa::path(
    post,
    path = "/pake-verify",
    tag = AUTH_TAG,
    request_body = PakeVerifyResult,
    responses(
        (
            status = 200,
            description = "PAKE verification successful, may require TOTP",
            body = PakeVerifyTotpResponse
        ),
        (
            status = 400,
            description = "Invalid credentials or authentication failed"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_pake_verify(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<PakeVerifyRequest>,
) -> Result<impl IntoResponse, Error> {
    post_pake_verify_totp_check(
        data,
        connection_details,
        body,
        BROWSER_JWT_EXPIRY_HOURS,
        BROWSER_COOKIE_EXPIRY_HOURS,
    )
    .await
}

/// Complete PAKE authentication verification, for mobile clients.
#[utoipa::path(
    post,
    path = "/totp-verify-login-mobile",
    tag = AUTH_TAG,
    request_body = TotpLoginVerifyRequest,
    responses(
        (
            status = 200,
            description = "PAKE verification successful, user authenticated",
            body = PakeVerifyResponse
        ),
        (
            status = 400,
            description = "Invalid credentials or authentication failed"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_totp_verify_mobile(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<TotpLoginVerifyRequest>,
) -> Result<impl IntoResponse, Error> {
    // Decode and validate the temporary session token
    let claims = decode::<TokenClaims>(
        &body.session_token,
        &DecodingKey::from_secret(data.config.jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(Error::AuthSessionDecode)?
    .claims;

    // Check if this is a TOTP pending token
    let borrower_id = match crate::totp::stripped_user_id(claims.user_id.as_str()) {
        Some(id) => id,
        None => return Err(Error::InvalidTotpSession),
    };

    // Get user and verify TOTP
    let user = get_user_by_id(&data.db, borrower_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    tracing::Span::current().record("borrower_id", borrower_id);

    // Get TOTP secret and verify code
    let totp_secret = db::borrowers::get_totp_secret_for_setup(&data.db, borrower_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let secret = Secret::Encoded(totp_secret);
    let totp = create_totp_borrower(
        secret,
        user.email.clone().unwrap_or_else(|| user.name.clone()),
    )
    .map_err(|_| Error::InvalidTotpCode)?;

    if !totp
        .check_current(&body.totp_code)
        .map_err(|_| Error::EmailOrPasswordInvalid)?
    {
        return Err(Error::InvalidTotpCode);
    }

    // TOTP verified, create real session
    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + BROWSER_JWT_EXPIRY_HOURS).unix_timestamp();
    let claims: TokenClaims = TokenClaims {
        user_id: borrower_id.to_string(),
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
        .max_age(BROWSER_COOKIE_EXPIRY_HOURS)
        .same_site(SameSite::Lax)
        .http_only(true);

    let features = db::borrower_features::load_borrower_features(&data.db, borrower_id.to_string())
        .await
        .map_err(Error::database)?;

    let features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(BorrowerLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                    description: f.description.clone(),
                    is_enabled: f.is_enabled,
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if features.is_empty() {
        return Err(Error::NoFeaturesEnabled {
            borrower_id: borrower_id.to_string(),
        });
    }

    let personal_telegram_token =
        db::telegram_bot::borrower::get_or_create_token_by_borrower_id(&data.db, borrower_id)
            .await
            .map_err(Error::database)?;

    let filtered_user =
        FilteredUser::new_user(&user, personal_telegram_token, true, user.email.clone());

    let wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(Error::database)?;

    let wallet_backup_data = WalletBackupData {
        mnemonic_ciphertext: wallet_backup.mnemonic_ciphertext,
        network: wallet_backup.network,
    };

    // Log login activity
    let user_agent = connection_details
        .user_agent
        .unwrap_or("unknown".to_string());
    let ip_address = connection_details.ip.unwrap_or("unknown".to_string());

    let location = geo_location::get_geo_info(ip_address.as_str()).await.ok();

    if let Err(err) = db::user_logins::insert_borrower_login_activity(
        &data.db,
        borrower_id,
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
            borrower_id = borrower_id,
            "Failed to track login activity {err:#}"
        )
    }

    data.notifications
        .send_login_information_borrower(
            user,
            ip_address.as_str(),
            OffsetDateTime::now_utc(),
            location.map(|l| l.to_string()),
            user_agent.as_str(),
        )
        .await;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::SET_COOKIE.as_str(), cookie.to_string().as_str())
        .header(header::CONTENT_TYPE.as_str(), "application/json")
        .body(
            json!(PakeVerifyResponse {
                server_proof: "totp_verified".to_string(), // Not used in TOTP flow
                token,
                enabled_features: features,
                user: filtered_user,
                wallet_backup_data
            })
            .to_string(),
        )
        .context("TotpVerifyLoginResponse")
        .map_err(Error::BuildResponse)?;

    Ok(response)
}

/// Complete PAKE authentication verification, for mobile clients.
#[utoipa::path(
    post,
    path = "/pake-verify-mobile",
    tag = AUTH_TAG,
    request_body = PakeVerifyRequest,
    responses(
        (
            status = 200,
            description = "PAKE verification successful, user authenticated",
            body = PakeVerifyResult
        ),
        (
            status = 400,
            description = "Invalid credentials or authentication failed"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_pake_verify_mobile(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<PakeVerifyRequest>,
) -> Result<impl IntoResponse, Error> {
    post_pake_verify_totp_check(
        data,
        connection_details,
        body,
        MOBILE_JWT_EXPIRY_HOURS,
        MOBILE_COOKIE_EXPIRY_HOURS,
    )
    .await
}

#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_pake_verify_totp_check(
    data: Arc<AppState>,
    connection_details: UserConnectionDetails,
    body: PakeVerifyRequest,
    jwt_expiry_hours: time::Duration,
    cookie_expiry_hours: time::Duration,
) -> Result<impl IntoResponse, Error> {
    let email = body.email;
    let (user, password_auth_info) = get_user_by_email(&data.db, email.as_str())
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let borrower_id = &user.id;

    if !password_auth_info.verified {
        return Err(Error::EmailNotVerified);
    }

    let verifier = hex::decode(&password_auth_info.verifier).map_err(Error::InvalidVerifier)?;
    let a_pub = hex::decode(body.a_pub.clone()).map_err(Error::InvalidAPub)?;
    let client_proof = hex::decode(body.client_proof.clone()).map_err(Error::InvalidClientProof)?;

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

    // Check if user has TOTP enabled
    let totp_secret = db::borrowers::get_totp_secret(&data.db, borrower_id)
        .await
        .map_err(Error::database)?;

    let result = if totp_secret.is_some() {
        // User has TOTP enabled, create temporary session token
        let now = OffsetDateTime::now_utc();
        let iat = now.unix_timestamp();
        let exp = (now + time::Duration::minutes(5)).unix_timestamp(); // 5 minute expiry for TOTP verification

        // We add a special prefix for pending TOTP logins. This way we know that this token is not
        // yet valid.
        let claims: TokenClaims = TokenClaims {
            user_id: format!("{TOTP_TMP_ID_PREFIX}{borrower_id}",),
            exp,
            iat,
        };

        let session_token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(data.config.jwt_secret.as_ref()),
        )
        .map_err(Error::AuthSessionDecode)?;

        PakeVerifyResult::TotpRequired(PakeVerifyTotpResponse {
            server_proof,
            totp_required: true,
            session_token: Some(session_token),
        })
    } else {
        // User doesn't have TOTP, proceed with normal login
        // Reconstruct the original PakeVerifyRequest
        let original_body = PakeVerifyRequest {
            email,
            a_pub: body.a_pub,
            client_proof: body.client_proof,
        };

        let auth_result = post_pake_verify_aux(
            data,
            connection_details,
            original_body,
            jwt_expiry_hours,
            cookie_expiry_hours,
        )
        .await?;

        PakeVerifyResult::Authenticated(Box::new(PakeVerifyWithCookie {
            response: auth_result.response,
            cookie: auth_result.cookie,
        }))
    };

    // Build the response based on the result type
    let response = match result {
        PakeVerifyResult::TotpRequired(totp_response) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE.as_str(), "application/json")
            .body(json!(totp_response).to_string())
            .context("PakeVerifyTotpResponse")
            .map_err(Error::BuildResponse)?,
        PakeVerifyResult::Authenticated(auth) => Response::builder()
            .status(StatusCode::OK)
            .header(header::SET_COOKIE.as_str(), auth.cookie.as_str())
            .header(header::CONTENT_TYPE.as_str(), "application/json")
            .body(json!(auth.response).to_string())
            .context("PakeVerifyResponse")
            .map_err(Error::BuildResponse)?,
    };

    Ok(response)
}

async fn post_pake_verify_aux(
    data: Arc<AppState>,
    connection_details: UserConnectionDetails,
    body: PakeVerifyRequest,
    jwt_expiry_hours: time::Duration,
    cookie_expiry_hours: time::Duration,
) -> Result<AuthAux, Error> {
    let email = body.email;
    let (user, password_auth_info) = get_user_by_email(&data.db, email.as_str())
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let borrower_id = &user.id;
    tracing::Span::current().record("borrower_id", borrower_id);

    if !password_auth_info.verified {
        return Err(Error::EmailNotVerified);
    }

    let verifier = hex::decode(&password_auth_info.verifier).map_err(Error::InvalidVerifier)?;

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
    let exp = (now + jwt_expiry_hours).unix_timestamp();
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
        .max_age(cookie_expiry_hours)
        .same_site(SameSite::Lax)
        .http_only(true);

    let features = db::borrower_features::load_borrower_features(&data.db, borrower_id.clone())
        .await
        .map_err(Error::database)?;

    let features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(BorrowerLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                    description: f.description.clone(),
                    is_enabled: f.is_enabled,
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

    let personal_telegram_token =
        db::telegram_bot::borrower::get_or_create_token_by_borrower_id(&data.db, user.id.as_str())
            .await
            .map_err(Error::database)?;

    let filtered_user = FilteredUser::new_user(
        &user,
        personal_telegram_token,
        password_auth_info.verified,
        Some(password_auth_info.email),
    );

    let wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(Error::database)?;

    let wallet_backup_data = WalletBackupData {
        mnemonic_ciphertext: wallet_backup.mnemonic_ciphertext,
        network: wallet_backup.network,
    };

    let user_agent = connection_details
        .user_agent
        .unwrap_or("unknown".to_string());
    let ip_address = connection_details.ip.unwrap_or("unknown".to_string());
    tracing::debug!(
        borrower_id = user.id.to_string(),
        ip_address,
        ?user_agent,
        "Borrower logged in"
    );

    let location = geo_location::get_geo_info(ip_address.as_str()).await.ok();

    if let Err(err) = db::user_logins::insert_borrower_login_activity(
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
        .send_login_information_borrower(
            user,
            ip_address.as_str(),
            OffsetDateTime::now_utc(),
            location.map(|l| l.to_string()),
            user_agent.as_str(),
        )
        .await;

    Ok(AuthAux {
        response: PakeVerifyResponse {
            server_proof,
            token,
            enabled_features: features,
            user: filtered_user,
            wallet_backup_data,
        },
        cookie: cookie.to_string(),
    })
}

struct AuthAux {
    response: PakeVerifyResponse,
    cookie: String,
}

/// Complete TOTP verification for login
#[utoipa::path(
    post,
    path = "/totp-verify-login",
    tag = AUTH_TAG,
    request_body = TotpLoginVerifyRequest,
    responses(
        (
            status = 200,
            description = "TOTP verification successful, user authenticated",
            body = PakeVerifyResponse
        ),
        (
            status = 400,
            description = "Invalid TOTP code or session token"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_totp_verify_login(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<TotpLoginVerifyRequest>,
) -> Result<impl IntoResponse, Error> {
    // Decode and validate the temporary session token
    let claims = decode::<TokenClaims>(
        &body.session_token,
        &DecodingKey::from_secret(data.config.jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(Error::AuthSessionDecode)?
    .claims;

    // Check if this is a TOTP pending token
    let borrower_id = match crate::totp::stripped_user_id(claims.user_id.as_str()) {
        Some(id) => id,
        None => return Err(Error::InvalidTotpSession),
    };

    // Get user and verify TOTP
    let user = get_user_by_id(&data.db, borrower_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    tracing::Span::current().record("borrower_id", borrower_id);

    // Get TOTP secret and verify code
    let totp_secret = db::borrowers::get_totp_secret_for_setup(&data.db, borrower_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let secret = Secret::Encoded(totp_secret);
    let totp = create_totp_borrower(
        secret,
        user.email.clone().unwrap_or_else(|| user.name.clone()),
    )
    .map_err(|_| Error::InvalidTotpCode)?;

    if !totp
        .check_current(&body.totp_code)
        .map_err(|_| Error::EmailOrPasswordInvalid)?
    {
        return Err(Error::InvalidTotpCode);
    }

    // TOTP verified, create real session
    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + BROWSER_JWT_EXPIRY_HOURS).unix_timestamp();
    let claims: TokenClaims = TokenClaims {
        user_id: borrower_id.to_string(),
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
        .max_age(BROWSER_COOKIE_EXPIRY_HOURS)
        .same_site(SameSite::Lax)
        .http_only(true);

    let features = db::borrower_features::load_borrower_features(&data.db, borrower_id.to_string())
        .await
        .map_err(Error::database)?;

    let features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(BorrowerLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                    description: f.description.clone(),
                    is_enabled: f.is_enabled,
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    if features.is_empty() {
        return Err(Error::NoFeaturesEnabled {
            borrower_id: borrower_id.to_string(),
        });
    }

    let personal_telegram_token =
        db::telegram_bot::borrower::get_or_create_token_by_borrower_id(&data.db, borrower_id)
            .await
            .map_err(Error::database)?;

    let filtered_user =
        FilteredUser::new_user(&user, personal_telegram_token, true, user.email.clone());

    let wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(Error::database)?;

    let wallet_backup_data = WalletBackupData {
        mnemonic_ciphertext: wallet_backup.mnemonic_ciphertext,
        network: wallet_backup.network,
    };

    // Log login activity
    let user_agent = connection_details
        .user_agent
        .unwrap_or("unknown".to_string());
    let ip_address = connection_details.ip.unwrap_or("unknown".to_string());

    let location = geo_location::get_geo_info(ip_address.as_str()).await.ok();

    if let Err(err) = db::user_logins::insert_borrower_login_activity(
        &data.db,
        borrower_id,
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
            borrower_id = borrower_id,
            "Failed to track login activity {err:#}"
        )
    }

    data.notifications
        .send_login_information_borrower(
            user,
            ip_address.as_str(),
            OffsetDateTime::now_utc(),
            location.map(|l| l.to_string()),
            user_agent.as_str(),
        )
        .await;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::SET_COOKIE.as_str(), cookie.to_string().as_str())
        .header(header::CONTENT_TYPE.as_str(), "application/json")
        .body(
            json!(PakeVerifyResponse {
                server_proof: "totp_verified".to_string(), // Not used in TOTP flow
                token,
                enabled_features: features,
                user: filtered_user,
                wallet_backup_data
            })
            .to_string(),
        )
        .context("TotpVerifyLoginResponse")
        .map_err(Error::BuildResponse)?;

    Ok(response)
}

/// Verify user email with verification code.
#[utoipa::path(
    get,
    path = "/verifyemail/{verification_code}",
    tag = AUTH_TAG,
    params(
        ("verification_code" = String, Path, description = "Email verification code")
    ),
    responses(
        (
            status = 200,
            description = "Email verified successfully"
        ),
        (
            status = 400,
            description = "Invalid verification code or user already verified"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug, level = Level::DEBUG))]
async fn verify_email_handler(
    State(data): State<Arc<AppState>>,
    Path(verification_code): Path<String>,
) -> Result<impl IntoResponse, Error> {
    let password_auth_info =
        get_password_auth_info_by_verification_code(&data.db, verification_code.as_str())
            .await
            .map_err(Error::database)?
            .ok_or(Error::InvalidVerificationCode)?;

    let borrower_id = &password_auth_info.borrower_id;
    tracing::Span::current().record("borrower_id", borrower_id);

    if password_auth_info.verified {
        return Err(Error::AlreadyVerified);
    }

    verify_user(&data.db, verification_code.as_str())
        .await
        .map_err(Error::database)?;

    let response = serde_json::json!({
            "message": "Email verified successfully"
        }
    );

    Ok(Json(response))
}

/// Request password reset for user account.
#[utoipa::path(
    post,
    path = "/forgotpassword",
    tag = AUTH_TAG,
    request_body = ForgotPasswordSchema,
    responses(
        (
            status = 200,
            description = "Password reset email sent successfully"
        ),
        (
            status = 400,
            description = "Invalid email, user not found, or account not verified"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug, level = Level::DEBUG))]
async fn forgot_password_handler(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<ForgotPasswordSchema>,
) -> Result<(), Error> {
    let (user, password_auth_info) = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(Error::database)?
        .ok_or(Error::NoUserWithEmail)?;

    let borrower_id = &user.id;
    tracing::Span::current().record("borrower_id", borrower_id);

    if !password_auth_info.verified {
        return Err(Error::AccountNotVerified);
    }

    // This can be done by calling another API directly, but not through this one.
    if password_auth_info.password.is_some() {
        return Err(Error::PasswordChangeBeforePake);
    }

    let password_reset_token = generate_random_string(PASSWORD_RESET_TOKEN_LENGTH);
    let password_reset_at =
        OffsetDateTime::now_utc() + time::Duration::minutes(PASSWORD_TOKEN_EXPIRES_IN_MINUTES);

    let has_contracts_before_pake =
        db::contracts::has_contracts_before_pake_borrower(&data.db, borrower_id)
            .await
            .map_err(Error::database)?;

    data.notifications
        .send_password_reset_token_borrower(
            &user,
            &password_reset_token,
            PASSWORD_TOKEN_EXPIRES_IN_MINUTES,
            has_contracts_before_pake,
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
    .map_err(Error::database)?;

    Ok(())
}

/// Reset user password with reset token.
#[utoipa::path(
    put,
    path = "/resetpassword/{password_reset_token}",
    tag = AUTH_TAG,
    params(
        ("password_reset_token" = String, Path, description = "Password reset token")
    ),
    request_body = ResetPasswordSchema,
    responses(
        (
            status = 200,
            description = "Password reset successfully"
        ),
        (
            status = 400,
            description = "Invalid reset token or token expired"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn reset_password_handler(
    State(data): State<Arc<AppState>>,
    Path(password_reset_token): Path<String>,
    AppJson(body): AppJson<ResetPasswordSchema>,
) -> Result<impl IntoResponse, Error> {
    let password_auth_info =
        get_password_auth_info_by_reset_token(&data.db, password_reset_token.as_str())
            .await
            .map_err(Error::database)?
            .ok_or(Error::InvalidResetToken)?;

    let borrower_id = &password_auth_info.borrower_id;
    tracing::Span::current().record("borrower_id", borrower_id);

    let mut db_tx = data.db.begin().await.map_err(Error::database)?;

    db::wallet_backups::insert_borrower_backup(
        &mut *db_tx,
        NewBorrowerWalletBackup {
            borrower_id: borrower_id.clone(),
            mnemonic_ciphertext: body.new_wallet_backup_data.mnemonic_ciphertext,
            network: body.new_wallet_backup_data.network,
        },
    )
    .await
    .map_err(Error::database)?;

    db::borrowers::update_verifier_and_salt(
        &mut *db_tx,
        password_auth_info.email.as_str(),
        body.salt.as_str(),
        body.verifier.as_str(),
    )
    .await
    .map_err(Error::database)?;

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
        cookie
            .to_string()
            .parse()
            .map_err(|error| Error::CookieParsing(format!("{error}")))?,
    );

    db_tx.commit().await.map_err(Error::database)?;

    Ok(response)
}

/// Reset legacy password with reset token.
#[utoipa::path(
    put,
    path = "/reset-legacy-password/{password_reset_token}",
    tag = AUTH_TAG,
    params(
        ("password_reset_token" = String, Path, description = "Password reset token")
    ),
    request_body = ResetLegacyPasswordSchema,
    responses(
        (
            status = 200,
            description = "Legacy password reset successfully"
        ),
        (
            status = 400,
            description = "Invalid reset token or no legacy password to reset"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn reset_legacy_password_handler(
    State(data): State<Arc<AppState>>,
    Path(password_reset_token): Path<String>,
    AppJson(body): AppJson<ResetLegacyPasswordSchema>,
) -> Result<(), Error> {
    let password_auth_info =
        get_password_auth_info_by_reset_token(&data.db, password_reset_token.as_str())
            .await
            .map_err(Error::database)?
            .ok_or(Error::InvalidVerificationCode)?;

    let borrower_id = &password_auth_info.borrower_id;
    tracing::Span::current().record("borrower_id", borrower_id);

    if password_auth_info.password.is_none() {
        return Err(Error::NoLegacyResetAfterPake);
    }

    db::borrowers::update_legacy_password(&data.db, borrower_id, &body.password)
        .await
        .map_err(Error::database)?;

    Ok(())
}

/// Logout user and clear authentication cookie.
#[utoipa::path(
    get,
    path = "/logout",
    tag = AUTH_TAG,
    responses(
        (
            status = 200,
            description = "Successfully logged out"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn logout_handler() -> Result<impl IntoResponse, Error> {
    let cookie = Cookie::build(("token", ""))
        .path("/")
        .max_age(time::Duration::hours(-1))
        .same_site(SameSite::Lax)
        .http_only(true);

    let mut response = Response::new(json!({"message": "Successfully logged out"}).to_string());
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie
            .to_string()
            .parse()
            .map_err(|error| Error::CookieParsing(format!("{error}")))?,
    );
    Ok(response)
}

/// Check if user is authenticated.
#[utoipa::path(
    get,
    path = "/check",
    tag = AUTH_TAG,
    responses(
        (
            status = 200,
            description = "User is authenticated"
        ),
        (
            status = 401,
            description = "User is not authenticated"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn check_auth_handler(Extension(_user): Extension<Borrower>) -> Result<(), Error> {
    Ok(())
}

/// Add user to the waitlist.
#[utoipa::path(
    post,
    path = "/waitlist",
    tag = AUTH_TAG,
    request_body = WaitlistBody,
    responses(
        (
            status = 200,
            description = "Successfully added to waitlist"
        ),
        (
            status = 409,
            description = "Email already in waitlist"
        )
    )
)]
#[instrument(skip_all, err(Debug))]
async fn post_add_to_waitlist(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<WaitlistBody>,
) -> Result<impl IntoResponse, Error> {
    db::waitlist::insert_into_waitlist(&data.db, body.email.as_str(), WaitlistRole::Borrower)
        .await
        .map_err(Error::from)?;

    Ok(Json(()))
}

/// Request a challenge for pubkey authentication.
#[utoipa::path(
    post,
    path = "/pubkey-challenge",
    tag = AUTH_TAG,
    request_body = PubkeyChallengeRequest,
    responses(
        (
            status = 200,
            description = "Challenge generated successfully",
            body = PubkeyChallengeResponse
        ),
        (
            status = 400,
            description = "Invalid public key format"
        )
    )
)]
#[instrument(skip_all, err(Debug))]
async fn post_pubkey_challenge(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<PubkeyChallengeRequest>,
) -> Result<AppJson<PubkeyChallengeResponse>, Error> {
    // Validate pubkey format
    let _pubkey = Secp256k1PublicKey::from_str(&body.pubkey).map_err(|_| Error::InvalidPubkey)?;

    // Generate random challenge
    let challenge = generate_random_string(CHALLENGE_LENGTH);

    let mut pubkey_challenges = data.pubkey_challenges.lock().await;
    pubkey_challenges.insert(
        body.pubkey.clone(),
        PubkeyChallengeData {
            challenge: challenge.clone(),
            created_at: OffsetDateTime::now_utc(),
        },
    );

    Ok(AppJson(PubkeyChallengeResponse { challenge }))
}

/// Register a new user with pubkey authentication.
#[utoipa::path(
    post,
    path = "/pubkey-register",
    tag = AUTH_TAG,
    request_body = RegisterPubkeyUserSchema,
    responses(
        (
            status = 200,
            description = "User registered successfully",
            body = RegisterPubkeyResponse
        ),
        (
            status = 400,
            description = "Invalid email or pubkey"
        ),
        (
            status = 409,
            description = "Email or pubkey already registered"
        )
    )
)]
#[instrument(skip_all, err(Debug))]
async fn post_pubkey_register(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<RegisterPubkeyUserSchema>,
) -> Result<AppJson<RegisterPubkeyResponse>, Error> {
    // Validate email
    if !is_valid_email(&body.email) {
        return Err(Error::InvalidEmail);
    }

    // Validate pubkey format
    let _pubkey = Secp256k1PublicKey::from_str(&body.pubkey).map_err(|_| Error::InvalidPubkey)?;

    // Check if email already exists across all auth methods
    let email_exists = db::borrowers_pubkey_auth::email_exists_anywhere(&data.db, &body.email)
        .await
        .map_err(Error::database)?;

    if email_exists {
        return Err(Error::UserExists);
    }

    // Check if pubkey already exists
    let pubkey_exists = db::borrowers_pubkey_auth::pubkey_exists(&data.db, &body.pubkey)
        .await
        .map_err(Error::database)?;

    if pubkey_exists {
        return Err(Error::PubkeyExists);
    }

    // Check referral code if provided
    let referral_code_valid = match &body.invite_code {
        None => {
            if data.config.borrower_invite_code_required {
                return Err(Error::InviteCodeRequired);
            } else {
                true
            }
        }
        Some(code) => db::borrowers_referral_code::is_referral_code_valid(&data.db, code.as_str())
            .await
            .map_err(Error::database)?,
    };

    if !referral_code_valid {
        return Err(Error::InvalidReferralCode {
            referral_code: body.invite_code.unwrap_or_default(),
        });
    }

    let mut db_tx = data.db.begin().await.map_err(Error::database)?;

    // Create borrower entry
    let borrower = db::borrowers::register_pubkey_auth_user(&mut db_tx, &body.name, &body.email)
        .await
        .map_err(Error::database)?;

    let borrower_id = &borrower.id;

    // Insert pubkey auth
    db::borrowers_pubkey_auth::insert_pubkey_auth(
        &mut db_tx,
        borrower_id,
        &body.pubkey,
        &body.email,
    )
    .await
    .map_err(Error::database)?;

    // Handle referral code
    if let Some(referral_code) = body.invite_code {
        db::borrowers_referral_code::insert_referred_borrower(
            &mut *db_tx,
            referral_code.as_str(),
            borrower_id.as_str(),
        )
        .await
        .map_err(Error::database)?;
    }

    db_tx.commit().await.map_err(Error::database)?;

    // Create referral code for new user
    if let Err(err) =
        db::borrowers_referral_code::create_referral_code(&data.db, None, borrower_id.as_str())
            .await
    {
        tracing::error!(
            user_id = borrower_id,
            "Failed inserting referral code for new user {err}"
        );
    }

    Ok(AppJson(RegisterPubkeyResponse {
        user_id: borrower.id,
    }))
}

/// Verify pubkey signature and authenticate user.
#[utoipa::path(
    post,
    path = "/pubkey-verify",
    tag = AUTH_TAG,
    request_body = PubkeyVerifyRequest,
    responses(
        (
            status = 200,
            description = "Authentication successful",
            body = PubkeyVerifyResponse
        ),
        (
            status = 400,
            description = "Invalid signature or challenge"
        ),
        (
            status = 401,
            description = "Authentication failed"
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn post_pubkey_verify(
    State(data): State<Arc<AppState>>,
    Extension(connection_details): Extension<UserConnectionDetails>,
    AppJson(body): AppJson<PubkeyVerifyRequest>,
) -> Result<impl IntoResponse, Error> {
    // Get the stored challenge
    let challenge_data = {
        let mut pubkey_challenges = data.pubkey_challenges.lock().await;
        let challenge_data = pubkey_challenges
            .remove(&body.pubkey)
            .ok_or(Error::NoChallengeFound)?;

        // Check if challenge has expired
        let now = OffsetDateTime::now_utc();
        let expiry_time =
            challenge_data.created_at + time::Duration::minutes(CHALLENGE_EXPIRY_MINUTES);
        if now > expiry_time {
            return Err(Error::ChallengeExpired);
        }

        challenge_data
    };

    // Verify that the provided challenge matches
    if challenge_data.challenge != body.challenge {
        return Err(Error::InvalidChallenge);
    }

    // Parse pubkey
    let pubkey = Secp256k1PublicKey::from_str(&body.pubkey).map_err(|_| Error::InvalidPubkey)?;

    // Parse signature
    let signature = Signature::from_str(&body.signature).map_err(|_| Error::InvalidSignature)?;

    // Create message hash from challenge
    let message =
        Secp256k1Message::from_digest_slice(Sha256::digest(body.challenge.as_bytes()).as_slice())
            .map_err(|_| Error::InvalidChallenge)?;

    // Verify signature
    let secp = Secp256k1::verification_only();
    secp.verify_ecdsa(&message, &signature, &pubkey)
        .map_err(|_| Error::SignatureVerificationFailed)?;

    // Get user from database
    let pubkey_auth = db::borrowers_pubkey_auth::get_by_pubkey(&data.db, &body.pubkey)
        .await
        .map_err(Error::database)?
        .ok_or(Error::PubkeyNotRegistered)?;

    let user = get_user_by_id(&data.db, &pubkey_auth.borrower_id)
        .await
        .map_err(Error::database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let borrower_id = &user.id;
    tracing::Span::current().record("borrower_id", borrower_id);

    // Create JWT token
    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + BROWSER_JWT_EXPIRY_HOURS).unix_timestamp();
    let claims = TokenClaims {
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
        .max_age(BROWSER_COOKIE_EXPIRY_HOURS)
        .same_site(SameSite::Lax)
        .http_only(true);

    // Load features
    let features = db::borrower_features::load_borrower_features(&data.db, borrower_id.clone())
        .await
        .map_err(Error::database)?;

    let features = features
        .iter()
        .filter_map(|f| {
            if f.is_enabled {
                Some(BorrowerLoanFeature {
                    id: f.id.clone(),
                    name: f.name.clone(),
                    description: f.description.clone(),
                    is_enabled: f.is_enabled,
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

    let personal_telegram_token =
        db::telegram_bot::borrower::get_or_create_token_by_borrower_id(&data.db, borrower_id)
            .await
            .map_err(Error::database)?;

    let filtered_user = FilteredUser::new_user(
        &user,
        personal_telegram_token,
        pubkey_auth.verified,
        Some(pubkey_auth.email),
    );

    // Log login activity
    let user_agent = connection_details
        .user_agent
        .unwrap_or("unknown".to_string());
    let ip_address = connection_details.ip.unwrap_or("unknown".to_string());

    let location = geo_location::get_geo_info(ip_address.as_str()).await.ok();

    if let Err(err) = db::user_logins::insert_borrower_login_activity(
        &data.db,
        borrower_id,
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
            borrower_id = borrower_id,
            "Failed to track login activity {err:#}"
        )
    }

    data.notifications
        .send_login_information_borrower(
            user,
            ip_address.as_str(),
            OffsetDateTime::now_utc(),
            location.map(|l| l.to_string()),
            user_agent.as_str(),
        )
        .await;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::SET_COOKIE.as_str(), cookie.to_string().as_str())
        .header(header::CONTENT_TYPE.as_str(), "application/json")
        .body(
            json!(PubkeyVerifyResponse {
                token,
                enabled_features: features,
                user: filtered_user,
            })
            .to_string(),
        )
        .context("PubkeyVerifyResponse")
        .map_err(Error::BuildResponse)?;

    Ok(response)
}

/// Refresh user authentication token.
#[utoipa::path(
    post,
    path = "/refresh-token",
    tag = AUTH_TAG,
    responses(
        (
            status = 200,
            description = "Token refreshed successfully"
        ),
        (
            status = 401,
            description = "Invalid or expired token"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn refresh_token_handler(
    State(data): State<Arc<AppState>>,
    Extension(user_auth): Extension<(Borrower, PasswordAuth)>,
) -> Result<impl IntoResponse, Error> {
    refresh_token_handler_aux(
        data,
        user_auth,
        BROWSER_COOKIE_EXPIRY_HOURS,
        BROWSER_JWT_EXPIRY_HOURS,
    )
    .await
}

/// Refresh user authentication token, for mobile clients.
#[utoipa::path(
    post,
    path = "/refresh-token-mobile",
    tag = AUTH_TAG,
    responses(
        (
            status = 200,
            description = "Token refreshed successfully"
        ),
        (
            status = 401,
            description = "Invalid or expired token"
        )
    ),
    security(
        (
            "api_key" = []
        )
    )
)]
#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn refresh_token_handler_mobile(
    State(data): State<Arc<AppState>>,
    Extension(user_auth): Extension<(Borrower, PasswordAuth)>,
) -> Result<impl IntoResponse, Error> {
    refresh_token_handler_aux(
        data,
        user_auth,
        MOBILE_COOKIE_EXPIRY_HOURS,
        MOBILE_JWT_EXPIRY_HOURS,
    )
    .await
}

async fn refresh_token_handler_aux(
    data: Arc<AppState>,
    user_auth: (Borrower, PasswordAuth),
    jwt_expiry_hours: time::Duration,
    cookie_expiry_hours: time::Duration,
) -> Result<impl IntoResponse, Error> {
    let user = user_auth.0;
    let now = OffsetDateTime::now_utc();
    let iat = now.unix_timestamp();
    let exp = (now + jwt_expiry_hours).unix_timestamp();
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
    .map_err(|error| Error::TokenCreation(format!("{error}")))?;

    let cookie = Cookie::build(("token", token.to_owned()))
        .path("/")
        .max_age(cookie_expiry_hours)
        .same_site(SameSite::Lax)
        .http_only(true);

    let mut response =
        Response::new(json!({"message": "Token refreshed successfully"}).to_string());
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie
            .to_string()
            .parse()
            .map_err(|error| Error::CookieParsing(format!("{error}")))?,
    );

    Ok(response)
}

#[derive(Deserialize, ToSchema)]
struct IsRegisteredParams {
    email: String,
}

#[derive(Serialize, ToSchema)]
struct IsRegisteredResponse {
    is_registered: bool,
    is_verified: bool,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct RegistrationResponse {
    message: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct PakeVerifyResponse {
    server_proof: String,
    token: String,
    enabled_features: Vec<BorrowerLoanFeature>,
    user: FilteredUser,
    wallet_backup_data: WalletBackupData,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct PakeVerifyTotpResponse {
    server_proof: String,
    totp_required: bool,
    session_token: Option<String>, // Temporary token for TOTP verification
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(untagged)]
enum PakeVerifyResult {
    #[schema(title = "TotpRequired")]
    TotpRequired(PakeVerifyTotpResponse),
    #[schema(title = "Authenticated")]
    Authenticated(Box<PakeVerifyWithCookie>),
}

#[derive(Debug, Serialize, ToSchema)]
struct PakeVerifyWithCookie {
    #[serde(flatten)]
    response: PakeVerifyResponse,
    #[serde(skip)]
    cookie: String,
}

#[derive(Debug, Deserialize, ToSchema)]
struct TotpLoginVerifyRequest {
    session_token: String,
    totp_code: String,
}

#[derive(Debug, Deserialize, ToSchema)]
struct WaitlistBody {
    email: String,
}

/// Request body for pubkey challenge generation.
#[derive(Debug, Deserialize, ToSchema)]
struct PubkeyChallengeRequest {
    pubkey: String,
}

/// Response containing a challenge for the client to sign.
#[derive(Debug, Serialize, ToSchema)]
struct PubkeyChallengeResponse {
    challenge: String,
}

/// Request body for pubkey-based registration.
#[derive(Debug, Deserialize, ToSchema)]
struct RegisterPubkeyUserSchema {
    name: String,
    email: String,
    pubkey: String,
    #[serde(deserialize_with = "empty_string_is_none")]
    invite_code: Option<String>,
}

/// Response after successful pubkey registration.
#[derive(Debug, Serialize, ToSchema)]
struct RegisterPubkeyResponse {
    user_id: String,
}

/// Request body for pubkey-based authentication.
#[derive(Debug, Deserialize, ToSchema)]
struct PubkeyVerifyRequest {
    pubkey: String,
    challenge: String,
    signature: String,
}

/// Response after successful pubkey authentication.
#[derive(Debug, Serialize, ToSchema)]
struct PubkeyVerifyResponse {
    token: String,
    enabled_features: Vec<BorrowerLoanFeature>,
    user: FilteredUser,
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
    Database(#[allow(dead_code)] String),
    /// User with this email already exists.
    UserExists,
    /// User with this email does not exist.
    EmailOrPasswordInvalid,
    /// User with this email does not exist.
    InvalidTotpCode,
    /// No invite code provided.
    InviteCodeRequired,
    /// Invalid or expired referral code.
    InvalidReferralCode {
        #[allow(dead_code)]
        referral_code: String,
    },
    /// User did not verify their email.
    EmailNotVerified,
    /// The verification code provided does not exist.
    InvalidVerificationCode,
    /// User already verified.
    AlreadyVerified,
    /// User never upgraded to pake - we need them to reach out to us
    PrePakeUser,
    /// Failed to build a response.
    BuildResponse(#[allow(dead_code)] anyhow::Error),
    /// Could not decode the user's authentication session token.
    AuthSessionDecode(#[allow(dead_code)] jsonwebtoken::errors::Error),
    /// No features enabled for the user.
    NoFeaturesEnabled {
        #[allow(dead_code)]
        borrower_id: String,
    },
    /// Invalid PAKE verifier value coming from the client.
    InvalidVerifier(#[allow(dead_code)] hex::FromHexError),
    /// Invalid PAKE A value coming from the client.
    InvalidAPub(#[allow(dead_code)] hex::FromHexError),
    /// Invalid PAKE client proof.
    InvalidClientProof(#[allow(dead_code)] hex::FromHexError),
    /// Unexpected PAKE verify request.
    UnexpectedPakeVerify,
    /// Failed to process the client's PAKE verify request.
    PakeVerifyFailed(#[allow(dead_code)] srp::types::SrpAuthError),
    /// Cannot reset a legacy password after PAKE upgrade.
    NoLegacyResetAfterPake,
    /// User already in waiting list with this email.
    EmailExists,
    /// Invalid email
    InvalidEmail,
    /// No user with that email
    NoUserWithEmail,
    /// Account not verified
    AccountNotVerified,
    /// Password reset token not found or expired
    InvalidResetToken,
    /// Cannot change password before upgrading to PAKE
    PasswordChangeBeforePake,
    /// Failed parsing cookie
    CookieParsing(#[allow(dead_code)] String),
    /// Failed to create new token
    TokenCreation(#[allow(dead_code)] String),
    /// Invalid TOTP session token
    InvalidTotpSession,
    /// Invalid public key format
    InvalidPubkey,
    /// Public key already registered
    PubkeyExists,
    /// Public key not registered
    PubkeyNotRegistered,
    /// No challenge found for this public key
    NoChallengeFound,
    /// Challenge has expired
    ChallengeExpired,
    /// Challenge does not match
    InvalidChallenge,
    /// Invalid signature format
    InvalidSignature,
    /// Signature verification failed
    SignatureVerificationFailed,
}

impl Error {
    fn database(e: impl std::fmt::Display) -> Self {
        Self::Database(format!("{e:#}"))
    }
}

impl From<JsonRejection> for Error {
    fn from(rejection: JsonRejection) -> Self {
        Self::JsonRejection(rejection)
    }
}

impl From<db::waitlist::Error> for Error {
    fn from(value: db::waitlist::Error) -> Self {
        match value {
            db::waitlist::Error::EmailInUse(_) => Error::EmailExists,
            db::waitlist::Error::DatabaseError(e) => Error::database(e),
        }
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
            Error::Database(_)
            | Error::AuthSessionDecode(_)
            | Error::NoFeaturesEnabled { .. }
            | Error::InvalidVerifier(_)
            | Error::NoLegacyResetAfterPake
            | Error::CookieParsing(_)
            | Error::TokenCreation(_) => {
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
            Error::InvalidReferralCode { .. } => {
                (StatusCode::BAD_REQUEST, "Invalid referral code".to_owned())
            }
            Error::EmailOrPasswordInvalid => (
                StatusCode::BAD_REQUEST,
                "Invalid email or password".to_owned(),
            ),
            Error::InvalidTotpCode => (StatusCode::BAD_REQUEST, "Invalid onetime code".to_owned()),
            Error::BuildResponse(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Something went wrong.".to_owned(),
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
            Error::PrePakeUser => (
                StatusCode::UNAUTHORIZED,
                "Invalid email or password".to_owned(),
            ),
            Error::InvalidAPub(_) => (StatusCode::BAD_REQUEST, "Invalid credentials.".to_owned()),
            Error::InvalidClientProof(_) => {
                (StatusCode::BAD_REQUEST, "Invalid credentials.".to_owned())
            }
            Error::UnexpectedPakeVerify => {
                (StatusCode::BAD_REQUEST, "Invalid login attempt.".to_owned())
            }
            Error::PakeVerifyFailed(_) => {
                (StatusCode::BAD_REQUEST, "Invalid credentials.".to_owned())
            }
            Error::EmailExists => (StatusCode::CONFLICT, "Email already used".to_owned()),
            Error::InvalidEmail => (StatusCode::BAD_REQUEST, "Invalid email address".to_owned()),
            Error::NoUserWithEmail => (StatusCode::NOT_FOUND, "No user with that email".to_owned()),
            Error::AccountNotVerified => (StatusCode::FORBIDDEN, "Account not verified".to_owned()),
            Error::InvalidResetToken => (
                StatusCode::NOT_FOUND,
                "Password reset token not found or expired".to_owned(),
            ),
            Error::PasswordChangeBeforePake => (
                StatusCode::FORBIDDEN,
                "Cannot change password before upgrading to PAKE".to_owned(),
            ),
            Error::InvalidTotpSession => {
                (StatusCode::BAD_REQUEST, "Invalid credentials.".to_owned())
            }
            Error::InvalidPubkey => (
                StatusCode::BAD_REQUEST,
                "Invalid public key format".to_owned(),
            ),
            Error::PubkeyExists => (
                StatusCode::CONFLICT,
                "Public key already registered".to_owned(),
            ),
            Error::PubkeyNotRegistered => (
                StatusCode::UNAUTHORIZED,
                "Public key not registered".to_owned(),
            ),
            Error::NoChallengeFound => (
                StatusCode::BAD_REQUEST,
                "No challenge found. Please request a new challenge.".to_owned(),
            ),
            Error::ChallengeExpired => (
                StatusCode::BAD_REQUEST,
                "Challenge has expired. Please request a new challenge.".to_owned(),
            ),
            Error::InvalidChallenge => (
                StatusCode::BAD_REQUEST,
                "Invalid challenge provided".to_owned(),
            ),
            Error::InvalidSignature => (
                StatusCode::BAD_REQUEST,
                "Invalid signature format".to_owned(),
            ),
            Error::SignatureVerificationFailed => (
                StatusCode::UNAUTHORIZED,
                "Signature verification failed".to_owned(),
            ),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
