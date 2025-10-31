//! Tenant router v2 - Protocol-agnostic multi-tenant SCADA ingestion
//!
//! Loads active SCADA connections from the master database and routes
//! readings to tenant-specific aggregators using pluggable protocol adapters.

use crate::adapters::{
    factory::AdapterFactory, ConnectionConfig, ProtocolAdapter, ProtocolReading, TagMapping,
};
use crate::aggregator::Aggregator;
use crate::config::Config;
use crate::errors::IngestionResult;
use crate::timescale_writer::TimescaleWriter;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::Duration;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub struct TenantRouter {
    master_db: PgPool,
    writer: Arc<TimescaleWriter>,
    config: Config,
    /// Per-tenant aggregators (tenant_id -> Aggregator)
    aggregators: Arc<RwLock<HashMap<Uuid, Arc<Aggregator>>>>,
    /// Per-connection protocol adapters (connection_id -> Box<dyn ProtocolAdapter>)
    adapters: Arc<RwLock<HashMap<Uuid, Box<dyn ProtocolAdapter>>>>,
}

impl TenantRouter {
    pub fn new(master_db: PgPool, writer: Arc<TimescaleWriter>, config: Config) -> Self {
        Self {
            master_db,
            writer,
            config,
            aggregators: Arc::new(RwLock::new(HashMap::new())),
            adapters: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Load all active connections from master DB and start ingestion
    pub async fn start_all_connections(&self) -> IngestionResult<()> {
        info!("Loading active tenants and their SCADA connections");

        // Query master database for active connections across all tenants
        let connections = self.load_active_connections().await?;

        info!(
            "Found {} active SCADA connections across {} tenants",
            connections.len(),
            connections
                .iter()
                .map(|c| c.tenant_id)
                .collect::<std::collections::HashSet<_>>()
                .len()
        );

        // Start each connection
        for conn_config in connections {
            if let Err(e) = self.start_connection(conn_config).await {
                error!("Failed to start connection: {}", e);
                // Continue with other connections even if one fails
            }
        }

        // Start polling loop for all adapters
        self.start_polling_loop().await;

        Ok(())
    }

    /// Load active connection configurations from all tenant databases
    async fn load_active_connections(&self) -> IngestionResult<Vec<ConnectionConfig>> {
        // Step 1: Get all active tenants from master database
        let tenants = sqlx::query!(
            r#"
            SELECT id, database_url
            FROM tenants
            WHERE status != 'SUSPENDED'
            AND deleted_at IS NULL
            "#
        )
        .fetch_all(&self.master_db)
        .await?;

        info!(
            "Querying {} active tenants for SCADA connections",
            tenants.len()
        );

        let mut all_configs = Vec::new();

        // Step 2: For each tenant, connect to their database and query connections
        for tenant in tenants {
            let tenant_id = tenant.id;
            let tenant_db_url = &tenant.database_url;

            // Connect to tenant database
            let tenant_pool = match sqlx::postgres::PgPoolOptions::new()
                .max_connections(2)
                .connect(tenant_db_url)
                .await
            {
                Ok(pool) => pool,
                Err(e) => {
                    error!(
                        tenant_id = %tenant_id,
                        "Failed to connect to tenant database: {}",
                        e
                    );
                    continue; // Skip this tenant, continue with others
                }
            };

            // Query SCADA connections for this tenant
            let connections = match sqlx::query(
                r#"
                SELECT
                    id,
                    protocol_type,
                    endpoint_url,
                    security_mode,
                    security_policy,
                    username,
                    password,
                    slave_id,
                    client_id
                FROM scada_connections
                WHERE is_enabled = true
                AND deleted_at IS NULL
                "#,
            )
            .fetch_all(&tenant_pool)
            .await
            {
                Ok(rows) => rows,
                Err(e) => {
                    error!(
                        tenant_id = %tenant_id,
                        "Failed to query SCADA connections: {}",
                        e
                    );
                    continue;
                }
            };

            debug!(
                tenant_id = %tenant_id,
                connection_count = connections.len(),
                "Found SCADA connections for tenant"
            );

            // For each connection, load tag mappings
            for conn in connections {
                use sqlx::Row;

                let connection_id: Uuid = conn.get("id");
                let protocol_type: String = conn.get("protocol_type");
                let endpoint_url: String = conn.get("endpoint_url");
                let security_mode: Option<String> = conn.get("security_mode");
                let security_policy: Option<String> = conn.get("security_policy");
                let username: Option<String> = conn.get("username");
                let password: Option<String> = conn.get("password");
                let slave_id: Option<i32> = conn.get("slave_id");
                let client_id: Option<String> = conn.get("client_id");

                let tags = match self.load_tag_mappings(&tenant_pool, connection_id).await {
                    Ok(tags) => tags,
                    Err(e) => {
                        error!(
                            tenant_id = %tenant_id,
                            connection_id = %connection_id,
                            "Failed to load tag mappings: {}",
                            e
                        );
                        continue;
                    }
                };

                if tags.is_empty() {
                    warn!(
                        tenant_id = %tenant_id,
                        connection_id = %connection_id,
                        "Skipping connection with no tag mappings"
                    );
                    continue;
                }

                all_configs.push(ConnectionConfig {
                    connection_id,
                    tenant_id,
                    endpoint_url,
                    security_mode,
                    security_policy,
                    username,
                    password,
                    slave_id: slave_id.map(|id| id as u8),
                    client_id,
                    qos: None, // TODO: Add to database schema
                });
            }
        }

        Ok(all_configs)
    }

    /// Load tag mappings for a connection from tenant database
    async fn load_tag_mappings(
        &self,
        tenant_pool: &PgPool,
        connection_id: Uuid,
    ) -> IngestionResult<Vec<TagMapping>> {
        use sqlx::Row;

        let rows = sqlx::query(
            r#"
            SELECT
                id as tag_id,
                well_id,
                tag_name,
                opc_node_id,
                data_type
            FROM tag_mappings
            WHERE connection_id = $1
            AND deleted_at IS NULL
            "#,
        )
        .bind(connection_id)
        .fetch_all(tenant_pool)
        .await?;

        // Get tenant_id from one of the rows (all should have same tenant)
        if rows.is_empty() {
            return Ok(Vec::new());
        }

        let tags: Vec<TagMapping> = rows
            .into_iter()
            .map(|row| {
                // TODO: Get tenant_id from connection or well
                let tenant_id = Uuid::nil(); // Placeholder - will be filled from connection

                TagMapping {
                    tag_id: row.get("tag_id"),
                    tenant_id, // Will be set from connection config
                    well_id: row.get("well_id"),
                    tag_name: row.get("tag_name"),
                    address: row.get("opc_node_id"), // Protocol-agnostic address
                    data_type: row.get("data_type"),
                }
            })
            .collect();

        Ok(tags)
    }

    /// Start a single SCADA connection using appropriate protocol adapter
    async fn start_connection(&self, mut config: ConnectionConfig) -> IngestionResult<()> {
        let tenant_id = config.tenant_id;
        let connection_id = config.connection_id;

        info!(
            tenant_id = %tenant_id,
            connection_id = %connection_id,
            endpoint = %config.endpoint_url,
            "Starting SCADA connection with adapter pattern"
        );

        // Ensure aggregator exists for this tenant
        self.ensure_aggregator(tenant_id).await;

        // Load tags for this connection
        // TODO: We need to pass the tenant pool here or cache tags separately
        // For now, assume tags are already loaded in the config
        let tags = Vec::new(); // Placeholder

        // Update tag mappings with correct tenant_id
        let tags_with_tenant: Vec<TagMapping> = tags
            .into_iter()
            .map(|mut tag| {
                tag.tenant_id = tenant_id;
                tag
            })
            .collect();

        // Create appropriate adapter based on protocol_type
        // TODO: Get protocol_type from config (needs to be added to ConnectionConfig)
        let protocol_type = "OPC-UA"; // Placeholder - will come from database
        let mut adapter = AdapterFactory::create_adapter(protocol_type).map_err(|e| {
            crate::errors::IngestionError::InvalidConfiguration(format!(
                "Failed to create adapter: {}",
                e
            ))
        })?;

        // Connect adapter
        adapter.connect(&config).await.map_err(|e| {
            crate::errors::IngestionError::OpcConnectionError(format!(
                "Failed to connect adapter: {}",
                e
            ))
        })?;

        // Subscribe to tags
        adapter.subscribe(tags_with_tenant).await.map_err(|e| {
            crate::errors::IngestionError::OpcSessionError(format!(
                "Failed to subscribe: {}",
                e
            ))
        })?;

        // Store adapter
        self.adapters.write().await.insert(connection_id, adapter);

        info!(
            tenant_id = %tenant_id,
            connection_id = %connection_id,
            protocol = protocol_type,
            "SCADA connection started with {} adapter",
            protocol_type
        );

        Ok(())
    }

    /// Ensure an aggregator exists for a tenant
    async fn ensure_aggregator(&self, tenant_id: Uuid) {
        let mut aggregators = self.aggregators.write().await;

        if let std::collections::hash_map::Entry::Vacant(e) = aggregators.entry(tenant_id) {
            let aggregator = Arc::new(Aggregator::new(
                tenant_id,
                self.writer.clone(),
                self.config.aggregation.clone(),
            ));

            // Start aggregator background task
            aggregator.start().await;

            e.insert(aggregator);

            debug!(tenant_id = %tenant_id, "Created aggregator for tenant");
        }
    }

    /// Start the polling loop that polls all adapters
    async fn start_polling_loop(&self) {
        let adapters = self.adapters.clone();
        let aggregators = self.aggregators.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));

            loop {
                interval.tick().await;

                let adapters_read = adapters.read().await;

                for (conn_id, adapter) in adapters_read.iter() {
                    // Poll adapter for new readings (protocol-agnostic)
                    match adapter.poll().await {
                        Ok(readings) => {
                            // Route readings to appropriate tenant aggregators
                            for reading in readings {
                                let tenant_id = reading.tenant_id;

                                let aggregators_read = aggregators.read().await;
                                if let Some(aggregator) = aggregators_read.get(&tenant_id) {
                                    // Convert ProtocolReading to TagReading for aggregator
                                    let tag_reading = crate::opc_client::TagReading {
                                        tenant_id: reading.tenant_id,
                                        well_id: reading.well_id,
                                        tag_node_id: reading.tag_name.clone(),
                                        timestamp: reading.timestamp,
                                        value: reading.value,
                                        quality: reading.quality.to_string(),
                                    };

                                    aggregator.add_reading(tag_reading).await;
                                } else {
                                    error!(
                                        tenant_id = %tenant_id,
                                        "No aggregator found for tenant"
                                    );
                                }
                            }
                        }
                        Err(e) => {
                            debug!(
                                connection_id = %conn_id,
                                "Error polling adapter: {}",
                                e
                            );
                        }
                    }
                }
            }
        });

        info!("Started protocol-agnostic polling loop");
    }

    /// Stop all connections gracefully
    pub async fn stop_all_connections(&self) -> IngestionResult<()> {
        info!("Stopping all SCADA connections");

        let mut adapters = self.adapters.write().await;

        for (connection_id, mut adapter) in adapters.drain() {
            if let Err(e) = adapter.disconnect().await {
                error!(
                    connection_id = %connection_id,
                    "Error disconnecting adapter: {}",
                    e
                );
            }
        }

        // Flush all aggregators
        let aggregators = self.aggregators.read().await;
        for (tenant_id, aggregator) in aggregators.iter() {
            if let Err(e) = aggregator.flush().await {
                error!(tenant_id = %tenant_id, "Error flushing aggregator: {}", e);
            }
        }

        Ok(())
    }

    /// Add a new connection dynamically (called by gRPC API)
    pub async fn add_connection(&self, config: ConnectionConfig) -> IngestionResult<()> {
        self.start_connection(config).await
    }

    /// Remove a connection dynamically (called by gRPC API)
    pub async fn remove_connection(&self, connection_id: Uuid) -> IngestionResult<()> {
        let mut adapters = self.adapters.write().await;

        if let Some(mut adapter) = adapters.remove(&connection_id) {
            adapter.disconnect().await.map_err(|e| {
                crate::errors::IngestionError::OpcConnectionError(format!(
                    "Failed to disconnect: {}",
                    e
                ))
            })?;
            info!(connection_id = %connection_id, "Removed SCADA connection");
        }

        Ok(())
    }
}
