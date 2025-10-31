//! DNP3 protocol adapter
//!
//! Implements the ProtocolAdapter trait for DNP3 connections.
//! DNP3 (Distributed Network Protocol 3) is widely used in:
//! - SCADA systems (Emerson DeltaV, Honeywell)
//! - Electric utilities
//! - Water/wastewater treatment
//! - Oil & Gas upstream operations
//!
//! Supports master/outstation communication with polling-based data acquisition.

use super::{
    ConnectionConfig, ProtocolAdapter, ProtocolError, ProtocolReading, ReadingQuality, TagMapping,
};
use async_trait::async_trait;
use chrono::Utc;
// NOTE: DNP3 crate imports commented out for MVP stub
// When implementing full DNP3 support, uncomment and use dnp3 v1.6 API
// use dnp3::master::*;
// use dnp3::tcp::*;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

/// DNP3 adapter for master-side communication
pub struct Dnp3Adapter {
    // Stubbed - will hold actual dnp3::master::Channel when implemented
    _channel: Option<Arc<Mutex<()>>>,
    config: Option<ConnectionConfig>,
    tags: Vec<TagMapping>,
}

impl Dnp3Adapter {
    pub fn new() -> Self {
        Self {
            _channel: None,
            config: None,
            tags: Vec::new(),
        }
    }

    /// Parse DNP3-specific address from tag address string
    /// Format: "AI:0" for Analog Input 0, "BI:1" for Binary Input 1, etc.
    /// Point types:
    /// - AI: Analog Input
    /// - BI: Binary Input
    /// - AO: Analog Output
    /// - BO: Binary Output
    /// - C: Counter
    fn parse_dnp3_address(address: &str) -> Result<(Dnp3PointType, u16), ProtocolError> {
        let parts: Vec<&str> = address.split(':').collect();
        if parts.len() != 2 {
            return Err(ProtocolError::InvalidAddress(format!(
                "Invalid DNP3 address format: {} (expected 'TYPE:INDEX')",
                address
            )));
        }

        let point_type = match parts[0].to_uppercase().as_str() {
            "AI" => Dnp3PointType::AnalogInput,
            "BI" => Dnp3PointType::BinaryInput,
            "AO" => Dnp3PointType::AnalogOutput,
            "BO" => Dnp3PointType::BinaryOutput,
            "C" => Dnp3PointType::Counter,
            _ => {
                return Err(ProtocolError::InvalidAddress(format!(
                    "Unknown DNP3 point type: {}",
                    parts[0]
                )))
            }
        };

        let index = parts[1]
            .parse::<u16>()
            .map_err(|_| ProtocolError::InvalidAddress(format!("Invalid index: {}", parts[1])))?;

        Ok((point_type, index))
    }
}

#[derive(Debug, Clone, Copy)]
enum Dnp3PointType {
    AnalogInput,
    BinaryInput,
    AnalogOutput,
    BinaryOutput,
    Counter,
}

#[async_trait]
impl ProtocolAdapter for Dnp3Adapter {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError> {
        info!(
            connection_id = %config.connection_id,
            endpoint = %config.endpoint_url,
            "Connecting to DNP3 outstation"
        );

        // Parse socket address
        let socket_addr = config.endpoint_url.parse::<SocketAddr>().map_err(|e| {
            ProtocolError::InvalidConfiguration(format!("Invalid socket address: {}", e))
        })?;

        // DNP3 master and outstation addresses (default to 1 and 10)
        let _master_address = 1u16; // Will be EndpointAddress in full implementation
        let _outstation_address = config.slave_id.unwrap_or(10) as u16;

        // NOTE: MVP implementation - DNP3 connection is stubbed
        // Real DNP3 outstations don't exist in development environment
        debug!(
            socket_addr = %socket_addr,
            master_addr = _master_address,
            outstation_addr = _outstation_address,
            "Skipping actual DNP3 connection (MVP stub - awaiting test infrastructure)"
        );

