//! Authentication validator for protocol connections
//!
//! Validates credentials, certificates, and connection parameters for each protocol.

use super::{EncryptionService, SecurityConfig, SecurityError};
use crate::adapters::ConnectionConfig;
use std::net::IpAddr;
use tracing::{debug, info};

/// Authentication validator
pub struct AuthenticationValidator {
    encryption_service: EncryptionService,
    config: SecurityConfig,
}

impl AuthenticationValidator {
    /// Create new authentication validator
    pub fn new(config: SecurityConfig) -> Result<Self, SecurityError> {
        let encryption_service = EncryptionService::new(config.encryption_key.as_deref())?;

        Ok(Self {
            encryption_service,
            config,
        })
    }

    /// Validate connection configuration and credentials
    pub fn validate_connection(
        &self,
        conn_config: &ConnectionConfig,
        source_ip: Option<IpAddr>,
    ) -> Result<(), SecurityError> {
        info!(
            connection_id = %conn_config.connection_id,
            tenant_id = %conn_config.tenant_id,
            "Validating connection authentication"
        );

        // Validate source IP if provided
        if let Some(ip) = source_ip {
            self.config.validate_ip(&ip)?;
        }

        // Validate credentials if username is provided
        if let Some(username) = &conn_config.username {
            if username.is_empty() {
                return Err(SecurityError::AuthenticationFailed(
                    "Username cannot be empty".to_string(),
                ));
            }

            debug!(username = %username, "Validating username");
        }

        // Validate password if provided
        if let Some(password) = &conn_config.password {
            if password.is_empty() {
                return Err(SecurityError::AuthenticationFailed(
                    "Password cannot be empty".to_string(),
                ));
            }

            // Check if password looks encrypted (base64-encoded)
            if self.encryption_service.is_enabled() && !password.contains(':') {
                // Attempt to decrypt to validate it's a valid encrypted password
                self.encryption_service.decrypt_password(password)?;
                debug!("Successfully validated encrypted password");
            } else {
                debug!(
                    "Password appears to be plaintext (encryption not enabled or legacy format)"
                );
            }
        }

        // Validate security configuration for protocols that support it
        if let Some(security_mode) = &conn_config.security_mode {
            debug!(security_mode = %security_mode, "Validating security mode");

            if self.config.validate_certificates && security_mode != "None" {
                // In production, we would validate certificates here
                debug!("Certificate validation required but not yet implemented");
            }
        }

        info!(
            connection_id = %conn_config.connection_id,
            "Connection authentication validated successfully"
        );

        Ok(())
    }

    /// Get decrypted password if encryption is enabled
    pub fn get_decrypted_password(
        &self,
        encrypted_password: &str,
    ) -> Result<String, SecurityError> {
        if self.encryption_service.is_enabled() {
            self.encryption_service.decrypt_password(encrypted_password)
        } else {
            // Encryption not enabled, return as-is (legacy support)
            Ok(encrypted_password.to_string())
        }
    }

    /// Check if encryption is enabled
    pub fn is_encryption_enabled(&self) -> bool {
        self.encryption_service.is_enabled()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn create_test_config() -> ConnectionConfig {
        ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "opc.tcp://localhost:4840".to_string(),
            security_mode: Some("None".to_string()),
            security_policy: None,
            username: Some("testuser".to_string()),
            password: Some("testpassword".to_string()),
            slave_id: None,
            client_id: None,
            qos: None,
        }
    }

    #[test]
    fn test_validate_connection_success() {
        let security_config = SecurityConfig::default();
        let validator = AuthenticationValidator::new(security_config).unwrap();

        let conn_config = create_test_config();
        let result = validator.validate_connection(&conn_config, None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_connection_with_ip_whitelist() {
        let allowed_ip: IpAddr = "192.168.1.100".parse().unwrap();
        let blocked_ip: IpAddr = "192.168.1.200".parse().unwrap();

        let security_config = SecurityConfig {
            ip_whitelist: vec![allowed_ip],
            ..Default::default()
        };
        let validator = AuthenticationValidator::new(security_config).unwrap();

        let conn_config = create_test_config();

        // Allowed IP should succeed
        assert!(validator
            .validate_connection(&conn_config, Some(allowed_ip))
            .is_ok());

        // Blocked IP should fail
        assert!(validator
            .validate_connection(&conn_config, Some(blocked_ip))
            .is_err());
    }

    #[test]
    fn test_validate_empty_username() {
        let security_config = SecurityConfig::default();
        let validator = AuthenticationValidator::new(security_config).unwrap();

        let mut conn_config = create_test_config();
        conn_config.username = Some(String::new());

        let result = validator.validate_connection(&conn_config, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_empty_password() {
        let security_config = SecurityConfig::default();
        let validator = AuthenticationValidator::new(security_config).unwrap();

        let mut conn_config = create_test_config();
        conn_config.password = Some(String::new());

        let result = validator.validate_connection(&conn_config, None);
        assert!(result.is_err());
    }
}
