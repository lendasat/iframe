use crate::db;
use crate::db::borrowers::generate_random_string;
use crate::db::borrowers::get_password_auth_info_by_reset_token;
use crate::db::borrowers::get_password_auth_info_by_verification_code;
use crate::db::borrowers::get_user_by_email;
use crate::db::borrowers::register_password_auth_user;
use crate::db::borrowers::update_password_reset_token_for_user;
use crate::db::borrowers::user_exists;
use crate::db::borrowers::verify_user;
use crate::db::telegram_bot::TelegramBotToken;
use crate::db::waitlist::WaitlistRole;
use crate::db::wallet_backups::NewBorrowerWalletBackup;
use crate::geo_location;
use crate::model;
use crate::model::Borrower;
use crate::model::ContractStatus;
use crate::model::FinishUpgradeToPakeRequest;
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
use crate::model::UpgradeToPakeRequest;
use crate::model::UpgradeToPakeResponse;
use crate::model::WalletBackupData;
use crate::routes::borrower::AUTH_TAG;
use crate::routes::user_connection_details_middleware;
use crate::routes::user_connection_details_middleware::UserConnectionDetails;
use crate::routes::AppState;
use crate::utils::is_valid_email;
use anyhow::anyhow;
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
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub(crate) mod api_account_creator_auth;
pub(crate) mod jwt_auth;
pub(crate) mod jwt_or_api_auth;

/// Expiry time of a session cookie
const COOKIE_EXPIRY_HOURS: i64 = 1;
/// Expiry time of a password reset token
const PASSWORD_TOKEN_EXPIRES_IN_MINUTES: i64 = 10;
const PASSWORD_RESET_TOKEN_LENGTH: usize = 20;

pub(crate) fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/auth/is-registered", get(get_is_registered))
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
            post(refresh_token_handler).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/auth/logout",
            get(logout_handler).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
        )
        .route(
            "/api/auth/check",
            get(check_auth_handler).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_or_api_auth::auth,
            )),
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
            get(get_me_handler).route_layer(middleware::from_fn_with_state(
                app_state.clone(),
                jwt_auth::auth,
            )),
        )
        .route(
            "/api/auth/reset-legacy-password/:password_reset_token",
            put(reset_legacy_password_handler),
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

#[derive(Deserialize)]
struct IsRegisteredParams {
    email: String,
}

#[derive(Serialize)]
struct IsRegisteredResponse {
    is_registered: bool,
    is_verified: bool,
}

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
        .map_err(Error::Database)?;

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

#[derive(Serialize, Deserialize, ToSchema)]
pub struct RegistrationResponse {
    message: String,
}

/// Register a new user with email and password. To create borrower API accounts (using a master API
/// key), refer to /api/create-api-account.
#[utoipa::path(
post,
request_body = RegisterUserSchema,
path = "/register",
tag = AUTH_TAG,
responses(
    (
        status = 200,
        description = "Message if the registration was successful",
        body = [RegistrationResponse]
    )
)
)]
#[instrument(skip_all, err(Debug, level = Level::DEBUG))]
async fn post_register(
    State(data): State<Arc<AppState>>,
    AppJson(body): AppJson<RegisterUserSchema>,
) -> Result<impl IntoResponse, Error> {
    if !is_valid_email(body.email.as_str()) {
        return Err(Error::InvalidEmail);
    }

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

    let (user, password_auth_info) = register_password_auth_user(
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
        },
    )
    .await
    .map_err(|e| Error::Database(anyhow!(e)))?;

    let email = password_auth_info.email.clone();
    let verification_code = password_auth_info
        .verification_code
        .expect("to have verification code for new user");
    let verification_url = data
        .config
        .borrower_frontend_origin
        .join(format!("/verifyemail/{}", verification_code.as_str()).as_str())
        .expect("to be a correct URL");

    data.notifications
        .send_verification_code(
            user.name.as_str(),
            email.as_str(),
            verification_url,
            verification_code.as_str(),
        )
        .await;

    db_tx
        .commit()
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?;

    // needs to be after the tx as the user needs to exist in the database.
    if let Err(err) =
        db::borrowers_referral_code::create_referral_code(&data.db, None, user.id.as_str()).await
    {
        tracing::error!(
            user_id = user.id,
            "Failed inserting referral code for new user {err}"
        );
    }

    Ok(Json(RegistrationResponse {
        message: format!("We sent an email with a verification code to {}", email),
    }))
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
    personal_referral_codes: Vec<PersonalReferralCode>,
    timezone: Option<String>,
    personal_telegram_token: String,
    #[serde(with = "rust_decimal::serde::float")]
    first_time_discount_rate: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    updated_at: OffsetDateTime,
}

