use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::header::USER_AGENT;
use axum::http::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::IntoResponse;
use axum::Json;
use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct UserConnectionDetails {
    pub ip: Option<String>,
    pub user_agent: Option<String>,
}

/// Middleware which extracts the ip address and user agent of the requestor
pub async fn ip_user_agent(
    mut req: Request<Body>,
    next: Next,
) -> Result<impl IntoResponse, (StatusCode, Json<String>)> {
    let nginx_ip = req
        .headers()
        .get("X-Real-IP")
        .and_then(|value| value.to_str().ok());

    let ip = match nginx_ip {
        Some(ip) => Some(ip.to_string()),
        None => {
            tracing::trace!(
                target : "nginx",
                "Request did not include nginx header. Fallback to request IP"
            );

            // NOTE: Extract IP address from the request. This will not work if behind nginx as we
            // will always receive 127.0.0.1 as address
            let ip = req
                .extensions()
                .get::<ConnectInfo<SocketAddr>>()
                .map(|ci| ci.0);

            ip.map(|ip| ip.ip().to_string())
        }
    };

    // Extract User-Agent
    let user_agent = req
        .headers()
        .get(USER_AGENT)
        .and_then(|ua| ua.to_str().ok())
        .map(|s| s.to_string());

    req.extensions_mut()
        .insert(UserConnectionDetails { ip, user_agent });

    Ok(next.run(req).await)
}
