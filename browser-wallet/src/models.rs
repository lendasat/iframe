/// Details needed for the lender to send fiat to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, PartialEq)]
pub struct FiatLoanDetails {
    /// Details for transfers within Europe (generally).
    pub iban_transfer_details: Option<IbanTransferDetails>,
    /// Details for transfers outside Europe (generally).
    pub swift_transfer_details: Option<SwiftTransferDetails>,
    pub bank_name: String,
    pub bank_address: String,
    pub bank_country: String,
    pub purpose_of_remittance: String,
    pub full_name: String,
    pub address: String,
    pub city: String,
    pub post_code: String,
    pub country: String,
    /// Extra information the borrower may want to provide to the lender.
    pub comments: Option<String>,
}

/// Details needed for the lender to send fiat via an IBAN transfer to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, PartialEq)]
pub struct IbanTransferDetails {
    pub iban: String,
    pub bic: Option<String>,
}

/// Details needed for the lender to send fiat via a SWIFT transfer to the borrower.
///
/// All fields are _encrypted_ so that the hub can't learn anything.
#[derive(Debug, PartialEq)]
pub struct SwiftTransferDetails {
    pub swift_or_bic: String,
    pub account_number: String,
}
