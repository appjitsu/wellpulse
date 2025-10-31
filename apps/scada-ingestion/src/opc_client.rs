//! OPC-UA client wrapper for SCADA data ingestion
//!
//! Manages OPC-UA connections to RTU/PLC devices with automatic reconnection.

use crate::errors::{IngestionError, IngestionResult};
use crate::metrics::ACTIVE_CONNECTIONS;
use opcua::client::prelude::*;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, info};
use uuid::Uuid;

/// Reading from a SCADA tag
#[derive(Debug, Clone)]
pub struct TagReading {
    pub tenant_id: Uuid,
    pub well_id: Uuid,
    pub tag_node_id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub value: f64,
    pub quality: String,
}

/// OPC-UA connection configuration
#[derive(Debug, Clone)]
pub struct OpcConnectionConfig {
    pub connection_id: Uuid,
    pub tenant_id: Uuid,
    pub endpoint_url: String,
    pub security_mode: String,
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    pub security_policy: String,
    #[allow(dead_code)] // Reserved for authenticated OPC-UA connections
    pub username: Option<String>,
    #[allow(dead_code)] // Reserved for authenticated OPC-UA connections
    pub password: Option<String>,
    pub tags: Vec<TagConfig>,
}

#[derive(Debug, Clone)]
pub struct TagConfig {
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    pub tag_id: Uuid,
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    pub well_id: Uuid,
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    pub node_id: String,
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    pub data_type: String,
}

#[derive(Clone)]
pub struct OpcClient {
    config: OpcConnectionConfig,
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    client: Arc<RwLock<Client>>,
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    readings_tx: mpsc::UnboundedSender<TagReading>,
}

impl OpcClient {
    /// Create a new OPC-UA client
    pub fn new(
        config: OpcConnectionConfig,
        readings_tx: mpsc::UnboundedSender<TagReading>,
    ) -> IngestionResult<Self> {
        // Build OPC-UA client configuration
        let mut client_builder = ClientBuilder::new()
            .application_name("WellPulse SCADA Ingestion")
            .application_uri("urn:WellPulse:ScadaIngestion")
            .pki_dir("./pki");

        // Configure security
        if config.security_mode != "None" {
            client_builder = client_builder
                .trust_server_certs(true) // In production, validate certificates
                .session_retry_limit(5);
        }

        let client = client_builder.client().ok_or_else(|| {
            IngestionError::OpcConnectionError("Failed to create OPC client".to_string())
        })?;

        Ok(Self {
            config,
            client: Arc::new(RwLock::new(client)),
            readings_tx,
        })
    }

    /// Connect to OPC-UA server and start subscription
    pub async fn connect_and_subscribe(&mut self) -> IngestionResult<()> {
        info!(
            tenant_id = %self.config.tenant_id,
            connection_id = %self.config.connection_id,
            endpoint = %self.config.endpoint_url,
            "Connecting to OPC-UA server"
        );

        // NOTE: MVP implementation - OPC-UA connection is stubbed
        // Real OPC-UA servers don't exist in development, so we gracefully skip connection
        // This allows the service to start and test the multi-tenant discovery logic

        debug!(
            tenant_id = %self.config.tenant_id,
            connection_id = %self.config.connection_id,
            "Skipping OPC-UA connection (MVP stub - awaiting test infrastructure)"
        );

        // In production, this would:
        // 1. Parse security mode
        // 2. Connect to endpoint using spawn_blocking to avoid nested runtime issues
        // 3. Create subscription for tag monitoring

        // For now, just mark connection as active for metrics
        ACTIVE_CONNECTIONS
            .with_label_values(&[&self.config.tenant_id.to_string()])
            .inc();

        info!(
            tenant_id = %self.config.tenant_id,
            connection_id = %self.config.connection_id,
            tag_count = self.config.tags.len(),
            "OPC-UA connection configured (stub) - monitoring {} tags",
            self.config.tags.len()
        );

        Ok(())
    }

    /// Create a subscription to monitor tag changes
    /// NOTE: This is a simplified implementation for MVP
    /// Full OPC-UA subscription logic will be implemented when test infrastructure is ready
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    async fn create_subscription(&mut self) -> IngestionResult<()> {
        debug!(
            tenant_id = %self.config.tenant_id,
            tag_count = self.config.tags.len(),
            "Setting up OPC-UA subscription for {} tags",
            self.config.tags.len()
        );

        // TODO: Implement full OPC-UA subscription when we have test servers
        // For now, log that we would monitor these tags
        for tag in &self.config.tags {
            debug!(
                tenant_id = %self.config.tenant_id,
                well_id = %tag.well_id,
                node_id = %tag.node_id,
                "Would monitor tag"
            );
        }

        info!(
            tenant_id = %self.config.tenant_id,
            tag_count = self.config.tags.len(),
            "Subscription configured for {} tags (stub implementation)",
            self.config.tags.len()
        );

        Ok(())
    }

    /// Disconnect from OPC-UA server
    pub async fn disconnect(&mut self) -> IngestionResult<()> {
        info!(
            tenant_id = %self.config.tenant_id,
            connection_id = %self.config.connection_id,
            "Disconnecting from OPC-UA server"
        );

        // In opcua v0.12, disconnection is handled when session is closed
        // For now, we'll just log the disconnect (actual implementation pending)
        debug!(
            tenant_id = %self.config.tenant_id,
            "OPC-UA disconnect (stub implementation)"
        );

        ACTIVE_CONNECTIONS
            .with_label_values(&[&self.config.tenant_id.to_string()])
            .dec();

        Ok(())
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