        // In production, this would be:
        /*
        use dnp3::tcp::ClientState;
        use dnp3::app::Timeout;

        let mut runtime = tokio::runtime::Runtime::new().unwrap();

        let channel = runtime.block_on(async {
            dnp3::tcp::create_master_tcp_client(
                socket_addr,
                Timeout::from_millis(5000),
            ).await
        }).map_err(|e| {
            ProtocolError::ConnectionFailed(format!("DNP3 connection failed: {}", e))
        })?;

        let association_config = AssociationConfig {
            disable_unsol_classes: EventClasses::all(),
            enable_unsol_classes: EventClasses::none(),
            startup_integrity_classes: ClassSet::all(),
            event_scan_on_events_available: None,
            auto_time_sync: None,
            keep_alive_timeout: Some(Duration::from_secs(60)),
        };

        let association = channel.add_association(
            outstation_address,
            association_config,
            Box::new(NullReadHandler),
            Box::new(NullAssociationInformation),
        ).await.map_err(|e| {
            ProtocolError::ConnectionFailed(format!("DNP3 association failed: {}", e))
        })?;

        self.channel = Some(Arc::new(Mutex::new(channel)));
        self.association = Some(Arc::new(Mutex::new(association)));
        */

        self.config = Some(config.clone());

        info!(
            connection_id = %config.connection_id,
            "DNP3 adapter connected (stub implementation)"
        );

        Ok(())
    }

    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError> {
        // DNP3 uses polling (Class 0 scans), so we just store tags for later polling
        debug!(tag_count = tags.len(), "Configuring DNP3 tags for polling");

        // Validate all tag addresses
        for tag in &tags {
            Self::parse_dnp3_address(&tag.address).map_err(|e| {
                ProtocolError::InvalidConfiguration(format!(
                    "Invalid DNP3 address for tag {}: {}",
                    tag.tag_name, e
                ))
            })?;

            debug!(
                tag_name = %tag.tag_name,
                address = %tag.address,
                "Validated DNP3 tag address"
            );
        }

        self.tags = tags;

        info!(
            tag_count = self.tags.len(),
            "DNP3 tags configured for polling"
        );

        Ok(())
    }

    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError> {
        if self.config.is_none() {
            return Err(ProtocolError::NotConnected);
        }

        let _config = self.config.as_ref().unwrap();
        let readings = Vec::new();

        // TODO: In production, perform DNP3 Class 0 poll (integrity scan)
        // For MVP stub, we'll just log what we would poll
        for tag in &self.tags {
            let (point_type, index) = Self::parse_dnp3_address(&tag.address).map_err(|e| {
                ProtocolError::ReadFailed(format!("Failed to parse address: {}", e))
            })?;

            debug!(
                tag_name = %tag.tag_name,
                point_type = ?point_type,
                index = index,
                "Would poll DNP3 point"
            );

            // In production, this would be:
            /*
            let association = self.association.as_ref()
                .ok_or(ProtocolError::NotConnected)?;

            // Perform integrity scan (Class 0)
            let mut handler = CollectingReadHandler::new();
            association.lock().await.read(
                ReadRequest::new_all_objects(Variation::Group30Var1),
                &mut handler,
            ).await.map_err(|e| {
                ProtocolError::ReadFailed(format!("DNP3 read failed: {}", e))
            })?;

            // Extract value based on point type
            let value = match point_type {
                Dnp3PointType::AnalogInput => {
                    handler.analog_inputs.get(&index)
                        .map(|ai| ai.value as f64)
                        .unwrap_or(0.0)
                }
                Dnp3PointType::BinaryInput => {
                    handler.binary_inputs.get(&index)
                        .map(|bi| if bi.value { 1.0 } else { 0.0 })
                        .unwrap_or(0.0)
                }
                Dnp3PointType::Counter => {
                    handler.counters.get(&index)
                        .map(|c| c.value as f64)
                        .unwrap_or(0.0)
                }
                _ => 0.0,
            };

            let quality = match point_type {
                Dnp3PointType::AnalogInput => {
                    handler.analog_inputs.get(&index)
                        .map(|ai| map_dnp3_quality(ai.flags))
                        .unwrap_or(ReadingQuality::Bad)
                }
                Dnp3PointType::BinaryInput => {
                    handler.binary_inputs.get(&index)
                        .map(|bi| map_dnp3_quality(bi.flags))
                        .unwrap_or(ReadingQuality::Bad)
                }
                _ => ReadingQuality::Good,
            };

            readings.push(ProtocolReading {
                timestamp: Utc::now(),
                tenant_id: tag.tenant_id,
                well_id: tag.well_id,
                tag_name: tag.tag_name.clone(),
                value,
                quality,
                source_protocol: "DNP3".to_string(),
            });
            */
        }

        Ok(readings)
    }

    async fn disconnect(&mut self) -> Result<(), ProtocolError> {
        info!("Disconnecting from DNP3 outstation");

        // DNP3 channels are automatically closed when dropped
        self._channel = None;
        self.config = None;

        info!("DNP3 adapter disconnected");

        Ok(())
    }

