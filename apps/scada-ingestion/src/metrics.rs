//! Prometheus metrics for SCADA ingestion service

use axum::{routing::get, Router};
use lazy_static::lazy_static;
use prometheus::{
    register_counter_vec, register_gauge_vec, register_histogram_vec, CounterVec, Encoder,
    GaugeVec, HistogramVec, TextEncoder,
};
use std::net::SocketAddr;

lazy_static! {
    /// Total number of readings ingested
    pub static ref READINGS_INGESTED: CounterVec = register_counter_vec!(
        "scada_readings_ingested_total",
        "Total number of SCADA readings ingested",
        &["tenant_id", "well_id", "tag_node_id"]
    )
    .unwrap();

    /// Number of active OPC-UA connections
    pub static ref ACTIVE_CONNECTIONS: GaugeVec = register_gauge_vec!(
        "scada_active_connections",
        "Number of active OPC-UA connections",
        &["tenant_id"]
    )
    .unwrap();

    /// OPC-UA connection errors
    pub static ref CONNECTION_ERRORS: CounterVec = register_counter_vec!(
        "scada_connection_errors_total",
        "Total number of OPC-UA connection errors",
        &["tenant_id", "connection_id", "error_type"]
    )
    .unwrap();

    /// Database write latency
    pub static ref DB_WRITE_LATENCY: HistogramVec = register_histogram_vec!(
        "scada_db_write_duration_seconds",
        "Time taken to write batch to database",
        &["tenant_id"],
        vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
    )
    .unwrap();

    /// Batch size (number of readings per write)
    pub static ref BATCH_SIZE: HistogramVec = register_histogram_vec!(
        "scada_batch_size",
        "Number of readings per database write",
        &["tenant_id"],
        vec![10.0, 50.0, 100.0, 500.0, 1000.0, 5000.0, 10000.0]
    )
    .unwrap();

    /// Readings buffer size
    pub static ref BUFFER_SIZE: GaugeVec = register_gauge_vec!(
        "scada_buffer_size",
        "Current number of readings in aggregation buffer",
        &["tenant_id"]
    )
    .unwrap();
}

pub struct MetricsServer {
    port: u16,
}

impl MetricsServer {
    pub fn new(port: u16) -> Self {
        Self { port }
    }

    pub async fn serve(self) -> anyhow::Result<()> {
        let app = Router::new().route("/metrics", get(metrics_handler));

        let addr = SocketAddr::from(([0, 0, 0, 0], self.port));
        let listener = tokio::net::TcpListener::bind(addr).await?;

        axum::serve(listener, app).await?;
        Ok(())
    }
}

async fn metrics_handler() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = vec![];
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}
