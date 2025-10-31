//! Modbus RTU protocol adapter
//!
//! Implements the ProtocolAdapter trait for Modbus RTU connections over serial (RS-485/RS-232).
//! Supports polling-based reading of holding registers, input registers, coils, and discrete inputs.

use super::{
    ConnectionConfig, ProtocolAdapter, ProtocolError, ProtocolReading, ReadingQuality, TagMapping,
};
use async_trait::async_trait;
use chrono::Utc;
use tracing::{debug, info};

pub struct ModbusRtuAdapter {
    // TODO: Implement with tokio-serial + tokio-modbus
    // context: Option<rtu::Context>,
    config: Option<ConnectionConfig>,
    tags: Vec<TagMapping>,
}

impl ModbusRtuAdapter {
    pub fn new() -> Self {
        Self {
            config: None,
            tags: Vec::new(),
        }
    }

    /// Parse Modbus address from tag address string (same as Modbus TCP)
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
impl ProtocolAdapter for ModbusRtuAdapter {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError> {
        info!(
            connection_id = %config.connection_id,
            endpoint = %config.endpoint_url,
            "Connecting to Modbus RTU device"
        );

        // Parse serial port configuration from endpoint URL
        // Format: "/dev/ttyUSB0" or "COM3" (Windows)
        let serial_port = &config.endpoint_url;

        debug!(
            serial_port = %serial_port,
            slave_id = ?config.slave_id,
            "Parsing serial port configuration"
        );

        // TODO: Actual serial port connection
        // For MVP, we'll create a stub
        debug!("Skipping actual Modbus RTU connection (MVP stub)");

        // In production, this would be:
        /*
        use tokio_serial::SerialPortBuilderExt;
        use tokio_modbus::prelude::*;

        let builder = tokio_serial::new(serial_port, 9600) // Baud rate
            .data_bits(tokio_serial::DataBits::Eight)
            .parity(tokio_serial::Parity::None)
            .stop_bits(tokio_serial::StopBits::One)
            .flow_control(tokio_serial::FlowControl::None);

        let port = builder.open_native_async()
            .map_err(|e| ProtocolError::ConnectionFailed(format!("Failed to open serial port: {}", e)))?;

        let slave_id = config.slave_id
            .ok_or_else(|| ProtocolError::InvalidConfiguration("Missing slave_id for Modbus RTU".to_string()))?;

        let context = rtu::connect_slave(port, Slave(slave_id)).await
            .map_err(|e| ProtocolError::ConnectionFailed(format!("Modbus RTU connection failed: {}", e)))?;

        self.context = Some(context);
        */

        self.config = Some(config.clone());

        info!(
            connection_id = %config.connection_id,
            "Modbus RTU adapter connected (stub implementation)"
        );

        Ok(())
    }

    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError> {
        // Modbus doesn't support subscriptions - store tags for polling
        debug!(
            tag_count = tags.len(),
            "Storing Modbus RTU tags for polling"
        );

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
                "Validated Modbus RTU tag address"
            );
        }

        self.tags = tags;

        info!(
            tag_count = self.tags.len(),
            "Modbus RTU tags configured for polling"
        );

        Ok(())
    }

    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError> {
        if self.config.is_none() {
            return Err(ProtocolError::NotConnected);
        }

        let _config = self.config.as_ref().unwrap();
        let _now = Utc::now();
        let readings = Vec::new();

        // TODO: In production, poll each tag from the actual Modbus RTU device
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
                "Would poll Modbus RTU tag"
            );

            // In production, this would be similar to Modbus TCP:
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
                source_protocol: "Modbus-RTU".to_string(),
            });
            */
        }

        Ok(readings)
    }

    async fn disconnect(&mut self) -> Result<(), ProtocolError> {
        info!("Disconnecting from Modbus RTU device");

        // Serial port disconnection happens when context is dropped
        self.config = None;

        info!("Modbus RTU adapter disconnected");

        Ok(())
    }

    fn protocol_name(&self) -> &str {
        "Modbus-RTU"
    }

    fn is_connected(&self) -> bool {
        self.config.is_some()
    }
}

impl Default for ModbusRtuAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_addresses() {
        // Same address parsing logic as Modbus TCP
        let (register_type, addr) = ModbusRtuAdapter::parse_modbus_address("40001").unwrap();
        assert!(matches!(register_type, RegisterType::HoldingRegister));
        assert_eq!(addr, 0);

        let (register_type, addr) = ModbusRtuAdapter::parse_modbus_address("30001").unwrap();
        assert!(matches!(register_type, RegisterType::InputRegister));
        assert_eq!(addr, 0);
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = ModbusRtuAdapter::new();
        assert_eq!(adapter.protocol_name(), "Modbus-RTU");
        assert!(!adapter.is_connected());
    }

    #[tokio::test]
    async fn test_connect_stub() {
        let mut adapter = ModbusRtuAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "/dev/ttyUSB0".to_string(), // Linux serial port
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
    async fn test_connect_windows_port() {
        let mut adapter = ModbusRtuAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "COM3".to_string(), // Windows serial port
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
        let mut adapter = ModbusRtuAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "/dev/ttyUSB0".to_string(),
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
        let tags = vec![TagMapping {
            tag_id: Uuid::new_v4(),
            tenant_id,
            well_id,
            tag_name: "pressure".to_string(),
            address: "40001".to_string(),
            data_type: "float".to_string(),
        }];

        let result = adapter.subscribe(tags).await;
        assert!(result.is_ok());

        // Invalid address
        let invalid_tags = vec![TagMapping {
            tag_id: Uuid::new_v4(),
            tenant_id,
            well_id,
            tag_name: "invalid".to_string(),
            address: "99999".to_string(),
            data_type: "float".to_string(),
        }];

        let result = adapter.subscribe(invalid_tags).await;
        assert!(result.is_err());
    }
}
