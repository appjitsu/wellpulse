//! MQTT protocol adapter
//!
//! Implements the ProtocolAdapter trait for MQTT connections.
//! Supports subscription-based monitoring of MQTT topics with QoS levels.

use super::{
    ConnectionConfig, ProtocolAdapter, ProtocolError, ProtocolReading, ReadingQuality, TagMapping,
};
use async_trait::async_trait;
use chrono::Utc;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use url::Url;

pub struct MqttAdapter {
    client: Option<AsyncClient>,
    config: Option<ConnectionConfig>,
    tags: Vec<TagMapping>,
    readings_rx: Option<mpsc::UnboundedReceiver<ProtocolReading>>,
    readings_tx: Option<mpsc::UnboundedSender<ProtocolReading>>,
}

impl MqttAdapter {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            client: None,
            config: None,
            tags: Vec::new(),
            readings_rx: Some(rx),
            readings_tx: Some(tx),
        }
    }

    /// Parse QoS from u8
    fn parse_qos(qos: u8) -> QoS {
        match qos {
            0 => QoS::AtMostOnce,
            1 => QoS::AtLeastOnce,
            2 => QoS::ExactlyOnce,
            _ => QoS::AtLeastOnce, // Default
        }
    }
}

#[async_trait]
impl ProtocolAdapter for MqttAdapter {
    async fn connect(&mut self, config: &ConnectionConfig) -> Result<(), ProtocolError> {
        info!(
            connection_id = %config.connection_id,
            endpoint = %config.endpoint_url,
            "Connecting to MQTT broker"
        );

        // Parse MQTT broker URL (e.g., "mqtt://broker.example.com:1883")
        let url = Url::parse(&config.endpoint_url)
            .map_err(|e| ProtocolError::InvalidConfiguration(format!("Invalid MQTT URL: {}", e)))?;

        let host = url
            .host_str()
            .ok_or_else(|| ProtocolError::InvalidConfiguration("Missing MQTT host".to_string()))?;
        let port = url.port().unwrap_or(1883);

        // Generate client ID
        let client_id = config
            .client_id
            .clone()
            .unwrap_or_else(|| format!("wellpulse-{}", config.connection_id));

        debug!(
            host = host,
            port = port,
            client_id = %client_id,
            "Creating MQTT client"
        );

        // TODO: Actual MQTT connection
        // For MVP, we'll create a stub
        debug!("Skipping actual MQTT connection (MVP stub)");

        // In production, this would be:
        /*
        let mut mqtt_options = MqttOptions::new(&client_id, host, port);
        mqtt_options.set_keep_alive(Duration::from_secs(30));

        // Authentication (if configured)
        if let (Some(username), Some(password)) = (&config.username, &config.password) {
            mqtt_options.set_credentials(username, password);
        }

        let (client, mut eventloop) = AsyncClient::new(mqtt_options, 10);

        // Start event loop in background
        let readings_tx = self.readings_tx.clone().unwrap();
        let tags = self.tags.clone();
        tokio::spawn(async move {
            loop {
                match eventloop.poll().await {
                    Ok(Event::Incoming(Packet::Publish(publish))) => {
                        // Parse MQTT message and convert to ProtocolReading
                        // Match topic to tag mapping
                        for tag in &tags {
                            if publish.topic == tag.address {
                                // Parse payload as f64
                                if let Ok(value_str) = std::str::from_utf8(&publish.payload) {
                                    if let Ok(value) = value_str.parse::<f64>() {
                                        let reading = ProtocolReading {
                                            timestamp: Utc::now(),
                                            tenant_id: tag.tenant_id,
                                            well_id: tag.well_id,
                                            tag_name: tag.tag_name.clone(),
                                            value,
                                            quality: ReadingQuality::Good,
                                            source_protocol: "MQTT".to_string(),
                                        };

                                        if let Err(e) = readings_tx.send(reading) {
                                            error!("Failed to send MQTT reading: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        error!("MQTT event loop error: {}", e);
                        break;
                    }
                }
            }
        });

        self.client = Some(client);
        */

        self.config = Some(config.clone());

        info!(
            connection_id = %config.connection_id,
            "MQTT adapter connected (stub implementation)"
        );

        Ok(())
    }

