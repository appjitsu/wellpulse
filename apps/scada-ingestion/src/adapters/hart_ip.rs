//! HART-IP protocol adapter
//!
//! Implements the ProtocolAdapter trait for HART-IP connections.
//! HART-IP (Highway Addressable Remote Transducer over IP) is used for:
//! - Smart instrumentation (Rosemount, Emerson transmitters)
//! - Process control devices
//! - Pressure, temperature, flow transmitters
//! - Level sensors
//!
//! Uses UDP (port 5094 default) for communication with HART-enabled devices.

use super::{
    ConnectionConfig, ProtocolAdapter, ProtocolError, ProtocolReading, ReadingQuality, TagMapping,
};
use async_trait::async_trait;
use chrono::Utc;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

/// HART-IP default port
const HART_IP_PORT: u16 = 5094;

/// HART-IP message types
#[allow(dead_code)]
const HART_MSG_TYPE_REQUEST: u8 = 0x00;
#[allow(dead_code)]
const HART_MSG_TYPE_RESPONSE: u8 = 0x01;
#[allow(dead_code)]
const HART_MSG_TYPE_PUBLISH: u8 = 0x02;

/// HART-IP commands
#[allow(dead_code)]
const HART_CMD_READ_UNIQUE_ID: u8 = 0x00;
#[allow(dead_code)]
const HART_CMD_READ_PRIMARY_VARIABLE: u8 = 0x01;
#[allow(dead_code)]
const HART_CMD_READ_CURRENT_AND_PERCENT: u8 = 0x02;
#[allow(dead_code)]
const HART_CMD_READ_DYNAMIC_VARIABLES: u8 = 0x03;

pub struct HartIpAdapter {
    socket: Option<Arc<Mutex<UdpSocket>>>,
    endpoint: Option<SocketAddr>,
    config: Option<ConnectionConfig>,
    tags: Vec<TagMapping>,
}

impl HartIpAdapter {
    pub fn new() -> Self {
        Self {
            socket: None,
            endpoint: None,
            config: None,
            tags: Vec::new(),
        }
    }

    /// Parse HART-IP specific address from tag address string
    /// Format: "PV" for Primary Variable, "SV" for Secondary Variable,
    ///         "TV" for Tertiary Variable, "QV" for Quaternary Variable
    ///         Or "CMD:3:0" for command 3, variable index 0
    fn parse_hart_address(address: &str) -> Result<HartVariable, ProtocolError> {
        match address.to_uppercase().as_str() {
            "PV" => Ok(HartVariable::PrimaryVariable),
            "SV" => Ok(HartVariable::SecondaryVariable),
            "TV" => Ok(HartVariable::TertiaryVariable),
            "QV" => Ok(HartVariable::QuaternaryVariable),
            _ => {
                // Try to parse as CMD:command:index
                let parts: Vec<&str> = address.split(':').collect();
                if parts.len() == 3 && parts[0].to_uppercase() == "CMD" {
                    let command = parts[1].parse::<u8>().map_err(|_| {
                        ProtocolError::InvalidAddress(format!("Invalid command: {}", parts[1]))
                    })?;
                    let index = parts[2].parse::<u8>().map_err(|_| {
                        ProtocolError::InvalidAddress(format!("Invalid index: {}", parts[2]))
                    })?;
                    Ok(HartVariable::Command(command, index))
                } else {
                    Err(ProtocolError::InvalidAddress(format!(
                        "Invalid HART address: {}",
                        address
                    )))
                }
            }
        }
    }

    /// Build HART-IP request message
    #[allow(dead_code)]
    fn build_hart_request(command: u8, device_address: u8) -> Vec<u8> {
        let mut message = Vec::new();

        // HART-IP header (8 bytes)
        message.push(0x01); // Version
        message.push(HART_MSG_TYPE_REQUEST); // Message type
        message.push(0x00); // Message ID (MSB)
        message.push(0x01); // Message ID (LSB)
        message.push(0x00); // Status
        message.push(0x00); // Sequence number (MSB)
        message.push(0x00); // Sequence number (LSB)
        message.push(0x05); // Byte count (5 bytes for minimal HART message)

        // HART message (5 bytes minimum)
        message.push(0x82); // Delimiter (short frame, master-to-slave)
        message.push(device_address); // Address
        message.push(command); // Command
        message.push(0x00); // Byte count (no data)
        message.push(Self::calculate_checksum(&message[8..])); // Checksum

        message
    }

    /// Calculate HART longitudinal parity checksum
    #[allow(dead_code)]
    fn calculate_checksum(data: &[u8]) -> u8 {
        data.iter().fold(0u8, |acc, &byte| acc ^ byte)
    }

