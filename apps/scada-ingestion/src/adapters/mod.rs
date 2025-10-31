//! Protocol adapter layer for SCADA ingestion
//!
//! Provides a pluggable architecture for supporting multiple SCADA protocols
//! (OPC-UA, Modbus TCP/RTU, MQTT, etc.) through a common trait interface.
//!
//! ## Architecture
//!
//! ```text
//! Protocol Device → Protocol Adapter → Common Format (ProtocolReading) → Aggregator
//! ```
//!
//! All adapters translate protocol-specific data into a common `ProtocolReading` format,
//! allowing the core ingestion service to be protocol-agnostic.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::fmt;
use thiserror::Error;
use uuid::Uuid;

pub mod dnp3;
pub mod ethernet_ip;
pub mod factory;
pub mod hart_ip;
pub mod modbus_rtu;
pub mod modbus_tcp;
pub mod mqtt;
pub mod opcua;

/// Common reading format that all protocol adapters translate to
#[derive(Debug, Clone)]
pub struct ProtocolReading {
    pub timestamp: DateTime<Utc>,
    pub tenant_id: Uuid,
    pub well_id: Uuid,
    pub tag_name: String,
    pub value: f64,
    pub quality: ReadingQuality,
    pub source_protocol: String,
}

/// Data quality indicator
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReadingQuality {
    /// Reading is valid and trustworthy
    Good,
    /// Reading is invalid or failed
    Bad,
    /// Reading quality is uncertain (sensor drift, communication issues, etc.)
    Uncertain,
}

impl fmt::Display for ReadingQuality {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ReadingQuality::Good => write!(f, "Good"),
            ReadingQuality::Bad => write!(f, "Bad"),
            ReadingQuality::Uncertain => write!(f, "Uncertain"),
        }
    }
}

/// Protocol-specific errors with enhanced context and retry categorization
#[derive(Error, Debug)]
pub enum ProtocolError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Not connected to device")]
    NotConnected,

    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),

    #[error("Subscription failed: {0}")]
    SubscriptionFailed(String),

    #[error("Read operation failed: {0}")]
    ReadFailed(String),

    #[error("Invalid address or node ID: {0}")]
    InvalidAddress(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),

    #[error("Unsupported protocol: {0}")]
    UnsupportedProtocol(String),

    #[error("Protocol-specific error: {0}")]
    ProtocolSpecific(String),

    #[error("Timeout waiting for response")]
    Timeout,

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl ProtocolError {
    /// Check if error is retryable (transient network issue, timeout, etc.)
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ProtocolError::ConnectionFailed(_)
                | ProtocolError::NotConnected
                | ProtocolError::Timeout
                | ProtocolError::IoError(_)
                | ProtocolError::ReadFailed(_)
        )
    }

    /// Check if error is a fatal configuration issue (should not retry)
    pub fn is_fatal(&self) -> bool {
        matches!(
            self,
            ProtocolError::AuthenticationFailed(_)
                | ProtocolError::InvalidConfiguration(_)
                | ProtocolError::UnsupportedProtocol(_)
                | ProtocolError::InvalidAddress(_)
        )
    }

    /// Get error category for logging/metrics
    pub fn category(&self) -> ErrorCategory {
        match self {
            ProtocolError::ConnectionFailed(_) | ProtocolError::NotConnected => {
                ErrorCategory::Network
            }
            ProtocolError::AuthenticationFailed(_) => ErrorCategory::Auth,
            ProtocolError::InvalidConfiguration(_)
            | ProtocolError::InvalidAddress(_)
            | ProtocolError::UnsupportedProtocol(_) => ErrorCategory::Config,
            ProtocolError::ReadFailed(_)
            | ProtocolError::SubscriptionFailed(_)
            | ProtocolError::ProtocolSpecific(_) => ErrorCategory::Protocol,
            ProtocolError::Timeout => ErrorCategory::Timeout,
            ProtocolError::IoError(_) => ErrorCategory::Io,
        }
    }
}

/// Error category for classification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCategory {
    Network,
    Auth,
    Config,
    Protocol,
    Timeout,
    Io,
}

/// Connection configuration (protocol-agnostic)
#[derive(Debug, Clone)]
pub struct ConnectionConfig {
    pub connection_id: Uuid,
    pub tenant_id: Uuid,
    pub endpoint_url: String,
    pub security_mode: Option<String>,
    pub security_policy: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    // Modbus-specific
    pub slave_id: Option<u8>,
    // MQTT-specific
    pub client_id: Option<String>,
    pub qos: Option<u8>,
}

/// Tag mapping configuration
#[derive(Debug, Clone)]
pub struct TagMapping {
    pub tag_id: Uuid,
    pub tenant_id: Uuid,
    pub well_id: Uuid,
    pub tag_name: String,
    /// Protocol-specific address (OPC-UA node ID, Modbus register address, MQTT topic, etc.)
    pub address: String,
    pub data_type: String,
}

/// Protocol adapter trait - all protocols must implement this
#[async_trait]
pub trait ProtocolAdapter: Send + Sync {
    /// Connect to the remote device
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError>;

    /// Subscribe to tags (for protocols that support subscriptions like OPC-UA, MQTT)
    /// For polling protocols (Modbus), this just stores the tag list for later polling
    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError>;

    /// Poll for new readings (blocking for subscription-based protocols, active for polling protocols)
    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError>;

    /// Disconnect gracefully from the device
    async fn disconnect(&mut self) -> Result<(), ProtocolError>;

    /// Get protocol name (for logging/debugging)
    fn protocol_name(&self) -> &str;

    /// Check if adapter is currently connected
    fn is_connected(&self) -> bool;
}