    async fn subscribe(&mut self, tags: Vec<TagMapping>) -> Result<(), ProtocolError> {
        if self.config.is_none() {
            return Err(ProtocolError::NotConnected);
        }

        let config = self.config.as_ref().unwrap();
        let qos = Self::parse_qos(config.qos.unwrap_or(1));

        debug!(
            tag_count = tags.len(),
            qos = ?qos,
            "Subscribing to MQTT topics"
        );

        // TODO: In production, subscribe to actual MQTT topics
        for tag in &tags {
            let topic = &tag.address;
            debug!(
                tag_name = %tag.tag_name,
                topic = %topic,
                "Would subscribe to MQTT topic"
            );

            // In production:
            /*
            if let Some(client) = &self.client {
                client.subscribe(topic, qos).await.map_err(|e| {
                    ProtocolError::SubscriptionFailed(format!(
                        "Failed to subscribe to topic {}: {}",
                        topic, e
                    ))
                })?;
            }
            */
        }

        self.tags = tags;

        info!(
            tag_count = self.tags.len(),
            "MQTT subscriptions configured (stub implementation)"
        );

        Ok(())
    }

    async fn poll(&mut self) -> Result<Vec<ProtocolReading>, ProtocolError> {
        if self.config.is_none() {
            return Err(ProtocolError::NotConnected);
        }

        // MQTT is subscription-based, so poll retrieves notifications from the channel
        let mut readings = Vec::new();

        // Try to receive any pending readings (non-blocking)
        if let Some(rx) = &mut self.readings_rx {
            while let Ok(reading) = rx.try_recv() {
                readings.push(reading);
            }
        }

        // TODO: In production, readings come via event loop callbacks
        // For MVP stub, return empty results

        Ok(readings)
    }

    async fn disconnect(&mut self) -> Result<(), ProtocolError> {
        info!("Disconnecting from MQTT broker");

        // TODO: In production, disconnect from MQTT broker
        /*
        if let Some(client) = self.client.take() {
            client.disconnect().await.map_err(|e| {
                ProtocolError::ProtocolSpecific(format!("Failed to disconnect: {}", e))
            })?;
        }
        */

        self.client = None;
        self.config = None;

        info!("MQTT adapter disconnected");

        Ok(())
    }

    fn protocol_name(&self) -> &str {
        "MQTT"
    }

    fn is_connected(&self) -> bool {
        self.config.is_some()
    }
}

impl Default for MqttAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_qos() {
        assert!(matches!(MqttAdapter::parse_qos(0), QoS::AtMostOnce));
        assert!(matches!(MqttAdapter::parse_qos(1), QoS::AtLeastOnce));
        assert!(matches!(MqttAdapter::parse_qos(2), QoS::ExactlyOnce));
        assert!(matches!(MqttAdapter::parse_qos(99), QoS::AtLeastOnce)); // Default
    }

    #[tokio::test]
    async fn test_adapter_creation() {
        let adapter = MqttAdapter::new();
        assert_eq!(adapter.protocol_name(), "MQTT");
        assert!(!adapter.is_connected());
    }

    #[tokio::test]
    async fn test_connect_stub() {
        let mut adapter = MqttAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "mqtt://broker.example.com:1883".to_string(),
            security_mode: None,
            security_policy: None,
            username: Some("user".to_string()),
            password: Some("pass".to_string()),
            slave_id: None,
            client_id: Some("test-client".to_string()),
            qos: Some(1),
        };

        let result = adapter.connect(&config).await;
        assert!(result.is_ok());
        assert!(adapter.is_connected());
    }

    #[tokio::test]
    async fn test_subscribe_without_connect() {
        let mut adapter = MqttAdapter::new();
        let tags = vec![];

        let result = adapter.subscribe(tags).await;
        assert!(result.is_err());
        match result {
            Err(ProtocolError::NotConnected) => {}
            _ => panic!("Expected NotConnected error"),
        }
    }

    #[tokio::test]
    async fn test_subscribe_with_topics() {
        let mut adapter = MqttAdapter::new();
        let config = ConnectionConfig {
            connection_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            endpoint_url: "mqtt://broker.example.com:1883".to_string(),
            security_mode: None,
            security_policy: None,
            username: None,
            password: None,
            slave_id: None,
            client_id: None,
            qos: Some(1),
        };

        adapter.connect(&config).await.unwrap();

        let tenant_id = Uuid::new_v4();
        let well_id = Uuid::new_v4();

        let tags = vec![
            TagMapping {
                tag_id: Uuid::new_v4(),
                tenant_id,
                well_id,
                tag_name: "oil_rate".to_string(),
                address: "well/123/oil_rate".to_string(),
                data_type: "float".to_string(),
            },
            TagMapping {
                tag_id: Uuid::new_v4(),
                tenant_id,
                well_id,
                tag_name: "pressure".to_string(),
                address: "well/123/tubing_pressure".to_string(),
                data_type: "float".to_string(),
            },
        ];

        let result = adapter.subscribe(tags).await;
        assert!(result.is_ok());
    }
}
