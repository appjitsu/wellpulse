//! Security layer for SCADA ingestion service
//!
//! Provides comprehensive security features including:
//! - Password decryption (AES-256-GCM)
//! - Authentication validation
//! - IP whitelisting
//! - Certificate validation
//! - Data validation and sanitization

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use std::net::IpAddr;
use thiserror::Error;
use tracing::{debug, warn};

pub mod authenticator;
pub mod data_validator;
pub mod encryption;

pub use authenticator::AuthenticationValidator;
pub use data_validator::{DataValidator, ValidationConfig};
pub use encryption::EncryptionService;

/// Security errors
#[derive(Error, Debug)]
pub enum SecurityError {
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("IP address {0} not whitelisted")]
    IpNotWhitelisted(IpAddr),

    #[error("Certificate validation failed: {0}")]
    CertificateValidationFailed(String),

    #[error("Data validation failed: {0}")]
    DataValidationFailed(String),

    #[error("Invalid encryption key: {0}")]
    InvalidEncryptionKey(String),

    #[error("Missing encryption key")]
    MissingEncryptionKey,
}

/// Security configuration
#[derive(Debug, Clone)]
pub struct SecurityConfig {
    /// Encryption key for decrypting passwords (base64-encoded)
    pub encryption_key: Option<String>,
    /// IP whitelist (empty = allow all)
    pub ip_whitelist: Vec<IpAddr>,
    /// Whether to validate TLS certificates
    pub validate_certificates: bool,
    /// Whether to reject readings with Bad quality
    pub reject_bad_quality: bool,
    /// Whether to reject readings with Uncertain quality
    pub reject_uncertain_quality: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            encryption_key: None,
            ip_whitelist: Vec::new(),
            validate_certificates: true,
            reject_bad_quality: true,
            reject_uncertain_quality: false,
        }
    }
}

impl SecurityConfig {
    /// Load security configuration from environment
    pub fn from_env() -> Self {
        let encryption_key = std::env::var("ENCRYPTION_KEY").ok();

        let ip_whitelist = std::env::var("IP_WHITELIST")
            .ok()
            .map(|s| {
                s.split(',')
                    .filter_map(|ip| ip.trim().parse::<IpAddr>().ok())
                    .collect()
            })
            .unwrap_or_default();

        let validate_certificates = std::env::var("VALIDATE_CERTIFICATES")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(true);

        let reject_bad_quality = std::env::var("REJECT_BAD_QUALITY")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(true);

        let reject_uncertain_quality = std::env::var("REJECT_UNCERTAIN_QUALITY")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(false);

        Self {
            encryption_key,
            ip_whitelist,
            validate_certificates,
            reject_bad_quality,
            reject_uncertain_quality,
        }
    }

    /// Validate IP address against whitelist
    pub fn validate_ip(&self, ip: &IpAddr) -> Result<(), SecurityError> {
        // Empty whitelist = allow all
        if self.ip_whitelist.is_empty() {
            return Ok(());
        }

        if self.ip_whitelist.contains(ip) {
            debug!(ip = %ip, "IP address validated against whitelist");
            Ok(())
        } else {
            warn!(ip = %ip, "IP address not in whitelist");
            Err(SecurityError::IpNotWhitelisted(*ip))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_whitelist_allows_all() {
        let config = SecurityConfig {
            ip_whitelist: vec![],
            ..Default::default()
        };

        let ip = "192.168.1.1".parse().unwrap();
        assert!(config.validate_ip(&ip).is_ok());
    }

    #[test]
    fn test_ip_whitelist_validation() {
        let allowed_ip: IpAddr = "192.168.1.100".parse().unwrap();
        let blocked_ip: IpAddr = "192.168.1.200".parse().unwrap();

        let config = SecurityConfig {
            ip_whitelist: vec![allowed_ip],
            ..Default::default()
        };

        assert!(config.validate_ip(&allowed_ip).is_ok());
        assert!(config.validate_ip(&blocked_ip).is_err());
    }
}
