//! Modbus TCP protocol adapter
//!
//! Implements the ProtocolAdapter trait for Modbus TCP connections.
//! Supports polling-based reading of holding registers, input registers, coils, and discrete inputs.

use super::{
    ConnectionConfig, ProtocolAdapter, ProtocolError, ProtocolReading, ReadingQuality, TagMapping,
};
use async_trait::async_trait;
use chrono::Utc;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_modbus::prelude::*;
use tracing::{debug, info, warn};

pub struct ModbusTcpAdapter {
    context: Option<Arc<Mutex<client::Context>>>,
    config: Option<ConnectionConfig>,
    tags: Vec<TagMapping>,
}

impl ModbusTcpAdapter {
    pub fn new() -> Self {
        Self {
            context: None,
            config: None,
            tags: Vec::new(),
        }
    }

    /// Parse Modbus address from tag address string
    /// Format: "40001" for holding register 1, "30001" for input register 1, etc.
    /// Modbus address ranges:
    /// - 00001-09999: Coils (outputs)
    /// - 10001-19999: Discrete Inputs (inputs)
    /// - 30001-39999: Input Registers (analog inputs)
    /// - 40001-49999: Holding Registers (analog outputs/configuration)
    fn parse_modbus_address(address: &str) -> Result<(RegisterType, u16), ProtocolError> {
        let addr = address
            .parse::<u32>()
            .map_err(|_| ProtocolError::InvalidAddress(format!("Invalid address: {}", address)))?;

        let (register_type, register_addr) = match addr {
            1..=9999 => (RegisterType::Coil, (addr - 1) as u16),
            10001..=19999 => (RegisterType::DiscreteInput, (addr - 10001) as u16),
            30001..=39999 => (RegisterType::InputRegister, (addr - 30001) as u16),
            40001..=49999 => (RegisterType::HoldingRegister, (addr - 40001) as u16),
            _ => {
                return Err(ProtocolError::InvalidAddress(format!(
                    "Address out of range: {}",
                    address
                )))
            }
        };

        Ok((register_type, register_addr))
    }
}

#[derive(Debug, Clone, Copy)]
enum RegisterType {
    Coil,
    DiscreteInput,
    InputRegister,
    HoldingRegister,
}

#[async_trait]
impl ProtocolAdapter for ModbusTcpAdapter {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError> {
        info!(
            connection_id = %config.connection_id,
            endpoint = %config.endpoint_url,
            "Connecting to Modbus TCP device"
        );

        // Parse socket address from endpoint URL
        let socket_addr = config.endpoint_url.parse::<SocketAddr>().map_err(|e| {
            ProtocolError::InvalidConfiguration(format!("Invalid socket address: {}", e))
        })?;

        // TODO: Actual connection to Modbus TCP device
        // For MVP, we'll create a stub context
        debug!(
            socket_addr = %socket_addr,
            "Skipping actual Modbus TCP connection (MVP stub)"
        );

        // In production, this would be:
        // let context = tcp::connect(socket_addr).await.map_err(|e| {
        //     ProtocolError::ConnectionFailed(format!("Modbus TCP connection failed: {}", e))
        // })?;
        // self.context = Some(context);

        self.config = Some(config.clone());

        info!(
            connection_id = %config.connection_id,
            "Modbus TCP adapter connected (stub implementation)"
        );

        Ok(())
    }

    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError> {
        // Modbus doesn't support subscriptions - store tags for polling
        debug!(tag_count = tags.len(), "Storing Modbus tags for polling");

        // Validate all tag addresses
        for tag in &tags {
            Self::parse_modbus_address(&tag.address).map_err(|e| {
                ProtocolError::InvalidConfiguration(format!(
                    "Invalid Modbus address for tag {}: {}",
                    tag.tag_name, e
                ))
            })?;

            debug!(
                tag_name = %tag.tag_name,
                address = %tag.address,
                "Validated Modbus tag address"
            );
        }

        self.tags = tags;

        info!(
            tag_count = self.tags.len(),
            "Modbus TCP tags configured for polling"
        );

        Ok(())
    }

    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError> {
        if self.context.is_none() && self.config.is_none() {
            return Err(ProtocolError::NotConnected);
        }

        let _config = self.config.as_ref().unwrap();
        let _now = Utc::now();
        let readings = Vec::new();

        // TODO: In production, poll each tag from the actual Modbus device
        // For MVP stub, we'll just log what we would poll
        for tag in &self.tags {
            let (register_type, register_addr) =
                Self::parse_modbus_address(&tag.address).map_err(|e| {
                    ProtocolError::ReadFailed(format!("Failed to parse address: {}", e))
                })?;

            debug!(
                tag_name = %tag.tag_name,
                register_type = ?register_type,
                address = register_addr,
                "Would poll Modbus tag"
            );

            // In production, this would be:
            /*
            let context = self.context.as_mut().ok_or(ProtocolError::NotConnected)?;

            let value = match register_type {
                RegisterType::Coil => {
                    let coils = context.read_coils(register_addr, 1).await
                        .map_err(|e| ProtocolError::ReadFailed(format!("Failed to read coil: {}", e)))?;
                    if coils[0] { 1.0 } else { 0.0 }
                }
                RegisterType::DiscreteInput => {
                    let inputs = context.read_discrete_inputs(register_addr, 1).await
                        .map_err(|e| ProtocolError::ReadFailed(format!("Failed to read discrete input: {}", e)))?;
                    if inputs[0] { 1.0 } else { 0.0 }
                }
                RegisterType::InputRegister => {
                    let registers = context.read_input_registers(register_addr, 1).await
                        .map_err(|e| ProtocolError::ReadFailed(format!("Failed to read input register: {}", e)))?;
                    registers[0] as f64
                }
                RegisterType::HoldingRegister => {
                    let registers = context.read_holding_registers(register_addr, 1).await
                        .map_err(|e| ProtocolError::ReadFailed(format!("Failed to read holding register: {}", e)))?;
                    registers[0] as f64
                }
            };

            readings.push(ProtocolReading {
                timestamp: now,
                tenant_id: tag.tenant_id,
                well_id: tag.well_id,
                tag_name: tag.tag_name.clone(),
                value,
                quality: ReadingQuality::Good,
                source_protocol: "Modbus-TCP".to_string(),
            });
            */
        }

        Ok(readings)
    }

