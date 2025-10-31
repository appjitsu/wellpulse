//! # SCADA Ingestion Service (Rust)
//!
//! High-performance, multi-tenant SCADA data ingestion service for WellPulse.
//!
//! ## Architecture
//!
//! ```text
//! OPC-UA RTU/PLC → OPC Client → Aggregator → TimescaleDB Writer → PostgreSQL
//!                      ↓
//!                  Prometheus Metrics
//! ```
//!
//! ## Features
//!
//! - **High Performance**: 500K+ tags/second throughput
//! - **Multi-Tenant**: Isolated data streams per tenant
//! - **Fault Tolerant**: Automatic reconnection with exponential backoff
//! - **Observable**: Prometheus metrics + structured logging
//! - **Efficient Storage**: Batch writes to TimescaleDB hypertables
//!
//! ## Responsibilities
//!
//! 1. Maintain OPC-UA connections to RTU/PLC devices
//! 2. Subscribe to tag value changes (real-time or polled)
//! 3. Aggregate readings in-memory (configurable window)
//! 4. Batch write to TimescaleDB (per-tenant schemas)
//! 5. Expose health/metrics endpoints for monitoring
//!
//! ## NOT Responsible For
//!
//! - Connection configuration (managed by NestJS API)
//! - Tag mapping configuration (managed by NestJS API)
//! - Alert generation (handled by NestJS after aggregation)
//! - User authentication (no user-facing endpoints)

use anyhow::Result;
use std::sync::Arc;
use tokio::signal;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod adapters;
mod aggregator;
mod config;
mod errors;
mod grpc;
mod health;
mod metrics;
mod opc_client; // Legacy - kept for reference, will be removed after migration
mod security;
mod tenant_router;
mod timescale_writer;

use config::Config;
use metrics::MetricsServer;
use tenant_router::TenantRouter;
use timescale_writer::TimescaleWriter;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize structured logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "scada_ingestion=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    info!(
        "Starting SCADA Ingestion Service v{}",
        env!("CARGO_PKG_VERSION")
    );

    // Load configuration
    let config = Config::from_env()?;
    info!(
        "Loaded configuration for environment: {}",
        config.environment
    );

    // Initialize database connection pool
    let db_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(config.database.max_connections)
        .connect(&config.database.url)
        .await?;
    info!("Connected to PostgreSQL database");

    // Note: TimescaleDB extension is in tenant databases, not master
    // Verification happens when writing to tenant databases

    // Initialize shared state
    let timescale_writer = Arc::new(TimescaleWriter::new(db_pool.clone()));
    let tenant_router = Arc::new(TenantRouter::new(
        db_pool.clone(),
        timescale_writer.clone(),
        config.clone(),
    ));

    // Start metrics server (Prometheus endpoint)
    let metrics_server = MetricsServer::new(config.metrics_port);
    tokio::spawn(async move {
        if let Err(e) = metrics_server.serve().await {
            error!("Metrics server error: {}", e);
        }
    });
    info!("Metrics server listening on port {}", config.metrics_port);

    // Start gRPC server (for NestJS API to query readings)
    let grpc_server = grpc::ScadaGrpcServer::new(db_pool.clone(), tenant_router.clone());
    tokio::spawn(async move {
        if let Err(e) = grpc_server.serve(config.grpc_port).await {
            error!("gRPC server error: {}", e);
        }
    });
    info!("gRPC server listening on port {}", config.grpc_port);

    // Load active SCADA connections from database and start ingestion
    tenant_router.start_all_connections().await?;
    info!("Started SCADA connections for all active tenants");

    // Graceful shutdown handler with multiple signal support
    info!("Service ready. Listening for shutdown signals (SIGTERM, SIGINT)");

    tokio::select! {
        _ = signal::ctrl_c() => {
            info!("SIGINT (Ctrl+C) received, initiating graceful shutdown...");
        }
        _ = async {
            #[cfg(unix)]
            {
                use tokio::signal::unix::{signal, SignalKind};
                let mut sigterm = signal(SignalKind::terminate()).expect("Failed to create SIGTERM handler");
                sigterm.recv().await;
            }
            #[cfg(not(unix))]
            {
                std::future::pending::<()>().await;
            }
        } => {
            info!("SIGTERM received, initiating graceful shutdown...");
        }
    }

    info!("Shutdown signal received, stopping gracefully...");

    // Disconnect all SCADA connections
    info!("Stopping all SCADA connections...");
    tenant_router.stop_all_connections().await?;
    info!("All SCADA connections stopped");

    // Close database pool
    info!("Closing database connection pool...");
    db_pool.close().await;
    info!("Database connection pool closed");

    info!("SCADA Ingestion Service stopped successfully");
    Ok(())
}