    fn protocol_name(&self) -> &str {
        "DNP3"
    }

    fn is_connected(&self) -> bool {
        self.config.is_some()
    }
}

impl Default for Dnp3Adapter {
    fn default() -> Self {
        Self::new()
    }
}

/// Map DNP3 quality flags to ReadingQuality
#[allow(dead_code)] // Reserved for full DNP3 implementation
fn map_dnp3_quality(flags: u8) -> ReadingQuality {
    // DNP3 quality flag bits:
    // Bit 0: ONLINE (1 = online, 0 = offline)
    // Bit 4: COMM_LOST (1 = communication lost)
    // Bit 5: REMOTE_FORCED (1 = value is forced)
    // Bit 6: LOCAL_FORCED (1 = value is forced locally)

    const ONLINE: u8 = 0b0000_0001;
    const COMM_LOST: u8 = 0b0001_0000;
    const REMOTE_FORCED: u8 = 0b0010_0000;
    const LOCAL_FORCED: u8 = 0b0100_0000;

    if (flags & ONLINE) != 0 && (flags & (COMM_LOST | REMOTE_FORCED | LOCAL_FORCED)) == 0 {
        ReadingQuality::Good
    } else if (flags & COMM_LOST) != 0 {
        ReadingQuality::Bad
    } else {
        ReadingQuality::Uncertain
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_analog_input_address() {
        let (point_type, index) = Dnp3Adapter::parse_dnp3_address("AI:0").unwrap();
        assert!(matches!(point_type, Dnp3PointType::AnalogInput));
        assert_eq!(index, 0);

        let (point_type, index) = Dnp3Adapter::parse_dnp3_address("ai:100").unwrap();
        assert!(matches!(point_type, Dnp3PointType::AnalogInput));
        assert_eq!(index, 100);
    }

    #[test]
    fn test_parse_binary_input_address() {
        let (point_type, index) = Dnp3Adapter::parse_dnp3_address("BI:5").unwrap();
        assert!(matches!(point_type, Dnp3PointType::BinaryInput));
        assert_eq!(index, 5);
    }

    #[test]
    fn test_parse_counter_address() {
        let (point_type, index) = Dnp3Adapter::parse_dnp3_address("C:10").unwrap();
        assert!(matches!(point_type, Dnp3PointType::Counter));
        assert_eq!(index, 10);
    }

    #[test]
    fn test_parse_invalid_address() {
        assert!(Dnp3Adapter::parse_dnp3_address("INVALID").is_err());
        assert!(Dnp3Adapter::parse_dnp3_address("AI:abc").is_err());
        assert!(Dnp3Adapter::parse_dnp3_address("XX:0").is_err());
    }

    #[test]
    fn test_map_dnp3_quality() {
        // Online and no issues = Good
        assert_eq!(map_dnp3_quality(0b0000_0001), ReadingQuality::Good);

        // Communication lost = Bad
        assert_eq!(map_dnp3_quality(0b0001_0000), ReadingQuality::Bad);

        // Remote forced = Uncertain
        assert_eq!(map_dnp3_quality(0b0010_0001), ReadingQuality::Uncertain);

        // Local forced = Uncertain
        assert_eq!(map_dnp3_quality(0b0100_0001), ReadingQuality::Uncertain);

        // Offline = Bad
        assert_eq!(map_dnp3_quality(0b0000_0000), ReadingQuality::Bad);
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = Dnp3Adapter::new();
        assert_eq!(adapter.protocol_name(), "DNP3");
        assert!(!adapter.is_connected());
    }

    #[tokio::test]
    async fn test_connect_stub() {
        let mut adapter = Dnp3Adapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "127.0.0.1:20000".to_string(),
            security_mode: None,
            security_policy: None,
            username: None,
            password: None,
            slave_id: Some(10),
            client_id: None,
            qos: None,
        };

        let result = adapter.connect(&config).await;
        assert!(result.is_ok());
        assert!(adapter.is_connected());
    }

    #[tokio::test]
    async fn test_subscribe_validates_addresses() {
        let mut adapter = Dnp3Adapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "127.0.0.1:20000".to_string(),
            security_mode: None,
            security_policy: None,
            username: None,
            password: None,
            slave_id: Some(10),
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
                address: "AI:0".to_string(),
                data_type: "float".to_string(),
            },
            TagMapping {
                tag_id: Uuid::new_v4(),
                tenant_id,
                well_id,
                tag_name: "flow".to_string(),
                address: "AI:1".to_string(),
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
