//! Encryption service for secure password handling
//!
//! Provides AES-256-GCM decryption for encrypted passwords stored in the database.

use super::SecurityError;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use tracing::{debug, error};

/// Encryption service for password decryption
pub struct EncryptionService {
    cipher: Option<Aes256Gcm>,
}

impl EncryptionService {
    /// Create new encryption service with encryption key
    pub fn new(encryption_key: Option<&str>) -> Result<Self, SecurityError> {
        let cipher = if let Some(key_b64) = encryption_key {
            let key_bytes = BASE64
                .decode(key_b64)
                .map_err(|e| SecurityError::InvalidEncryptionKey(e.to_string()))?;

            if key_bytes.len() != 32 {
                return Err(SecurityError::InvalidEncryptionKey(
                    "Key must be 32 bytes (256 bits)".to_string(),
                ));
            }

            let cipher = Aes256Gcm::new_from_slice(&key_bytes)
                .map_err(|e| SecurityError::InvalidEncryptionKey(e.to_string()))?;

            Some(cipher)
        } else {
            None
        };

        Ok(Self { cipher })
    }

    /// Decrypt an encrypted password
    ///
    /// Expected format: base64(nonce[12 bytes] + ciphertext)
    pub fn decrypt_password(&self, encrypted_password: &str) -> Result<String, SecurityError> {
        let cipher = self
            .cipher
            .as_ref()
            .ok_or(SecurityError::MissingEncryptionKey)?;

        // Decode base64
        let encrypted_bytes = BASE64
            .decode(encrypted_password)
            .map_err(|e| SecurityError::DecryptionFailed(format!("Invalid base64: {}", e)))?;

        if encrypted_bytes.len() < 12 {
            return Err(SecurityError::DecryptionFailed(
                "Encrypted data too short".to_string(),
            ));
        }

        // Extract nonce (first 12 bytes) and ciphertext
        let (nonce_bytes, ciphertext) = encrypted_bytes.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| SecurityError::DecryptionFailed(format!("Decryption failed: {}", e)))?;

        // Convert to string
        String::from_utf8(plaintext)
            .map_err(|e| SecurityError::DecryptionFailed(format!("Invalid UTF-8: {}", e)))
    }

    /// Check if encryption is enabled
    pub fn is_enabled(&self) -> bool {
        self.cipher.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use aes_gcm::aead::{Aead, OsRng};
    use aes_gcm::{AeadCore, KeyInit};

    fn generate_test_key() -> String {
        let key = Aes256Gcm::generate_key(OsRng);
        BASE64.encode(key)
    }

    fn encrypt_test_password(key_b64: &str, password: &str) -> String {
        let key_bytes = BASE64.decode(key_b64).unwrap();
        let cipher = Aes256Gcm::new_from_slice(&key_bytes).unwrap();
        let nonce = Aes256Gcm::generate_nonce(OsRng);

        let ciphertext = cipher.encrypt(&nonce, password.as_bytes()).unwrap();

        // Combine nonce + ciphertext and encode
        let mut combined = nonce.to_vec();
        combined.extend_from_slice(&ciphertext);
        BASE64.encode(combined)
    }

    #[test]
    fn test_encryption_service_without_key() {
        let service = EncryptionService::new(None).unwrap();
        assert!(!service.is_enabled());

        let result = service.decrypt_password("anything");
        assert!(matches!(result, Err(SecurityError::MissingEncryptionKey)));
    }

    #[test]
    fn test_encryption_service_with_key() {
        let key = generate_test_key();
        let service = EncryptionService::new(Some(&key)).unwrap();
        assert!(service.is_enabled());
    }

    #[test]
    fn test_decrypt_password() {
        let key = generate_test_key();
        let service = EncryptionService::new(Some(&key)).unwrap();

        let original_password = "my_secure_password_123!";
        let encrypted = encrypt_test_password(&key, original_password);

        let decrypted = service.decrypt_password(&encrypted).unwrap();
        assert_eq!(decrypted, original_password);
    }

    #[test]
    fn test_decrypt_with_wrong_key() {
        let key1 = generate_test_key();
        let key2 = generate_test_key();

        let service1 = EncryptionService::new(Some(&key1)).unwrap();
        let service2 = EncryptionService::new(Some(&key2)).unwrap();

        let original_password = "secret";
        let encrypted = encrypt_test_password(&key1, original_password);

        // Decryption with wrong key should fail
        let result = service2.decrypt_password(&encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_base64() {
        let key = generate_test_key();
        let service = EncryptionService::new(Some(&key)).unwrap();

        let result = service.decrypt_password("not_valid_base64!!!");
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_key_length() {
        let short_key = BASE64.encode(b"too_short");
        let result = EncryptionService::new(Some(&short_key));
        assert!(result.is_err());
    }
}
