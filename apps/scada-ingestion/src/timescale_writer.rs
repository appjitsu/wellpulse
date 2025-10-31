//! TimescaleDB batch writer for SCADA readings
//!
//! Writes batches of readings to per-tenant TimescaleDB hypertables.

use crate::errors::{IngestionError, IngestionResult};
use crate::metrics::DB_WRITE_LATENCY;
use crate::opc_client::TagReading;
use sqlx::PgPool;
use std::time::Instant;
use tracing::{debug, error};
use uuid::Uuid;

pub struct TimescaleWriter {
    master_db: PgPool,
}

impl TimescaleWriter {
    pub fn new(master_db: PgPool) -> Self {
        Self { master_db }
    }

    /// Write a batch of readings to the tenant's database
    pub async fn write_batch(
        &self,
        tenant_id: Uuid,
        readings: Vec<TagReading>,
    ) -> IngestionResult<()> {
        if readings.is_empty() {
            return Ok(());
        }

        let start = Instant::now();
        let count = readings.len();

        debug!(
            tenant_id = %tenant_id,
            count = count,
            "Writing batch to TimescaleDB"
        );

        // Get tenant's database connection string
        let tenant_db_url = self.get_tenant_db_url(tenant_id).await?;

        // Connect to tenant database
        let tenant_pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(5) // Small pool for batch writes
            .connect(&tenant_db_url)
            .await
            .map_err(|e| {
                error!(
                    tenant_id = %tenant_id,
                    "Failed to connect to tenant database: {}",
                    e
                );
                IngestionError::DatabaseError(e)
            })?;

        // Use PostgreSQL COPY for maximum performance
        self.bulk_insert(&tenant_pool, readings).await?;

        let duration = start.elapsed();
        DB_WRITE_LATENCY
            .with_label_values(&[&tenant_id.to_string()])
            .observe(duration.as_secs_f64());

        debug!(
            tenant_id = %tenant_id,
            count = count,
            duration_ms = duration.as_millis(),
            "Batch write completed"
        );

        Ok(())
    }

    /// Get tenant database URL from master database
    async fn get_tenant_db_url(&self, tenant_id: Uuid) -> IngestionResult<String> {
        let row = sqlx::query!(
            r#"
            SELECT database_url
            FROM tenants
            WHERE id = $1
            AND deleted_at IS NULL
            "#,
            tenant_id
        )
        .fetch_optional(&self.master_db)
        .await?;

        row.map(|r| r.database_url)
            .ok_or_else(|| IngestionError::TenantNotFound(tenant_id.to_string()))
    }

    /// Bulk insert using PostgreSQL COPY protocol (fastest method)
    async fn bulk_insert(
        &self,
        tenant_pool: &PgPool,
        readings: Vec<TagReading>,
    ) -> IngestionResult<()> {
        // Build VALUES clause for batch insert
        // Using unnest() for optimal performance with large batches
        let mut well_ids = Vec::new();
        let mut tag_node_ids = Vec::new();
        let mut timestamps = Vec::new();
        let mut values = Vec::new();
        let mut qualities = Vec::new();

        for reading in readings {
            well_ids.push(reading.well_id);
            tag_node_ids.push(reading.tag_node_id);
            timestamps.push(reading.timestamp);
            values.push(reading.value);
            qualities.push(reading.quality);
        }

        sqlx::query(
            r#"
            INSERT INTO scada_readings (
                well_id,
                tag_node_id,
                timestamp,
                value,
                quality
            )
            SELECT * FROM UNNEST(
                $1::uuid[],
                $2::text[],
                $3::timestamptz[],
                $4::double precision[],
                $5::text[]
            )
            "#,
        )
        .bind(&well_ids[..])
        .bind(&tag_node_ids[..])
        .bind(&timestamps[..])
        .bind(&values[..])
        .bind(&qualities[..])
        .execute(tenant_pool)
        .await?;

        Ok(())
    }

    /// Query recent readings (for gRPC API)
    pub async fn query_readings(
        &self,
        tenant_id: Uuid,
        well_id: Uuid,
        start_time: chrono::DateTime<chrono::Utc>,
        end_time: chrono::DateTime<chrono::Utc>,
    ) -> IngestionResult<Vec<TagReading>> {
        use sqlx::Row;

        let tenant_db_url = self.get_tenant_db_url(tenant_id).await?;

        let tenant_pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&tenant_db_url)
            .await?;

        let rows = sqlx::query(
            r#"
            SELECT
                well_id,
                tag_node_id,
                timestamp,
                value,
                quality
            FROM scada_readings
            WHERE well_id = $1
            AND timestamp >= $2
            AND timestamp <= $3
            ORDER BY timestamp DESC
            LIMIT 10000
            "#,
        )
        .bind(well_id)
        .bind(start_time)
        .bind(end_time)
        .fetch_all(&tenant_pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| TagReading {
                tenant_id,
                well_id: row.get("well_id"),
                tag_node_id: row.get("tag_node_id"),
                timestamp: row.get("timestamp"),
                value: row.get("value"),
                quality: row.get("quality"),
            })
            .collect())
    }
}
