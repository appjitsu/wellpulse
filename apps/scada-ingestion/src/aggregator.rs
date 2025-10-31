//! In-memory aggregation buffer for SCADA readings
//!
//! Batches readings before writing to TimescaleDB to reduce write pressure.
//! Flushes based on time window or buffer size threshold.

use crate::config::AggregationConfig;
use crate::errors::IngestionResult;
use crate::metrics::{BATCH_SIZE, BUFFER_SIZE};
use crate::opc_client::TagReading;
use crate::timescale_writer::TimescaleWriter;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{Duration, Instant};
use tracing::{debug, error, info};
use uuid::Uuid;

pub struct Aggregator {
    tenant_id: Uuid,
    writer: Arc<TimescaleWriter>,
    config: AggregationConfig,
    /// In-memory buffer of pending readings
    buffer: Arc<RwLock<Vec<TagReading>>>,
    /// Last flush timestamp
    last_flush: Arc<RwLock<Instant>>,
}

impl Aggregator {
    pub fn new(tenant_id: Uuid, writer: Arc<TimescaleWriter>, config: AggregationConfig) -> Self {
        let max_buffer_size = config.max_buffer_size;
        Self {
            tenant_id,
            writer,
            config,
            buffer: Arc::new(RwLock::new(Vec::with_capacity(max_buffer_size))),
            last_flush: Arc::new(RwLock::new(Instant::now())),
        }
    }

    /// Start the aggregator background task
    pub async fn start(&self) {
        let buffer = self.buffer.clone();
        let last_flush = self.last_flush.clone();
        let tenant_id = self.tenant_id;
        let writer = self.writer.clone();
        let flush_interval = Duration::from_millis(self.config.buffer_duration_ms);

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(flush_interval);

            loop {
                interval.tick().await;

                let elapsed = last_flush.read().await.elapsed();
                if elapsed >= flush_interval {
                    let readings = {
                        let mut buf = buffer.write().await;
                        if buf.is_empty() {
                            continue;
                        }
                        std::mem::take(&mut *buf)
                    };

                    if !readings.is_empty() {
                        let count = readings.len();
                        debug!(
                            tenant_id = %tenant_id,
                            count = count,
                            "Flushing aggregation buffer (time-based)"
                        );

                        if let Err(e) = writer.write_batch(tenant_id, readings).await {
                            error!(
                                tenant_id = %tenant_id,
                                "Failed to write batch: {}",
                                e
                            );
                        } else {
                            BATCH_SIZE
                                .with_label_values(&[&tenant_id.to_string()])
                                .observe(count as f64);
                        }

                        *last_flush.write().await = Instant::now();
                    }
                }
            }
        });

        info!(
            tenant_id = %self.tenant_id,
            flush_interval_ms = self.config.buffer_duration_ms,
            max_buffer_size = self.config.max_buffer_size,
            "Started aggregator"
        );
    }

    /// Add a reading to the buffer
    pub async fn add_reading(&self, reading: TagReading) {
        let mut buffer = self.buffer.write().await;
        buffer.push(reading);

        let buffer_size = buffer.len();

        // Update metrics
        BUFFER_SIZE
            .with_label_values(&[&self.tenant_id.to_string()])
            .set(buffer_size as f64);

        // Check if we need to flush due to size
        if buffer_size >= self.config.max_buffer_size {
            drop(buffer); // Release lock before flushing
            if let Err(e) = self.flush_internal("size-based").await {
                error!("Failed to flush buffer: {}", e);
            }
        }
    }

    /// Force flush the buffer (called during shutdown or size threshold)
    pub async fn flush(&self) -> IngestionResult<()> {
        self.flush_internal("manual").await
    }

    /// Internal flush implementation
    async fn flush_internal(&self, reason: &str) -> IngestionResult<()> {
        let readings = {
            let mut buffer = self.buffer.write().await;
            if buffer.is_empty() {
                return Ok(());
            }
            std::mem::take(&mut *buffer)
        };

        let count = readings.len();
        debug!(
            tenant_id = %self.tenant_id,
            count = count,
            reason = reason,
            "Flushing aggregation buffer"
        );

        self.writer.write_batch(self.tenant_id, readings).await?;

        BATCH_SIZE
            .with_label_values(&[&self.tenant_id.to_string()])
            .observe(count as f64);

        BUFFER_SIZE
            .with_label_values(&[&self.tenant_id.to_string()])
            .set(0.0);

        *self.last_flush.write().await = Instant::now();

        Ok(())
    }

    /// Get current buffer statistics
    #[allow(dead_code)] // Reserved for metrics/monitoring endpoints
    pub async fn stats(&self) -> AggregatorStats {
        let buffer = self.buffer.read().await;
        let last_flush = self.last_flush.read().await;

        AggregatorStats {
            tenant_id: self.tenant_id,
            buffer_size: buffer.len(),
            time_since_last_flush: last_flush.elapsed(),
        }
    }
}

#[derive(Debug)]
#[allow(dead_code)] // Reserved for metrics/monitoring endpoints
pub struct AggregatorStats {
    pub tenant_id: Uuid,
    pub buffer_size: usize,
    pub time_since_last_flush: Duration,
}