#[derive(Debug, Serialize)]
struct PersonalReferralCode {
    code: String,
    active: bool,
    #[serde(with = "rust_decimal::serde::float")]
    first_time_discount_rate_referee: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    first_time_commission_rate_referrer: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    commission_rate_referrer: Decimal,
    #[serde(with = "time::serde::rfc3339")]
    created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    expires_at: OffsetDateTime,
}

impl From<model::PersonalReferralCode> for PersonalReferralCode {
    fn from(value: model::PersonalReferralCode) -> Self {
        PersonalReferralCode {
            code: value.code,
            active: value.active,
            first_time_discount_rate_referee: value.first_time_discount_rate_referee,
            first_time_commission_rate_referrer: value.first_time_commission_rate_referrer,
            commission_rate_referrer: value.commission_rate_referrer,
            created_at: value.created_at,
            expires_at: value.expires_at,
        }
    }
}

impl FilteredUser {
    fn new_user(
        user: &Borrower,
        password_auth_info: &PasswordAuth,
        personal_telegram_token: TelegramBotToken,
    ) -> Self {
        let created_at_utc = user.created_at;
        let updated_at_utc = user.updated_at;
        Self {
            id: user.id.to_string(),
            email: password_auth_info.email.clone(),
            name: user.name.to_owned(),
            verified: password_auth_info.verified,
            used_referral_code: user.used_referral_code.clone(),
            personal_referral_codes: user
                .personal_referral_codes
                .clone()
                .into_iter()
                .map(PersonalReferralCode::from)
                .collect(),
            first_time_discount_rate: user.first_time_discount_rate_referee.unwrap_or_default(),
            timezone: user.timezone.clone(),
            personal_telegram_token: personal_telegram_token.token,
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
    let (user, password_auth_info) = get_user_by_email(&data.db, email.as_str())
        .await
        .map_err(|e| Error::Database(anyhow!(e)))?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let borrower_id = user.id;
    tracing::Span::current().record("borrower_id", &borrower_id);

    if !password_auth_info.verified {
        return Err(Error::EmailNotVerified);
    }

    // The presence of a password hash indicates that the user has not upgraded to PAKE yet.
    if password_auth_info.password.is_some() {
        return Err(Error::PakeUpgradeRequired);
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

    let response = Response::builder()
        .status(StatusCode::OK)
        .body(
            json!(PakeLoginResponse {
                b_pub,
                salt: password_auth_info.salt
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
    let (user, password_auth_info) = get_user_by_email(&data.db, email.as_str())
        .await
        .map_err(Error::Database)?
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
    let exp = (now + time::Duration::hours(COOKIE_EXPIRY_HOURS)).unix_timestamp();
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

    let personal_telegram_token =
        db::telegram_bot::borrower::get_or_create_token_by_borrower_id(&data.db, user.id.as_str())
            .await
            .map_err(|error| Error::Database(anyhow!(error)))?;

    let filtered_user = FilteredUser::new_user(&user, &password_auth_info, personal_telegram_token);

    let wallet_backup = db::wallet_backups::find_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(|error| Error::Database(anyhow!(error)))?;

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

    let profile_url = data
        .config
        .borrower_frontend_origin
        .join("/settings/profile")
        .expect("to be a correct URL");

    data.notifications
        .send_login_information_borrower(
            user,
            profile_url,
            ip_address.as_str(),
            OffsetDateTime::now_utc(),
            location.map(|l| l.to_string()),
            user_agent.as_str(),
        )
        .await;

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
    let (user, password_auth_info) = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let borrower_id = &user.id;
    tracing::Span::current().record("borrower_id", borrower_id);

    if !password_auth_info.verified {
        return Err(Error::EmailNotVerified);
    }

    let is_valid = password_auth_info.check_password(body.old_password.as_str());

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
    };

    let contracts = db::contracts::load_contracts_by_borrower_id(&data.db, borrower_id)
        .await
        .map_err(Error::Database)?;

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
        .filter_map(|c| match c.borrower_derivation_path {
            Some(_) => None,
            None => Some(c.borrower_pk),
        })
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
    let (user, password_auth_info) = get_user_by_email(&data.db, body.email.as_str())
        .await
        .map_err(Error::Database)?
        .ok_or(Error::EmailOrPasswordInvalid)?;

    let borrower_id = user.id.clone();
    tracing::Span::current().record("borrower_id", &borrower_id);

    if !password_auth_info.verified {
        return Err(Error::EmailNotVerified);
    }

    let is_valid = password_auth_info.check_password(body.old_password.as_str());

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
    let password_auth_info =
        get_password_auth_info_by_verification_code(&data.db, verification_code.as_str())
            .await
            .map_err(Error::Database)?
            .ok_or(Error::InvalidVerificationCode)?;

    let borrower_id = &password_auth_info.borrower_id;
    tracing::Span::current().record("borrower_id", borrower_id);

    if password_auth_info.verified {
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
    let (user, password_auth_info) = get_user_by_email(&data.db, body.email.as_str())
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
    tracing::Span::current().record("borrower_id", borrower_id);

    if !password_auth_info.verified {
        let error_response = ErrorResponse {
            message: "Account not verified".to_string(),
        };
        return Err((StatusCode::FORBIDDEN, Json(error_response)));
    }

    // This can be done by calling another API directly, but not through this one.
    if password_auth_info.password.is_some() {
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

    let mut password_reset_url = data
        .config
        .borrower_frontend_origin
        .join(
            format!(
                "/resetpassword/{}/{}",
                password_reset_token, password_auth_info.email
            )
            .as_str(),
        )
        .expect("to be a correct URL");

    // If this user has contracts before the PAKE upgrade, we do not allow them to reset their
    // password using a mnemonic. Using a mnemonic would remove the passphrase embedded in their
    // encrypted local wallet, and this passphrase is needed to spend contracts created before the
    // PAKE upgrade.
    if has_contracts_before_pake {
        password_reset_url = password_reset_url.join("?nomn=true").expect("to be valid");
    }

    data.notifications
        .send_password_reset_token(
            user.name.as_str(),
            password_auth_info.email.as_str(),
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

#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn reset_password_handler(
    State(data): State<Arc<AppState>>,
    Path(password_reset_token): Path<String>,
    AppJson(body): AppJson<ResetPasswordSchema>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let password_auth_info =
        get_password_auth_info_by_reset_token(&data.db, password_reset_token.as_str())
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

    let borrower_id = &password_auth_info.borrower_id;
    tracing::Span::current().record("borrower_id", borrower_id);

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
        password_auth_info.email.as_str(),
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

#[instrument(skip_all, fields(borrower_id), err(Debug))]
async fn reset_legacy_password_handler(
    State(data): State<Arc<AppState>>,
    Path(password_reset_token): Path<String>,
    AppJson(body): AppJson<ResetLegacyPasswordSchema>,
) -> Result<(), Error> {
    let password_auth_info =
        get_password_auth_info_by_reset_token(&data.db, password_reset_token.as_str())
            .await
            .map_err(Error::Database)?
            .ok_or(Error::InvalidVerificationCode)?;

    let borrower_id = &password_auth_info.borrower_id;
    tracing::Span::current().record("borrower_id", borrower_id);

    if password_auth_info.password.is_none() {
        return Err(Error::NoLegacyResetAfterPake);
    }

    db::borrowers::update_legacy_password(&data.db, borrower_id, &body.password)
        .await
        .map_err(Error::Database)?;

    Ok(())
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
    Extension((user, password_auth_info)): Extension<(Borrower, PasswordAuth)>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let personal_telegram_token =
        db::telegram_bot::borrower::get_or_create_token_by_borrower_id(&data.db, user.id.as_str())
            .await
            .map_err(|error| {
                let error_response = ErrorResponse {
                    message: format!("Database error: {}", error),
                };
                (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response))
            })?;

    let filtered_user = FilteredUser::new_user(&user, &password_auth_info, personal_telegram_token);

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

#[derive(Debug, Deserialize)]
pub struct WaitlistBody {
    email: String,
}

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

#[instrument(skip_all, fields(borrower_id = user.id), err(Debug))]
async fn refresh_token_handler(
    State(data): State<Arc<AppState>>,
    Extension((user, _)): Extension<(Borrower, PasswordAuth)>,
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
    EmailOrPasswordInvalid,
    /// No invite code provided.
    InviteCodeRequired,
    /// Invalid or expired referral code.
    InvalidReferralCode { referral_code: String },
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
    /// Cannot reset a legacy password after PAKE upgrade.
    NoLegacyResetAfterPake,
    /// User already in waiting list with this email.
    EmailExists,
    /// Invalid email
    InvalidEmail,
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
            db::waitlist::Error::DatabaseError(e) => Error::Database(anyhow!(e)),
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
            Error::EmailOrPasswordInvalid => (
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
            Error::NoLegacyResetAfterPake => {
                tracing::error!("Cannot reset legacy password after PAKE upgrade");

                (StatusCode::BAD_REQUEST, "Something went wrong.".to_owned())
            }
            Error::EmailExists => (StatusCode::CONFLICT, "Email already used".to_owned()),
            Error::InvalidEmail => (StatusCode::BAD_REQUEST, "Invalid email address".to_owned()),
        };

        (status, AppJson(ErrorResponse { message })).into_response()
    }
}
