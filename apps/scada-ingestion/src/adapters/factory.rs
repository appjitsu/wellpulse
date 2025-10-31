//! Adapter factory for creating protocol adapters based on protocol type

use super::{
    dnp3::Dnp3Adapter, ethernet_ip::EtherNetIpAdapter, hart_ip::HartIpAdapter,
    modbus_rtu::ModbusRtuAdapter, modbus_tcp::ModbusTcpAdapter, mqtt::MqttAdapter,
    opcua::OpcUaAdapter, ProtocolAdapter, ProtocolError,
};
use tracing::info;

/// Factory for creating protocol adapters
pub struct AdapterFactory;

impl AdapterFactory {
    /// Create an adapter instance based on protocol type
    pub fn create_adapter(protocol: &str) -> Result<Box<dyn ProtocolAdapter>, ProtocolError> {
        info!(protocol = protocol, "Creating protocol adapter");

        match protocol.to_uppercase().as_str() {
            "OPC-UA" | "OPCUA" | "OPC_UA" => Ok(Box::new(OpcUaAdapter::new())),
            "MODBUS-TCP" | "MODBUS_TCP" | "MODBUSTCP" => Ok(Box::new(ModbusTcpAdapter::new())),
            "MODBUS-RTU" | "MODBUS_RTU" | "MODBUSRTU" => Ok(Box::new(ModbusRtuAdapter::new())),
            "MQTT" => Ok(Box::new(MqttAdapter::new())),
            "DNP3" => Ok(Box::new(Dnp3Adapter::new())),
            "HART-IP" | "HART_IP" | "HARTIP" => Ok(Box::new(HartIpAdapter::new())),
            "ETHERNET-IP" | "ETHERNET_IP" | "ETHERNETIP" | "EIP" => {
                Ok(Box::new(EtherNetIpAdapter::new()))
            }
            _ => Err(ProtocolError::UnsupportedProtocol(protocol.to_string())),
        }
    }

    /// Get list of supported protocols
    pub fn supported_protocols() -> Vec<&'static str> {
        vec![
            "OPC-UA",
            "Modbus-TCP",
            "Modbus-RTU",
            "MQTT",
            "DNP3",
            "HART-IP",
            "EtherNet/IP",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_opcua_adapter() {
        let adapter = AdapterFactory::create_adapter("OPC-UA");
        assert!(adapter.is_ok());
        assert_eq!(adapter.unwrap().protocol_name(), "OPC-UA");
    }

    #[test]
    fn test_create_modbus_tcp_adapter() {
        let adapter = AdapterFactory::create_adapter("Modbus-TCP");
        assert!(adapter.is_ok());
        assert_eq!(adapter.unwrap().protocol_name(), "Modbus-TCP");
    }

    #[test]
    fn test_create_mqtt_adapter() {
        let adapter = AdapterFactory::create_adapter("MQTT");
        assert!(adapter.is_ok());
        assert_eq!(adapter.unwrap().protocol_name(), "MQTT");
    }

    #[test]
    fn test_unsupported_protocol() {
        let adapter = AdapterFactory::create_adapter("UNKNOWN");
        assert!(adapter.is_err());
        match adapter {
            Err(ProtocolError::UnsupportedProtocol(_)) => {}
            _ => panic!("Expected UnsupportedProtocol error"),
        }
    }

    #[test]
    fn test_case_insensitive() {
        assert!(AdapterFactory::create_adapter("opc-ua").is_ok());
        assert!(AdapterFactory::create_adapter("OPCUA").is_ok());
        assert!(AdapterFactory::create_adapter("mqtt").is_ok());
    }
}
