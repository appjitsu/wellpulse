//! Configuration management for SCADA ingestion service
//!
//! Loads configuration from environment variables with sensible defaults.

use anyhow::Result;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub environment: String,
    pub database: DatabaseConfig,
    #[allow(dead_code)] // Reserved for full OPC-UA implementation
    pub opc_ua: OpcUaConfig,
    pub metrics_port: u16,
    pub grpc_port: u16,
    pub aggregation: AggregationConfig,
}

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // Reserved for full OPC-UA implementation
pub struct OpcUaConfig {
    pub connection_timeout_ms: u64,
    pub session_timeout_ms: u64,
    pub max_reconnect_attempts: u32,
    pub reconnect_delay_ms: u64,
}

#[derive(Debug, Clone)]
pub struct AggregationConfig {
    /// How long to buffer readings before writing (milliseconds)
    pub buffer_duration_ms: u64,
    /// Maximum buffer size before forced flush
    pub max_buffer_size: usize,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenv::dotenv().ok(); // Load .env file if present

        Ok(Config {
            environment: env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string()),
            database: DatabaseConfig {
                url: env::var("DATABASE_URL")
                    .expect("DATABASE_URL must be set (master DB for connection config)"),
                max_connections: env::var("DB_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "20".to_string())
                    .parse()?,
            },
            opc_ua: OpcUaConfig {
                connection_timeout_ms: env::var("OPC_CONNECTION_TIMEOUT_MS")
                    .unwrap_or_else(|_| "10000".to_string())
                    .parse()?,
                session_timeout_ms: env::var("OPC_SESSION_TIMEOUT_MS")
                    .unwrap_or_else(|_| "60000".to_string())
                    .parse()?,
                max_reconnect_attempts: env::var("OPC_MAX_RECONNECT_ATTEMPTS")
                    .unwrap_or_else(|_| "5".to_string())
                    .parse()?,
                reconnect_delay_ms: env::var("OPC_RECONNECT_DELAY_MS")
                    .unwrap_or_else(|_| "5000".to_string())
                    .parse()?,
            },
            metrics_port: env::var("METRICS_PORT")
                .unwrap_or_else(|_| "9090".to_string())
                .parse()?,
            grpc_port: env::var("GRPC_PORT")
                .unwrap_or_else(|_| "50051".to_string())
                .parse()?,
            aggregation: AggregationConfig {
                buffer_duration_ms: env::var("AGGREGATION_BUFFER_MS")
                    .unwrap_or_else(|_| "5000".to_string()) // 5 seconds
                    .parse()?,
                max_buffer_size: env::var("MAX_BUFFER_SIZE")
                    .unwrap_or_else(|_| "10000".to_string())
                    .parse()?,
            },
        })
    }
}
