//! gRPC server for querying SCADA readings
//!
//! Provides an interface for the NestJS API to query readings
//! and manage connections dynamically.

use crate::opc_client::{OpcConnectionConfig, TagConfig};
use crate::tenant_router::TenantRouter;
use crate::timescale_writer::TimescaleWriter;
use sqlx::PgPool;
use std::sync::Arc;
use tonic::{transport::Server, Request, Response, Status};
use tracing::{debug, error, info};
use uuid::Uuid;

// Include generated protobuf code
pub mod scada {
    tonic::include_proto!("scada");
}

use scada::scada_service_server::{ScadaService, ScadaServiceServer};
use scada::*;

pub struct ScadaGrpcServer {
    db_pool: PgPool,
    tenant_router: Arc<TenantRouter>,
}

impl ScadaGrpcServer {
    pub fn new(db_pool: PgPool, tenant_router: Arc<TenantRouter>) -> Self {
        Self {
            db_pool,
            tenant_router,
        }
    }

    pub async fn serve(self, port: u16) -> anyhow::Result<()> {
        let addr = format!("0.0.0.0:{}", port).parse()?;

        info!("Starting gRPC server on {}", addr);

        Server::builder()
            .add_service(ScadaServiceServer::new(self))
            .serve(addr)
            .await?;

        Ok(())
    }
}

#[tonic::async_trait]
impl ScadaService for ScadaGrpcServer {
    async fn query_readings(
        &self,
        request: Request<QueryReadingsRequest>,
    ) -> Result<Response<QueryReadingsResponse>, Status> {
        let req = request.into_inner();

        debug!(
            tenant_id = %req.tenant_id,
            well_id = %req.well_id,
            "Querying readings"
        );

        let tenant_id = Uuid::parse_str(&req.tenant_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid tenant_id: {}", e)))?;

        let well_id = Uuid::parse_str(&req.well_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid well_id: {}", e)))?;

        let start_time = chrono::DateTime::from_timestamp(req.start_time, 0)
            .ok_or_else(|| Status::invalid_argument("Invalid start_time"))?;

        let end_time = chrono::DateTime::from_timestamp(req.end_time, 0)
            .ok_or_else(|| Status::invalid_argument("Invalid end_time"))?;

        // Query from TimescaleDB via writer
        let writer = TimescaleWriter::new(self.db_pool.clone());

        let readings = writer
            .query_readings(tenant_id, well_id, start_time, end_time)
            .await
            .map_err(|e| Status::internal(format!("Database error: {}", e)))?;

        let response = QueryReadingsResponse {
            readings: readings
                .into_iter()
                .map(|r| Reading {
                    well_id: r.well_id.to_string(),
                    tag_node_id: r.tag_node_id,
                    timestamp: r.timestamp.timestamp(),
                    value: r.value,
                    quality: r.quality,
                })
                .collect(),
        };

        Ok(Response::new(response))
    }

    async fn get_aggregator_stats(
        &self,
        request: Request<GetAggregatorStatsRequest>,
    ) -> Result<Response<GetAggregatorStatsResponse>, Status> {
        let req = request.into_inner();

        let tenant_id = Uuid::parse_str(&req.tenant_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid tenant_id: {}", e)))?;

        // Get stats from tenant router
        // Note: This requires adding a method to TenantRouter
        // For now, return a placeholder

        let response = GetAggregatorStatsResponse {
            tenant_id: tenant_id.to_string(),
            buffer_size: 0, // TODO: Implement
            time_since_last_flush_ms: 0,
        };

        Ok(Response::new(response))
    }

    async fn add_connection(
        &self,
        request: Request<AddConnectionRequest>,
    ) -> Result<Response<AddConnectionResponse>, Status> {
        let req = request.into_inner();

        info!(
            tenant_id = %req.tenant_id,
            connection_id = %req.connection_id,
            "Adding SCADA connection via gRPC"
        );

        let connection_id = Uuid::parse_str(&req.connection_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid connection_id: {}", e)))?;

        let tenant_id = Uuid::parse_str(&req.tenant_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid tenant_id: {}", e)))?;

        let tags = req
            .tags
            .into_iter()
            .map(|t| {
                Ok(TagConfig {
                    tag_id: Uuid::parse_str(&t.tag_id)
                        .map_err(|e| Status::invalid_argument(format!("Invalid tag_id: {}", e)))?,
                    well_id: Uuid::parse_str(&t.well_id)
                        .map_err(|e| Status::invalid_argument(format!("Invalid well_id: {}", e)))?,
                    node_id: t.node_id,
                    data_type: t.data_type,
                })
            })
            .collect::<Result<Vec<_>, Status>>()?;

        let config = OpcConnectionConfig {
            connection_id,
            tenant_id,
            endpoint_url: req.endpoint_url,
            security_mode: req.security_mode,
            security_policy: req.security_policy,
            username: req.username,
            password: req.password,
            tags,
        };

        match self.tenant_router.add_connection(config).await {
            Ok(_) => Ok(Response::new(AddConnectionResponse {
                success: true,
                error: None,
            })),
            Err(e) => Ok(Response::new(AddConnectionResponse {
                success: false,
                error: Some(e.to_string()),
            })),
        }
    }

    async fn remove_connection(
        &self,
        request: Request<RemoveConnectionRequest>,
    ) -> Result<Response<RemoveConnectionResponse>, Status> {
        let req = request.into_inner();

        let connection_id = Uuid::parse_str(&req.connection_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid connection_id: {}", e)))?;

        match self.tenant_router.remove_connection(connection_id).await {
            Ok(_) => Ok(Response::new(RemoveConnectionResponse { success: true })),
            Err(e) => {
                error!("Failed to remove connection: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    async fn health_check(
        &self,
        _request: Request<HealthCheckRequest>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        // TODO: Implement proper health check with actual metrics
        Ok(Response::new(HealthCheckResponse {
            status: "healthy".to_string(),
            active_connections: 0, // TODO: Get from tenant router
            active_tenants: 0,
        }))
    }
}
