//! EtherNet/IP protocol adapter
//!
//! Implements the ProtocolAdapter trait for EtherNet/IP connections.
//! EtherNet/IP is CRITICAL for US Oil & Gas operations and is used by:
//! - Rockwell Automation (Allen-Bradley) PLCs
//! - ControlLogix, CompactLogix controllers
//! - PowerFlex drives
//! - Remote I/O modules
//!
//! Uses CIP (Common Industrial Protocol) over TCP/IP (port 44818/EtherNet/IP port).
//! Implements Class 3 explicit messaging for tag read/write operations.

use super::{
    ConnectionConfig, ProtocolAdapter, ProtocolError, ProtocolReading, ReadingQuality, TagMapping,
};
use async_trait::async_trait;
use chrono::Utc;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

/// EtherNet/IP default port
const ETHERNET_IP_PORT: u16 = 44818;

/// CIP encapsulation commands
#[allow(dead_code)]
const ENCAP_CMD_NOP: u16 = 0x0000;
#[allow(dead_code)]
const ENCAP_CMD_REGISTER_SESSION: u16 = 0x0065;
#[allow(dead_code)]
const ENCAP_CMD_UNREGISTER_SESSION: u16 = 0x0066;
#[allow(dead_code)]
const ENCAP_CMD_SEND_RR_DATA: u16 = 0x006F;

/// CIP service codes
#[allow(dead_code)]
const CIP_SERVICE_READ_TAG: u8 = 0x4C;
#[allow(dead_code)]
const CIP_SERVICE_WRITE_TAG: u8 = 0x4D;

pub struct EtherNetIpAdapter {
    stream: Option<Arc<Mutex<TcpStream>>>,
    session_handle: u32,
    config: Option<ConnectionConfig>,
    tags: Vec<TagMapping>,
}

impl EtherNetIpAdapter {
    pub fn new() -> Self {
        Self {
            stream: None,
            session_handle: 0,
            config: None,
            tags: Vec::new(),
        }
    }

    /// Parse EtherNet/IP tag address
    /// Format: "Program:MainProgram.TagName" or just "TagName" for controller-scoped tags
    fn parse_ethernet_ip_address(address: &str) -> Result<String, ProtocolError> {
        if address.is_empty() {
            return Err(ProtocolError::InvalidAddress(
                "Address cannot be empty".to_string(),
            ));
        }

        // EtherNet/IP tag names can contain letters, numbers, underscores, and dots
        // Validate basic format
        let valid_chars = address
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '.' || c == ':');

        if !valid_chars {
            return Err(ProtocolError::InvalidAddress(format!(
                "Invalid characters in tag address: {}",
                address
            )));
        }

