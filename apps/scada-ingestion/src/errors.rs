//! Error types for SCADA ingestion service

use thiserror::Error;

#[derive(Error, Debug)]
#[allow(dead_code)] // Some variants reserved for full OPC-UA implementation
pub enum IngestionError {
    #[error("OPC-UA connection error: {0}")]
    OpcConnectionError(String),

    #[error("OPC-UA session error: {0}")]
    OpcSessionError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Tenant not found: {0}")]
    TenantNotFound(String),

    #[error("Connection not found: {0}")]
    ConnectionNotFound(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfiguration(String),

    #[error("Tag mapping not found: {0}")]
    TagMappingNotFound(String),

    #[error("Aggregation error: {0}")]
    AggregationError(String),
}

pub type IngestionResult<T> = Result<T, IngestionError>;