    /// Parse HART-IP response message
    #[allow(dead_code)]
    fn parse_hart_response(response: &[u8]) -> Result<f64, ProtocolError> {
        if response.len() < 13 {
            return Err(ProtocolError::ReadFailed("Response too short".to_string()));
        }

        // Extract HART-IP header
        let msg_type = response[1];
        if msg_type != HART_MSG_TYPE_RESPONSE {
            return Err(ProtocolError::ReadFailed(format!(
                "Invalid message type: {}",
                msg_type
            )));
        }

        // Extract HART message data (skip 8-byte HART-IP header)
        let hart_msg = &response[8..];

        // Check response code (byte 2 of HART message)
        let response_code = hart_msg[2];
        if response_code != 0 {
            return Err(ProtocolError::ReadFailed(format!(
                "HART error response: {}",
                response_code
            )));
        }

        // Extract float value (IEEE 754 big-endian, typically starts at byte 9)
        if hart_msg.len() >= 13 {
            let value_bytes = &hart_msg[9..13];
            let value = f32::from_be_bytes([
                value_bytes[0],
                value_bytes[1],
                value_bytes[2],
                value_bytes[3],
            ]);
            Ok(value as f64)
        } else {
            Err(ProtocolError::ReadFailed(
                "Response data too short".to_string(),
            ))
        }
    }
}

#[derive(Debug, Clone)]
enum HartVariable {
    PrimaryVariable,
    SecondaryVariable,
    TertiaryVariable,
    QuaternaryVariable,
    Command(u8, u8), // (command, variable_index)
}

#[async_trait]
impl ProtocolAdapter for HartIpAdapter {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError> {
        info!(
            connection_id = %config.connection_id,
            endpoint = %config.endpoint_url,
            "Connecting to HART-IP device"
        );

        // Parse endpoint URL (host:port or just host, default to 5094)
        let endpoint = if config.endpoint_url.contains(':') {
            config.endpoint_url.parse::<SocketAddr>().map_err(|e| {
                ProtocolError::InvalidConfiguration(format!("Invalid socket address: {}", e))
            })?
        } else {
            // Just hostname, add default port
            format!("{}:{}", config.endpoint_url, HART_IP_PORT)
                .parse::<SocketAddr>()
                .map_err(|e| {
                    ProtocolError::InvalidConfiguration(format!("Invalid socket address: {}", e))
                })?
        };

        // NOTE: MVP implementation - HART-IP connection is stubbed
        // Real HART-IP devices don't exist in development environment
        debug!(
            endpoint = %endpoint,
            "Skipping actual HART-IP connection (MVP stub - awaiting test infrastructure)"
        );

        // In production, this would be:
        /*
        let socket = UdpSocket::bind("0.0.0.0:0").await.map_err(|e| {
            ProtocolError::ConnectionFailed(format!("Failed to bind UDP socket: {}", e))
        })?;

        socket.connect(endpoint).await.map_err(|e| {
            ProtocolError::ConnectionFailed(format!("Failed to connect to HART-IP device: {}", e))
        })?;

        // Send discovery/ping message to verify connection
        let ping = Self::build_hart_request(HART_CMD_READ_UNIQUE_ID, 0);
        socket.send(&ping).await.map_err(|e| {
            ProtocolError::ConnectionFailed(format!("Failed to send to HART-IP device: {}", e))
        })?;

        self.socket = Some(Arc::new(Mutex::new(socket)));
        */

        self.endpoint = Some(endpoint);
        self.config = Some(config.clone());

        info!(
            connection_id = %config.connection_id,
            "HART-IP adapter connected (stub implementation)"
        );

        Ok(())
    }

    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError> {
        // HART-IP uses polling, so we just store tags for later polling
        debug!(
            tag_count = tags.len(),
            "Configuring HART-IP tags for polling"
        );

        // Validate all tag addresses
        for tag in &tags {
            Self::parse_hart_address(&tag.address).map_err(|e| {
                ProtocolError::InvalidConfiguration(format!(
                    "Invalid HART address for tag {}: {}",
                    tag.tag_name, e
                ))
            })?;

            debug!(
                tag_name = %tag.tag_name,
                address = %tag.address,
                "Validated HART-IP tag address"
            );
        }

        self.tags = tags;

        info!(
            tag_count = self.tags.len(),
            "HART-IP tags configured for polling"
        );

        Ok(())
    }

    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError> {
        if self.config.is_none() {
            return Err(ProtocolError::NotConnected);
        }

        let _config = self.config.as_ref().unwrap();
        let readings = Vec::new();

        // TODO: In production, poll each HART variable from the device
        // For MVP stub, we'll just log what we would poll
        for tag in &self.tags {
            let variable = Self::parse_hart_address(&tag.address).map_err(|e| {
                ProtocolError::ReadFailed(format!("Failed to parse address: {}", e))
            })?;

            debug!(
                tag_name = %tag.tag_name,
                variable = ?variable,
                "Would poll HART-IP variable"
            );

            // In production, this would be:
            /*
            let socket = self.socket.as_ref()
                .ok_or(ProtocolError::NotConnected)?;

            let command = match variable {
                HartVariable::PrimaryVariable => HART_CMD_READ_PRIMARY_VARIABLE,
                HartVariable::SecondaryVariable |
                HartVariable::TertiaryVariable |
                HartVariable::QuaternaryVariable => HART_CMD_READ_DYNAMIC_VARIABLES,
                HartVariable::Command(cmd, _) => cmd,
            };

            let request = Self::build_hart_request(command, 0);

            let mut socket_guard = socket.lock().await;
            socket_guard.send(&request).await.map_err(|e| {
                ProtocolError::ReadFailed(format!("Failed to send HART request: {}", e))
            })?;

            // Wait for response with timeout
            let mut response_buf = vec![0u8; 1024];
            let len = tokio::time::timeout(
                Duration::from_millis(1000),
                socket_guard.recv(&mut response_buf),
            )
            .await
            .map_err(|_| ProtocolError::Timeout)?
            .map_err(|e| {
                ProtocolError::ReadFailed(format!("Failed to receive HART response: {}", e))
            })?;

            drop(socket_guard);

            let value = Self::parse_hart_response(&response_buf[..len])?;

            readings.push(ProtocolReading {
                timestamp: Utc::now(),
                tenant_id: tag.tenant_id,
                well_id: tag.well_id,
                tag_name: tag.tag_name.clone(),
                value,
                quality: ReadingQuality::Good, // HART-IP quality would need mapping
                source_protocol: "HART-IP".to_string(),
            });
            */
        }

        Ok(readings)
    }