        Ok(address.to_string())
    }

    /// Build EtherNet/IP Register Session command
    #[allow(dead_code)]
    fn build_register_session() -> Vec<u8> {
        let mut packet = Vec::new();

        // Encapsulation header (24 bytes)
        packet.extend_from_slice(&ENCAP_CMD_REGISTER_SESSION.to_le_bytes()); // Command
        packet.extend_from_slice(&4u16.to_le_bytes()); // Length (4 bytes of data)
        packet.extend_from_slice(&0u32.to_le_bytes()); // Session handle (0 for register)
        packet.extend_from_slice(&0u32.to_le_bytes()); // Status
        packet.extend_from_slice(&[0u8; 8]); // Sender context (8 bytes)
        packet.extend_from_slice(&0u32.to_le_bytes()); // Options

        // Register Session data (4 bytes)
        packet.extend_from_slice(&1u16.to_le_bytes()); // Protocol version
        packet.extend_from_slice(&0u16.to_le_bytes()); // Options flags

        packet
    }

    /// Build EtherNet/IP Read Tag request
    #[allow(dead_code)]
    fn build_read_tag_request(session_handle: u32, tag_name: &str) -> Vec<u8> {
        let mut packet = Vec::new();

        // Encapsulation header (24 bytes)
        packet.extend_from_slice(&ENCAP_CMD_SEND_RR_DATA.to_le_bytes());
        packet.extend_from_slice(&0u16.to_le_bytes()); // Length (will be updated)
        packet.extend_from_slice(&session_handle.to_le_bytes());
        packet.extend_from_slice(&0u32.to_le_bytes()); // Status
        packet.extend_from_slice(&[0u8; 8]); // Sender context
        packet.extend_from_slice(&0u32.to_le_bytes()); // Options

        // CPF (Common Packet Format) items
        let cpf_start = packet.len();
        packet.extend_from_slice(&0u32.to_le_bytes()); // Interface handle
        packet.extend_from_slice(&0u16.to_le_bytes()); // Timeout
        packet.extend_from_slice(&2u16.to_le_bytes()); // Item count

        // CPF Item 1: Null address
        packet.extend_from_slice(&0u16.to_le_bytes()); // Type ID
        packet.extend_from_slice(&0u16.to_le_bytes()); // Length

        // CPF Item 2: Unconnected data item
        packet.extend_from_slice(&0xB2u16.to_le_bytes()); // Type ID
        packet.extend_from_slice(&0u16.to_le_bytes()); // Length (will be updated)

        let cip_start = packet.len();

        // CIP Read Tag Service request
        packet.push(CIP_SERVICE_READ_TAG);
        packet.push(tag_name.len() as u8 / 2 + 1); // Path size in 16-bit words

        // Encode tag name as EPATH
        for byte in tag_name.as_bytes() {
            packet.push(*byte);
        }
        // Pad to even length
        if tag_name.len() % 2 != 0 {
            packet.push(0);
        }

        packet.extend_from_slice(&1u16.to_le_bytes()); // Number of elements to read

        // Update lengths
        let cip_length = packet.len() - cip_start;
        let cpf_length = packet.len() - cpf_start;
        let total_length = cpf_length as u16;

        // Update CPF item 2 length
        let cip_len_pos = cip_start - 2;
        packet[cip_len_pos..cip_len_pos + 2].copy_from_slice(&(cip_length as u16).to_le_bytes());

        // Update encapsulation header length
        packet[2..4].copy_from_slice(&total_length.to_le_bytes());

        packet
    }

    /// Parse EtherNet/IP response
    #[allow(dead_code)]
    fn parse_ethernet_ip_response(response: &[u8]) -> Result<f64, ProtocolError> {
        if response.len() < 24 {
            return Err(ProtocolError::ReadFailed("Response too short".to_string()));
        }

        // Check encapsulation status
        let status = u32::from_le_bytes([response[8], response[9], response[10], response[11]]);
        if status != 0 {
            return Err(ProtocolError::ReadFailed(format!(
                "EtherNet/IP error: 0x{:08X}",
                status
            )));
        }

        // Parse CPF and CIP data (simplified - full implementation would need more parsing)
        // For now, assume data starts at byte 50 (after headers)
        if response.len() >= 54 {
            // Try to extract 32-bit float (REAL type in CIP)
            let value_bytes = &response[50..54];
            let value = f32::from_le_bytes([
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

#[async_trait]
impl ProtocolAdapter for EtherNetIpAdapter {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError> {
        info!(
            connection_id = %config.connection_id,
            endpoint = %config.endpoint_url,
            "Connecting to EtherNet/IP PLC"
        );

        // Parse endpoint URL (host:port or just host, default to 44818)
        let endpoint = if config.endpoint_url.contains(':') {
            config.endpoint_url.parse::<SocketAddr>().map_err(|e| {
                ProtocolError::InvalidConfiguration(format!("Invalid socket address: {}", e))
            })?
        } else {
            // Just hostname, add default port
            format!("{}:{}", config.endpoint_url, ETHERNET_IP_PORT)
                .parse::<SocketAddr>()
                .map_err(|e| {
                    ProtocolError::InvalidConfiguration(format!("Invalid socket address: {}", e))
                })?
        };

        // NOTE: MVP implementation - EtherNet/IP connection is stubbed
        // Real EtherNet/IP PLCs don't exist in development environment
        debug!(
            endpoint = %endpoint,
            "Skipping actual EtherNet/IP connection (MVP stub - awaiting test infrastructure)"
        );

        // In production, this would be:
        /*
        let stream = TcpStream::connect(endpoint).await.map_err(|e| {
            ProtocolError::ConnectionFailed(format!("Failed to connect to PLC: {}", e))
        })?;

        let stream = Arc::new(Mutex::new(stream));

        // Register session
        let register_packet = Self::build_register_session();
        {
            let mut stream_guard = stream.lock().await;
            stream_guard.write_all(&register_packet).await.map_err(|e| {
                ProtocolError::ConnectionFailed(format!("Failed to send register: {}", e))
            })?;

            // Read response
            let mut response = vec![0u8; 1024];
            let len = stream_guard.read(&mut response).await.map_err(|e| {
                ProtocolError::ConnectionFailed(format!("Failed to read register response: {}", e))
            })?;

            // Extract session handle from response (bytes 4-7)
            if len >= 8 {
                let session_handle = u32::from_le_bytes([
                    response[4],
                    response[5],
                    response[6],
                    response[7],
                ]);
                self.session_handle = session_handle;
            } else {
                return Err(ProtocolError::ConnectionFailed(
                    "Invalid register response".to_string(),
                ));
            }
        }

        self.stream = Some(stream);
        */

        self.session_handle = 0x12345678; // Stub session handle
        self.config = Some(config.clone());

        info!(
            connection_id = %config.connection_id,
            "EtherNet/IP adapter connected (stub implementation)"
        );

        Ok(())
    }

    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError> {
        // EtherNet/IP uses polling (explicit messaging), so we just store tags
        debug!(
            tag_count = tags.len(),
            "Configuring EtherNet/IP tags for polling"
        );

        // Validate all tag addresses
        for tag in &tags {
            Self::parse_ethernet_ip_address(&tag.address).map_err(|e| {
                ProtocolError::InvalidConfiguration(format!(
                    "Invalid EtherNet/IP address for tag {}: {}",
                    tag.tag_name, e
                ))
            })?;

            debug!(
                tag_name = %tag.tag_name,
                address = %tag.address,
                "Validated EtherNet/IP tag address"
            );
        }

        self.tags = tags;

        info!(
            tag_count = self.tags.len(),
            "EtherNet/IP tags configured for polling"
        );

        Ok(())
    }

    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError> {
        if self.config.is_none() {
            return Err(ProtocolError::NotConnected);
        }

        let _config = self.config.as_ref().unwrap();
        let readings = Vec::new();

        // TODO: In production, read each tag from the PLC
        // For MVP stub, we'll just log what we would poll
        for tag in &self.tags {
            let tag_address = Self::parse_ethernet_ip_address(&tag.address).map_err(|e| {
                ProtocolError::ReadFailed(format!("Failed to parse address: {}", e))
            })?;

            debug!(
                tag_name = %tag.tag_name,
                address = %tag_address,
                "Would poll EtherNet/IP tag"
            );

            // In production, this would be:
            /*
            let stream = self.stream.as_ref()
                .ok_or(ProtocolError::NotConnected)?;

            let request = Self::build_read_tag_request(self.session_handle, &tag_address);

            let mut stream_guard = stream.lock().await;
            stream_guard.write_all(&request).await.map_err(|e| {
                ProtocolError::ReadFailed(format!("Failed to send read request: {}", e))
            })?;

            // Read response with timeout
            let mut response = vec![0u8; 1024];
            let len = tokio::time::timeout(
                Duration::from_millis(1000),
                stream_guard.read(&mut response),
            )
            .await
            .map_err(|_| ProtocolError::Timeout)?
            .map_err(|e| {
                ProtocolError::ReadFailed(format!("Failed to read response: {}", e))
            })?;

            drop(stream_guard);

            let value = Self::parse_ethernet_ip_response(&response[..len])?;

            readings.push(ProtocolReading {
                timestamp: Utc::now(),
                tenant_id: tag.tenant_id,
                well_id: tag.well_id,
                tag_name: tag.tag_name.clone(),
                value,
                quality: ReadingQuality::Good,
                source_protocol: "EtherNet/IP".to_string(),
            });
            */
        }

        Ok(readings)
    }

    async fn disconnect(&mut self) -> Result<(), ProtocolError> {
        info!("Disconnecting from EtherNet/IP PLC");

        // In production, would send Unregister Session command
        self.stream = None;
        self.session_handle = 0;
        self.config = None;

        info!("EtherNet/IP adapter disconnected");

        Ok(())
    }

    fn protocol_name(&self) -> &str {
        "EtherNet/IP"
    }

    fn is_connected(&self) -> bool {
        self.config.is_some()
    }
}

impl Default for EtherNetIpAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_simple_tag() {
        let address = EtherNetIpAdapter::parse_ethernet_ip_address("MyTag").unwrap();
        assert_eq!(address, "MyTag");
    }

    #[test]
    fn test_parse_program_scoped_tag() {
        let address =
            EtherNetIpAdapter::parse_ethernet_ip_address("Program:MainProgram.MyTag").unwrap();
        assert_eq!(address, "Program:MainProgram.MyTag");
    }

    #[test]
    fn test_parse_nested_structure() {
        let address = EtherNetIpAdapter::parse_ethernet_ip_address("MyUDT.SubField.Value").unwrap();
        assert_eq!(address, "MyUDT.SubField.Value");
    }

    #[test]
    fn test_parse_invalid_characters() {
        assert!(EtherNetIpAdapter::parse_ethernet_ip_address("Tag@Name").is_err());
        assert!(EtherNetIpAdapter::parse_ethernet_ip_address("Tag Name").is_err());
    }

    #[test]
    fn test_parse_empty_address() {
        assert!(EtherNetIpAdapter::parse_ethernet_ip_address("").is_err());
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = EtherNetIpAdapter::new();
        assert_eq!(adapter.protocol_name(), "EtherNet/IP");
        assert!(!adapter.is_connected());
    }

    #[tokio::test]
    async fn test_connect_stub() {
        let mut adapter = EtherNetIpAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "192.168.1.10:44818".to_string(),
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
        let mut adapter = EtherNetIpAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "192.168.1.10:44818".to_string(),
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
                address: "WellData.Pressure".to_string(),
                data_type: "REAL".to_string(),
            },
            TagMapping {
                tag_id: Uuid::new_v4(),
                tenant_id,
                well_id,
                tag_name: "flow_rate".to_string(),
                address: "Program:MainProgram.FlowRate".to_string(),
                data_type: "REAL".to_string(),
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
            address: "Tag@Invalid".to_string(),
            data_type: "REAL".to_string(),
        }];

        let result = adapter.subscribe(invalid_tags).await;
        assert!(result.is_err());
    }
}
