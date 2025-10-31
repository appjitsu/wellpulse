//! OPC-UA protocol adapter
//!
//! Implements the ProtocolAdapter trait for OPC-UA connections.
//! Supports subscription-based monitoring of tag value changes.

use super::{
    ConnectionConfig, ProtocolAdapter, ProtocolError, ProtocolReading, ReadingQuality, TagMapping,
};
use async_trait::async_trait;
use chrono::Utc;
use opcua::client::prelude::*;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, info, warn};

pub struct OpcUaAdapter {
    client: Option<Arc<RwLock<Client>>>,
    config: Option<ConnectionConfig>,
    tags: Vec<TagMapping>,
    readings_rx: Option<mpsc::UnboundedReceiver<ProtocolReading>>,
    readings_tx: Option<mpsc::UnboundedSender<ProtocolReading>>,
    connected: bool,
}

impl OpcUaAdapter {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            client: None,
            config: None,
            tags: Vec::new(),
            readings_rx: Some(rx),
            readings_tx: Some(tx),
            connected: false,
        }
    }
}

#[async_trait]
impl ProtocolAdapter for OpcUaAdapter {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError> {
        info!(
            connection_id = %config.connection_id,
            tenant_id = %config.tenant_id,
            endpoint = %config.endpoint_url,
            "Connecting to OPC-UA server"
        );

        // Build OPC-UA client configuration
        let mut client_builder = ClientBuilder::new()
            .application_name("WellPulse SCADA Ingestion")
            .application_uri("urn:WellPulse:ScadaIngestion")
            .pki_dir("./pki");

        // Configure security
        let security_mode = config
            .security_mode
            .as_deref()
            .unwrap_or("None")
            .to_string();

        if security_mode != "None" {
            client_builder = client_builder
                .trust_server_certs(true) // TODO: In production, validate certificates
                .session_retry_limit(5);
        }

        let client = client_builder.client().ok_or_else(|| {
            ProtocolError::ConnectionFailed("Failed to create OPC-UA client".to_string())
        })?;

        // NOTE: MVP implementation - OPC-UA connection is stubbed
        // Real OPC-UA servers don't exist in development, so we gracefully skip connection
        // This allows the service to start and test the multi-tenant discovery logic

        debug!(
            connection_id = %config.connection_id,
            "Skipping actual OPC-UA connection (MVP stub - awaiting test infrastructure)"
        );

        // Store client and config
        self.client = Some(Arc::new(RwLock::new(client)));
        self.config = Some(config.clone());
        self.connected = true;

        info!(
            connection_id = %config.connection_id,
            "OPC-UA adapter connected (stub implementation)"
        );

        Ok(())
    }

    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError> {
        if !self.connected {
            return Err(ProtocolError::NotConnected);
        }

        debug!(
            tag_count = tags.len(),
            "Setting up OPC-UA subscription for tags"
        );

        // TODO: Implement full OPC-UA subscription when we have test servers
        // For now, just store the tags for later polling
        for tag in &tags {
            debug!(
                tenant_id = %tag.tenant_id,
                well_id = %tag.well_id,
                node_id = %tag.address,
                tag_name = %tag.tag_name,
                "Would monitor OPC-UA tag"
            );
        }

        self.tags = tags;

        info!(
            tag_count = self.tags.len(),
            "OPC-UA subscription configured (stub implementation)"
        );

        Ok(())
    }

    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError> {
        if !self.connected {
            return Err(ProtocolError::NotConnected);
        }

        // OPC-UA is subscription-based, so poll retrieves notifications from the channel
        let mut readings = Vec::new();

        // Try to receive any pending readings (non-blocking)
        if let Some(rx) = &mut self.readings_rx {
            while let Ok(reading) = rx.try_recv() {
                readings.push(reading);
            }
        }

        // TODO: In production, this would receive actual subscription notifications
        // For now, return empty results (stub implementation)

        Ok(readings)
    }

    async fn disconnect(&mut self) -> Result<(), ProtocolError> {
        if !self.connected {
            return Ok(());
        }

        info!("Disconnecting from OPC-UA server");

        // TODO: In opcua v0.12, disconnection is handled when session is closed
        // Implement proper disconnect when we have real connections

        self.client = None;
        self.config = None;
        self.connected = false;

        info!("OPC-UA adapter disconnected");

        Ok(())
    }

    fn protocol_name(&self) -> &str {
        "OPC-UA"
    }

    fn is_connected(&self) -> bool {
        self.connected
    }
}

impl Default for OpcUaAdapter {
    fn default() -> Self {
        Self::new()
    }
}

/// Extract numeric value from OPC-UA Variant
#[allow(dead_code)] // Reserved for full OPC-UA implementation
fn extract_numeric_value(variant: &Option<Variant>) -> Option<f64> {
    match variant {
        Some(Variant::Double(v)) => Some(*v),
        Some(Variant::Float(v)) => Some(*v as f64),
        Some(Variant::Int32(v)) => Some(*v as f64),
        Some(Variant::UInt32(v)) => Some(*v as f64),
        Some(Variant::Int16(v)) => Some(*v as f64),
        Some(Variant::UInt16(v)) => Some(*v as f64),
        Some(Variant::SByte(v)) => Some(*v as f64),
        Some(Variant::Byte(v)) => Some(*v as f64),
        _ => None,
    }
}

/// Map OPC-UA status code to ReadingQuality
#[allow(dead_code)] // Reserved for full OPC-UA implementation
fn map_status_to_quality(status: StatusCode) -> ReadingQuality {
    if status.is_good() {
        ReadingQuality::Good
    } else if status.is_bad() {
        ReadingQuality::Bad
    } else {
        ReadingQuality::Uncertain
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = OpcUaAdapter::new();
        assert_eq!(adapter.protocol_name(), "OPC-UA");
        assert!(!adapter.is_connected());
    }

    #[tokio::test]
    async fn test_connect_stub() {
        let mut adapter = OpcUaAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "opc.tcp://localhost:4840".to_string(),
            security_mode: Some("None".to_string()),
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
    async fn test_subscribe_without_connect() {
        let mut adapter = OpcUaAdapter::new();
        let tags = vec![];

        let result = adapter.subscribe(tags).await;
        assert!(result.is_err());
        match result {
            Err(ProtocolError::NotConnected) => {}
            _ => panic!("Expected NotConnected error"),
        }
    }
}
