use anyhow::Context;
use anyhow::Result;
use rand::distributions::Alphanumeric;
use rand::Rng;
use sha2::Digest;
use sha2::Sha256;

pub struct ApiKey {
    key_id: String,
    full_key: String,
}

pub struct ApiKeyHash {
    key_id: String,
    salt: Vec<u8>,
    hash: String,
}

impl ApiKey {
    pub fn generate() -> (Self, ApiKeyHash) {
        // Generate short identifier for this specific key (12 chars)
        let key_id: String = (0..6)
            .map(|_| format!("{:02x}", rand::thread_rng().gen::<u8>()))
            .collect();

        // Generate secret part (alphanumeric only: 0-9, A-Z, a-z)
        let secret_part: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(43) // Similar length to base64 encoding of 32 bytes
            .map(char::from)
            .collect();

        // Create full key
        let full_key = format!("lndst_sk_{key_id}_{secret_part}");

        let api_key_hash = ApiKeyHash::generate(key_id.clone(), &full_key);

        let api_key = ApiKey { key_id, full_key };

        (api_key, api_key_hash)
    }

    pub fn new_from_full_key(full_key: &str) -> Result<(Self, ApiKeyHash)> {
        let api_key = Self::from_string(full_key).context("invalid API key")?;

        let api_key_hash = ApiKeyHash::generate(api_key.key_id.clone(), &api_key.full_key);

        Ok((api_key, api_key_hash))
    }

    pub fn from_string(full_key: &str) -> Option<Self> {
        // Extract key_id from the full API key (format: lndst_sk_{key_id}_{secret})
        let parts: Vec<&str> = full_key.split('_').collect();
        if parts.len() != 4 || parts[0] != "lndst" || parts[1] != "sk" || parts[2].len() != 12 {
            return None;
        }

        Some(ApiKey {
            key_id: parts[2].to_string(),
            full_key: full_key.to_string(),
        })
    }

    pub fn full_key(&self) -> &str {
        &self.full_key
    }

    pub fn key_id(&self) -> &str {
        &self.key_id
    }
}

impl ApiKeyHash {
    pub fn generate(key_id: String, full_key: &str) -> Self {
        // Generate random salt
        let salt: Vec<u8> = (0..16).map(|_| rand::thread_rng().gen()).collect();

        // Hash with salt
        let mut hasher = Sha256::new();
        hasher.update(full_key.as_bytes());
        hasher.update(&salt);
        let hash = format!("{:x}", hasher.finalize());

        Self { key_id, salt, hash }
    }

    pub fn new(key_id: String, salt: Vec<u8>, hash: String) -> Self {
        Self { key_id, salt, hash }
    }

    pub fn verify(&self, api_key: &ApiKey) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(api_key.full_key().as_bytes());
        hasher.update(&self.salt);
        let computed_hash = format!("{:x}", hasher.finalize());

        computed_hash == self.hash && self.key_id == api_key.key_id
    }

    pub fn key_id(&self) -> &str {
        &self.key_id
    }

    pub fn salt(&self) -> &[u8] {
        &self.salt
    }

    pub fn hash(&self) -> &str {
        &self.hash
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_key_generation() {
        let (api_key, api_key_hash) = ApiKey::generate();

        // Check that key_id is 12 characters
        assert_eq!(api_key.key_id().len(), 12);
        assert_eq!(api_key_hash.key_id.len(), 12);
        assert_eq!(api_key.key_id(), api_key_hash.key_id);

        // Check full key has correct structure
        let parts: Vec<&str> = api_key.full_key().split('_').collect();
        assert_eq!(parts.len(), 4);
        assert_eq!(parts[0], "lndst");
        assert_eq!(parts[1], "sk");
        assert_eq!(parts[2], api_key.key_id());
        assert!(!parts[3].is_empty()); // secret part
    }

    #[test]
    fn test_api_key_hash_properties() {
        let (_api_key, api_key_hash) = ApiKey::generate();

        // Check salt is 16 bytes
        assert_eq!(api_key_hash.salt.len(), 16);

        // Check hash is 64 characters (SHA256 hex)
        assert_eq!(api_key_hash.hash.len(), 64);
    }

    #[test]
    fn test_api_key_verification() {
        let (api_key, api_key_hash) = ApiKey::generate();

        // Verify with correct key
        assert!(api_key_hash.verify(&api_key));

        // Create wrong API key with same key_id but different secret
        let wrong_api_key = ApiKey {
            key_id: api_key.key_id().to_string(),
            full_key: format!("lndst_sk_{}_wrongsecret", api_key.key_id()),
        };
        assert!(!api_key_hash.verify(&wrong_api_key));

        // Test with completely different key
        let (different_key, _) = ApiKey::generate();
        assert!(!api_key_hash.verify(&different_key));
    }

    #[test]
    fn test_api_key_from_string() {
        let (api_key, _) = ApiKey::generate();
        let full_key = api_key.full_key();

        // Parse back from string
        let parsed_key = ApiKey::from_string(full_key).unwrap();
        assert_eq!(parsed_key.key_id(), api_key.key_id());
        assert_eq!(parsed_key.full_key(), api_key.full_key());

        // Test invalid formats
        assert!(ApiKey::from_string("invalid_key").is_none());
        assert!(ApiKey::from_string("lndst_sk_short_secret").is_none());
        assert!(ApiKey::from_string("wrong_prefix_key_secret").is_none());
    }

    #[test]
    fn test_api_key_uniqueness() {
        let (key1, hash1) = ApiKey::generate();
        let (key2, hash2) = ApiKey::generate();

        // Keys should be different
        assert_ne!(key1.full_key(), key2.full_key());
        assert_ne!(key1.key_id(), key2.key_id());
        assert_ne!(hash1.key_id, hash2.key_id);
        assert_ne!(hash1.hash, hash2.hash);
    }

    #[test]
    fn test_api_key_alphanumeric_only() {
        let (api_key, _) = ApiKey::generate();
        let parts: Vec<&str> = api_key.full_key().split('_').collect();
        let secret_part = parts[3];

        // Check that secret part contains only alphanumeric characters
        assert!(secret_part.chars().all(|c| c.is_ascii_alphanumeric()));

        // Check that it doesn't contain URL-safe base64 special characters
        assert!(!secret_part.contains('-'));
        assert!(!secret_part.contains('_'));
        assert!(!secret_part.contains('='));
    }
}
