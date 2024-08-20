use serde::Serialize;

pub(crate) mod frontend;
pub(crate) mod health_check;

pub(crate) mod auth;
pub(crate) mod contracts;
pub(crate) mod loan_offers;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
