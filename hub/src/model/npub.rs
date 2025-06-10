use nostr::FromBech32;
use nostr::ToBech32;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::Serializer;
use std::fmt;
use std::str::FromStr;
use utoipa::PartialSchema;
use utoipa::ToSchema;

/// A validated Nostr public key in bech32 format (npub...)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Npub(nostr::PublicKey);

impl Npub {
    /// Create a new Npub from a nostr::PublicKey
    pub fn new(public_key: nostr::PublicKey) -> Self {
        Self(public_key)
    }

    /// Get the inner nostr::PublicKey
    pub fn public_key(&self) -> &nostr::PublicKey {
        &self.0
    }

    /// Convert to bech32 npub string
    pub fn to_bech32(&self) -> String {
        self.0
            .to_bech32()
            .expect("valid public key should always encode to bech32")
    }
}

impl fmt::Display for Npub {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_bech32())
    }
}

impl FromStr for Npub {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let public_key = nostr::PublicKey::from_bech32(s)
            .map_err(|e| anyhow::anyhow!("Invalid npub format: {}", e))?;
        Ok(Self(public_key))
    }
}

impl Serialize for Npub {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_bech32())
    }
}

impl<'de> Deserialize<'de> for Npub {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        s.parse().map_err(serde::de::Error::custom)
    }
}

impl ToSchema for Npub {
    fn name() -> std::borrow::Cow<'static, str> {
        "Npub".into()
    }
}

impl PartialSchema for Npub {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::Schema> {
        utoipa::openapi::ObjectBuilder::new()
            .schema_type(utoipa::openapi::schema::SchemaType::Type(
                utoipa::openapi::Type::String,
            ))
            .pattern(Some("^npub1[02-9ac-hj-np-z]{58}$"))
            .description(Some("A Nostr public key in bech32 format (npub...)"))
            .examples([serde_json::json!(
                "npub17mx98j4khcynw7cm6m0zfu5q2uv6dqs2lenaq8nfzn8paz5dt4hqs5utwq"
            )])
            .into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_npub() {
        let npub_str = "npub17mx98j4khcynw7cm6m0zfu5q2uv6dqs2lenaq8nfzn8paz5dt4hqs5utwq";
        let npub = Npub::from_str(npub_str).expect("valid npub");
        assert_eq!(npub.to_string(), npub_str);
    }

    #[test]
    fn test_invalid_npub() {
        let invalid_npub = "invalid_npub";
        assert!(Npub::from_str(invalid_npub).is_err());
    }

    #[test]
    fn test_serde() {
        let npub_str = "npub17mx98j4khcynw7cm6m0zfu5q2uv6dqs2lenaq8nfzn8paz5dt4hqs5utwq";
        let npub = Npub::from_str(npub_str).expect("valid npub");

        let serialized = serde_json::to_string(&npub).expect("serialize");
        let deserialized: Npub = serde_json::from_str(&serialized).expect("deserialize");

        assert_eq!(npub, deserialized);
    }
}