    async fn disconnect(&mut self) -> Result<(), ProtocolError> {
        info!("Disconnecting from Modbus TCP device");

        // Modbus TCP doesn't require explicit disconnect
        self.context = None;
        self.config = None;

        info!("Modbus TCP adapter disconnected");

        Ok(())
    }

    fn protocol_name(&self) -> &str {
        "Modbus-TCP"
    }

    fn is_connected(&self) -> bool {
        self.config.is_some()
    }
}

impl Default for ModbusTcpAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_coil_address() {
        let (register_type, addr) = ModbusTcpAdapter::parse_modbus_address("00001").unwrap();
        assert!(matches!(register_type, RegisterType::Coil));
        assert_eq!(addr, 0);

        let (register_type, addr) = ModbusTcpAdapter::parse_modbus_address("00100").unwrap();
        assert!(matches!(register_type, RegisterType::Coil));
        assert_eq!(addr, 99);
    }

    #[test]
    fn test_parse_discrete_input_address() {
        let (register_type, addr) = ModbusTcpAdapter::parse_modbus_address("10001").unwrap();
        assert!(matches!(register_type, RegisterType::DiscreteInput));
        assert_eq!(addr, 0);
    }

    #[test]
    fn test_parse_input_register_address() {
        let (register_type, addr) = ModbusTcpAdapter::parse_modbus_address("30001").unwrap();
        assert!(matches!(register_type, RegisterType::InputRegister));
        assert_eq!(addr, 0);
    }

    #[test]
    fn test_parse_holding_register_address() {
        let (register_type, addr) = ModbusTcpAdapter::parse_modbus_address("40001").unwrap();
        assert!(matches!(register_type, RegisterType::HoldingRegister));
        assert_eq!(addr, 0);

        let (register_type, addr) = ModbusTcpAdapter::parse_modbus_address("40100").unwrap();
        assert!(matches!(register_type, RegisterType::HoldingRegister));
        assert_eq!(addr, 99);
    }

    #[test]
    fn test_parse_invalid_address() {
        let result = ModbusTcpAdapter::parse_modbus_address("invalid");
        assert!(result.is_err());

        let result = ModbusTcpAdapter::parse_modbus_address("99999");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = ModbusTcpAdapter::new();
        assert_eq!(adapter.protocol_name(), "Modbus-TCP");
        assert!(!adapter.is_connected());
    }

    #[tokio::test]
    async fn test_connect_stub() {
        let mut adapter = ModbusTcpAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "127.0.0.1:502".to_string(),
            security_mode: None,
            security_policy: None,
            username: None,
            password: None,
            slave_id: Some(1),
            client_id: None,
            qos: None,
        };

        let result = adapter.connect(&config).await;
        assert!(result.is_ok());
        assert!(adapter.is_connected());
    }

    #[tokio::test]
    async fn test_subscribe_validates_addresses() {
        let mut adapter = ModbusTcpAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "127.0.0.1:502".to_string(),
            security_mode: None,
            security_policy: None,
            username: None,
            password: None,
            slave_id: Some(1),
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
                address: "40001".to_string(),
                data_type: "float".to_string(),
            },
            TagMapping {
                tag_id: Uuid::new_v4(),
                tenant_id,
                well_id,
                tag_name: "temperature".to_string(),
                address: "40002".to_string(),
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
            address: "invalid_address".to_string(),
            data_type: "float".to_string(),
        }];

        let result = adapter.subscribe(invalid_tags).await;
        assert!(result.is_err());
    }
}
