use serde::Serialize;

pub(crate) mod borrower;
pub(crate) mod lender;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}
