//! Tenant router for managing per-tenant OPC-UA connections
//!
//! Loads active SCADA connections from the master database and routes
//! readings to tenant-specific aggregators.

use crate::aggregator::Aggregator;
use crate::config::Config;
use crate::errors::IngestionResult;
use crate::opc_client::{OpcClient, OpcConnectionConfig, TagConfig, TagReading};
use crate::timescale_writer::TimescaleWriter;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub struct TenantRouter {
    master_db: PgPool,
    writer: Arc<TimescaleWriter>,
    config: Config,
    /// Per-tenant aggregators (tenant_id -> Aggregator)
    aggregators: Arc<RwLock<HashMap<Uuid, Arc<Aggregator>>>>,
    /// Per-connection OPC clients (connection_id -> OpcClient)
    opc_clients: Arc<RwLock<HashMap<Uuid, OpcClient>>>,
    /// Readings channel (shared across all connections)
    readings_tx: mpsc::UnboundedSender<TagReading>,
    /// Readings receiver (taken once by the router task)
    readings_rx: Arc<RwLock<Option<mpsc::UnboundedReceiver<TagReading>>>>,
}

impl TenantRouter {
    pub fn new(master_db: PgPool, writer: Arc<TimescaleWriter>, config: Config) -> Self {
        let (readings_tx, readings_rx) = mpsc::unbounded_channel();

        Self {
            master_db,
            writer,
            config,
            aggregators: Arc::new(RwLock::new(HashMap::new())),
            opc_clients: Arc::new(RwLock::new(HashMap::new())),
            readings_tx,
            readings_rx: Arc::new(RwLock::new(Some(readings_rx))),
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

        // Start readings router (distributes readings to aggregators)
        self.start_readings_router().await;

        Ok(())
    }

    /// Load active connection configurations from all tenant databases
    async fn load_active_connections(&self) -> IngestionResult<Vec<OpcConnectionConfig>> {
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

            // Query SCADA connections for this tenant (unchecked - tenant DB schema)
            let connections = match sqlx::query(
                r#"
                SELECT
                    id,
                    endpoint_url,
                    security_mode,
                    security_policy,
                    username,
                    password
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
                let endpoint_url: String = conn.get("endpoint_url");
                let security_mode: String = conn.get("security_mode");
                let security_policy: String = conn.get("security_policy");
                let username: Option<String> = conn.get("username");
                let password: Option<String> = conn.get("password");

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

                all_configs.push(OpcConnectionConfig {
                    connection_id,
                    tenant_id,
                    endpoint_url,
                    security_mode,
                    security_policy,
                    username,
                    password,
                    tags,
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
    ) -> IngestionResult<Vec<TagConfig>> {
        use sqlx::Row;

        let rows = sqlx::query(
            r#"
            SELECT
                id as tag_id,
                well_id,
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

        Ok(rows
            .into_iter()
            .map(|row| TagConfig {
                tag_id: row.get("tag_id"),
                well_id: row.get("well_id"),
                node_id: row.get("opc_node_id"),
                data_type: row.get("data_type"),
            })
            .collect())
    }

    /// Start a single OPC-UA connection
    async fn start_connection(&self, config: OpcConnectionConfig) -> IngestionResult<()> {
        let tenant_id = config.tenant_id;
        let connection_id = config.connection_id;

        info!(
            tenant_id = %tenant_id,
            connection_id = %connection_id,
            endpoint = %config.endpoint_url,
            tag_count = config.tags.len(),
            "Starting SCADA connection"
        );

        // Ensure aggregator exists for this tenant
        self.ensure_aggregator(tenant_id).await;

        // Create OPC client
        let client = OpcClient::new(config, self.readings_tx.clone())?;

        // Connect asynchronously (with retry logic)
        let client_clone = client.clone();
        tokio::spawn(async move {
            if let Err(e) = Self::connect_with_retry(client_clone).await {
                error!(
                    tenant_id = %tenant_id,
                    connection_id = %connection_id,
                    "Failed to establish OPC-UA connection: {}",
                    e
                );
            }
        });

        // Store client reference
        self.opc_clients.write().await.insert(connection_id, client);

        Ok(())
    }

    /// Connect with exponential backoff retry
    async fn connect_with_retry(mut client: OpcClient) -> IngestionResult<()> {
        let mut retry_count = 0;
        let max_retries = 5;
        let mut delay_ms = 1000u64;

        loop {
            match client.connect_and_subscribe().await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    retry_count += 1;
                    if retry_count >= max_retries {
                        return Err(e);
                    }

                    warn!(
                        "Connection attempt {} failed: {}. Retrying in {}ms",
                        retry_count, e, delay_ms
                    );

                    tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
                    delay_ms *= 2; // Exponential backoff
                }
            }
        }
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

    /// Start the readings router task
    async fn start_readings_router(&self) {
        // Take ownership of the receiver (can only be called once)
        let mut readings_rx = self
            .readings_rx
            .write()
            .await
            .take()
            .expect("Readings router already started");
        let aggregators = self.aggregators.clone();

        tokio::spawn(async move {
            while let Some(reading) = readings_rx.recv().await {
                let tenant_id = reading.tenant_id;

                // Route reading to tenant's aggregator
                let aggregators_read = aggregators.read().await;
                if let Some(aggregator) = aggregators_read.get(&tenant_id) {
                    aggregator.add_reading(reading).await;
                } else {
                    error!(
                        tenant_id = %tenant_id,
                        "No aggregator found for tenant"
                    );
                }
            }
        });

        info!("Started readings router task");
    }

    /// Stop all connections gracefully
    pub async fn stop_all_connections(&self) -> IngestionResult<()> {
        info!("Stopping all SCADA connections");

        let mut clients = self.opc_clients.write().await;

        for (connection_id, mut client) in clients.drain() {
            if let Err(e) = client.disconnect().await {
                error!(
                    connection_id = %connection_id,
                    "Error disconnecting: {}",
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
    pub async fn add_connection(&self, config: OpcConnectionConfig) -> IngestionResult<()> {
        self.start_connection(config).await
    }

    /// Remove a connection dynamically (called by gRPC API)
    pub async fn remove_connection(&self, connection_id: Uuid) -> IngestionResult<()> {
        let mut clients = self.opc_clients.write().await;

        if let Some(mut client) = clients.remove(&connection_id) {
            client.disconnect().await?;
            info!(connection_id = %connection_id, "Removed SCADA connection");
        }

        Ok(())
    }
}
