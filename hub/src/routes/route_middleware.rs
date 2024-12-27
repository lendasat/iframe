use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::header::USER_AGENT;
use axum::http::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::IntoResponse;
use axum::Json;
use std::net::SocketAddr;

/// Middleware which extracts the ip address and user agent of the requestor
pub async fn ip_user_agent(
    mut req: Request<Body>,
    next: Next,
) -> Result<impl IntoResponse, (StatusCode, Json<String>)> {
    // Extract IP address
    let ip = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0);

    // Extract User-Agent
    let user_agent = req
        .headers()
        .get(USER_AGENT)
        .and_then(|ua| ua.to_str().ok())
        .map(|s| s.to_string());

    req.extensions_mut().insert(ip);
    req.extensions_mut().insert(user_agent);

    Ok(next.run(req).await)
}