    async fn disconnect(&mut self) -> Result<(), ProtocolError> {
        info!("Disconnecting from HART-IP device");

        self.socket = None;
        self.endpoint = None;
        self.config = None;

        info!("HART-IP adapter disconnected");

        Ok(())
    }

    fn protocol_name(&self) -> &str {
        "HART-IP"
    }

    fn is_connected(&self) -> bool {
        self.config.is_some()
    }
}

impl Default for HartIpAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_primary_variable() {
        let var = HartIpAdapter::parse_hart_address("PV").unwrap();
        assert!(matches!(var, HartVariable::PrimaryVariable));
    }

    #[test]
    fn test_parse_secondary_variable() {
        let var = HartIpAdapter::parse_hart_address("SV").unwrap();
        assert!(matches!(var, HartVariable::SecondaryVariable));
    }

    #[test]
    fn test_parse_command_format() {
        let var = HartIpAdapter::parse_hart_address("CMD:3:0").unwrap();
        match var {
            HartVariable::Command(cmd, idx) => {
                assert_eq!(cmd, 3);
                assert_eq!(idx, 0);
            }
            _ => panic!("Expected Command variant"),
        }
    }

    #[test]
    fn test_parse_invalid_address() {
        assert!(HartIpAdapter::parse_hart_address("INVALID").is_err());
        assert!(HartIpAdapter::parse_hart_address("CMD:abc:0").is_err());
    }

    #[test]
    fn test_calculate_checksum() {
        let data = vec![0x82, 0x00, 0x01, 0x00];
        let checksum = HartIpAdapter::calculate_checksum(&data);
        assert_eq!(checksum, 0x83);
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = HartIpAdapter::new();
        assert_eq!(adapter.protocol_name(), "HART-IP");
        assert!(!adapter.is_connected());
    }

    #[tokio::test]
    async fn test_connect_stub() {
        let mut adapter = HartIpAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "192.168.1.100:5094".to_string(),
            security_mode: None,
            security_policy: None,
            username: None,
            password: None,
            slave_id: None,
            client_id: None,
            qos: None,
        };

        let result = adapter.connect(&config).await;
        assert!(result.is_ok());
        assert!(adapter.is_connected());
    }

    #[tokio::test]
    async fn test_subscribe_validates_addresses() {
        let mut adapter = HartIpAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "192.168.1.100:5094".to_string(),
            security_mode: None,
            security_policy: None,
            username: None,
            password: None,
            slave_id: None,
            client_id: None,
            qos: None,
        };

        adapter.connect(&config).await.unwrap();

        let tenant_id = Uuid::new_v4();
        let well_id = Uuid::new_v4();

        // Valid addresses
        let tags = vec![
            TagMapping {
                tag_id: Uuid::new_v4(),
                tenant_id,
                well_id,
                tag_name: "pressure".to_string(),
                address: "PV".to_string(),
                data_type: "float".to_string(),
            },
            TagMapping {
                tag_id: Uuid::new_v4(),
                tenant_id,
                well_id,
                tag_name: "temperature".to_string(),
                address: "SV".to_string(),
                data_type: "float".to_string(),
            },
        ];

        let result = adapter.subscribe(tags).await;
        assert!(result.is_ok());

        // Invalid address
        let invalid_tags = vec![TagMapping {
            tag_id: Uuid::new_v4(),
            tenant_id,
            well_id,
            tag_name: "invalid".to_string(),
            address: "INVALID_ADDRESS".to_string(),
            data_type: "float".to_string(),
        }];

        let result = adapter.subscribe(invalid_tags).await;
        assert!(result.is_err());
    }
}
