//! # Lendasat Client SDK
//!
//! An SDK for building Lendasat clients.
//!
//! ## Main Components
//!
//! - [`auth`]: Secure Remote Password (SRP) authentication implementation
//! - [`wallet`]: Bitcoin HD wallet management, transaction signing, and encrypted storage
//! ```

pub mod auth;
pub mod wallet;

// Re-export the SRP crate for convenience when using authentication features
pub use srp;
