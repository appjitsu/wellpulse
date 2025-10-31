# SCADA Ingestion Service (Rust)

High-performance, multi-tenant SCADA data ingestion microservice for WellPulse.

## Overview

The SCADA Ingestion Service is responsible for:
- Maintaining OPC-UA connections to RTU/PLC devices across multiple tenants
- Real-time data ingestion from SCADA tags
- Batching and aggregating readings for efficient storage
- Writing time-series data to TimescaleDB hypertables
- Providing gRPC API for querying readings
- Exposing Prometheus metrics for observability

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SCADA Ingestion Service                   │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  OPC Client  │───▶│  Aggregator  │───▶│   TimescaleDB│  │
│  │  (per conn)  │    │  (per tenant)│    │    Writer    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                         │          │
│         │                                         ▼          │
│         │                               ┌──────────────────┐│
│         │                               │ PostgreSQL +     ││
│         │                               │ TimescaleDB      ││
│         │                               │ (per tenant)     ││
│         │                               └──────────────────┘│
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                          │
│  │  Prometheus  │                                          │
│  │   Metrics    │                                          │
│  └──────────────┘                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              gRPC Server (port 50051)                  │ │
│  │  - Query readings                                      │ │
│  │  - Add/remove connections dynamically                  │ │
│  │  - Health checks                                       │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Performance Characteristics

| Metric | Target | Measured |
|--------|--------|----------|
| Throughput | 10,000 tags/sec | TBD (use load tester) |
| Write Latency (avg) | < 100ms | TBD |
| Write Latency (P95) | < 500ms | TBD |
| Memory Usage | < 256MB | TBD |
| CPU Usage | < 50% (4 cores) | TBD |

## Components

### 1. OPC Client (`src/opc_client.rs`)

Manages individual OPC-UA connections to RTU/PLC devices:
- Automatic reconnection with exponential backoff
- Subscription-based tag monitoring
- Supports multiple security modes (None, Sign, SignAndEncrypt)
- Real-time value change notifications

### 2. Tenant Router (`src/tenant_router.rs`)

Multi-tenant connection orchestration:
- Loads active connections from master database on startup
- Routes readings to tenant-specific aggregators
- Manages connection lifecycle (start/stop/restart)
- Dynamic connection addition/removal via gRPC

### 3. Aggregator (`src/aggregator.rs`)

In-memory batching for write efficiency:
- Configurable buffer size (default: 10,000 readings)
- Configurable flush interval (default: 5 seconds)
- Automatic flush on size threshold
- Per-tenant isolation

### 4. TimescaleDB Writer (`src/timescale_writer.rs`)

Batch persistence to time-series database:
- PostgreSQL COPY protocol for maximum throughput
- Per-tenant database connections
- Efficient UNNEST-based bulk inserts
- Query API for reading historical data

### 5. gRPC Server (`src/grpc/mod.rs`)

External API for NestJS integration:
- `QueryReadings` - Retrieve readings by well/time range
- `AddConnection` - Dynamically add OPC-UA connection
- `RemoveConnection` - Dynamically remove connection
- `HealthCheck` - Service health status

### 6. Metrics Server (`src/metrics.rs`)

Prometheus observability:
- `scada_readings_ingested_total` - Counter by tenant/well/tag
- `scada_active_connections` - Gauge by tenant
- `scada_connection_errors_total` - Counter by tenant/error type
- `scada_db_write_duration_seconds` - Histogram of write latency
- `scada_batch_size` - Histogram of batch sizes
- `scada_buffer_size` - Gauge of current buffer size

## Configuration

Environment variables (see `.env.example`):

```bash
# Database (Master DB for connection config)
DATABASE_URL=postgresql://wellpulse:wellpulse@localhost:5432/wellpulse_master

# OPC-UA Settings
OPC_CONNECTION_TIMEOUT_MS=10000
OPC_SESSION_TIMEOUT_MS=60000
OPC_MAX_RECONNECT_ATTEMPTS=5
OPC_RECONNECT_DELAY_MS=5000

# Aggregation
AGGREGATION_BUFFER_MS=5000   # Flush every 5 seconds
MAX_BUFFER_SIZE=10000         # Force flush at 10K readings

# Ports
METRICS_PORT=9090  # Prometheus endpoint
GRPC_PORT=50051    # gRPC server
```

## Building

### Development Build
```bash
cargo build
```

### Release Build (optimized)
```bash
cargo build --release
```

### Run Tests
```bash
cargo test
```

### Run Benchmarks
```bash
cargo bench
```

## Running

### Local Development
```bash
# 1. Start PostgreSQL with TimescaleDB
docker compose up -d postgres

# 2. Run migrations on tenant databases
cd apps/api
pnpm db:migrate:tenant

# 3. Run SCADA ingestion service
cd apps/scada-ingestion
cargo run
```

### Docker
```bash
docker build -t wellpulse-scada-ingestion .
docker run -p 9090:9090 -p 50051:50051 \
  --env-file .env \
  wellpulse-scada-ingestion
```

### Azure Container Apps
```bash
# Build and push to Azure Container Registry
az acr build -t scada-ingestion:latest -r wellpulse .

# Deploy to Container Apps
az containerapp update \
  --name scada-ingestion \
  --resource-group wellpulse-prod \
  --image wellpulse.azurecr.io/scada-ingestion:latest
```

## Monitoring

### Prometheus Metrics

Access metrics at `http://localhost:9090/metrics`:

```prometheus
# Query examples
scada_readings_ingested_total{tenant_id="tenant-123"}
rate(scada_readings_ingested_total[5m])
histogram_quantile(0.95, scada_db_write_duration_seconds_bucket)
```

### Grafana Dashboard

Import the provided dashboard (`monitoring/grafana-scada-dashboard.json`) to visualize:
- Ingestion throughput (readings/sec)
- Database write latency
- Buffer sizes and flush rates
- Active connections
- Error rates

### Logging

Structured JSON logs (compatible with Azure Log Analytics):

```json
{
  "timestamp": "2025-01-30T14:23:45Z",
  "level": "INFO",
  "tenant_id": "tenant-123",
  "connection_id": "conn-456",
  "message": "OPC-UA connection established",
  "tags_count": 10
}
```

## Load Testing

Use the provided load testing simulator:

```bash
cd scripts/load-testing
pip install -r requirements.txt

# Normal load (50 wells, 500 tags/sec)
python scada_load_simulator.py --mode normal

# Peak load (200 wells, 2000 tags/sec)
python scada_load_simulator.py --mode peak

# Stress test (1000 wells, 10K tags/sec)
python scada_load_simulator.py --mode stress
```

## Integration with NestJS API

The Rust service integrates with the NestJS API via gRPC:

### 1. NestJS creates SCADA connection
```typescript
// NestJS Controller
POST /scada/connections
→ Writes to master DB (scada_connections table)
→ (Optional) Notifies Rust service via gRPC to start connection
```

### 2. Rust service loads connections
```rust
// On startup or periodically
SELECT * FROM scada_connections WHERE is_active = true
→ Establishes OPC-UA connections
→ Starts data ingestion
```

### 3. NestJS queries readings
```typescript
// NestJS Service
const readings = await scadaGrpcClient.queryReadings({
  tenantId,
  wellId,
  startTime,
  endTime,
});
```

## TimescaleDB Schema

### Hypertable: `scada_readings`

```sql
CREATE TABLE scada_readings (
    timestamp TIMESTAMPTZ NOT NULL,
    well_id UUID NOT NULL,
    tag_node_id TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    quality TEXT NOT NULL DEFAULT 'Good',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable (24-hour chunks)
SELECT create_hypertable('scada_readings', 'timestamp',
  chunk_time_interval => INTERVAL '24 hours');

-- Compression (95% storage savings)
ALTER TABLE scada_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'well_id, tag_node_id'
);

-- Retention policy (2 years)
SELECT add_retention_policy('scada_readings', INTERVAL '2 years');
```

### Continuous Aggregates

Pre-computed rollups for faster queries:

```sql
-- Hourly rollups
CREATE MATERIALIZED VIEW scada_readings_hourly ...
-- Daily rollups
CREATE MATERIALIZED VIEW scada_readings_daily ...
-- Monthly rollups
CREATE MATERIALIZED VIEW scada_readings_monthly ...
```

## Troubleshooting

### High Memory Usage
- Reduce `MAX_BUFFER_SIZE` to flush more frequently
- Check for connection leaks (monitor active connections)
- Ensure aggregators are flushing properly

### Slow Database Writes
- Check TimescaleDB chunk compression status
- Verify indexes are being used (`EXPLAIN ANALYZE`)
- Monitor PostgreSQL connection pool utilization
- Check network latency to database

### OPC-UA Connection Failures
- Verify RTU/PLC is accessible on network
- Check security mode/policy configuration
- Validate username/password credentials
- Review OPC-UA server logs

### Missing Readings
- Check tag mapping configuration (node IDs)
- Verify tag subscriptions are active
- Review Prometheus metrics for errors
- Check buffer flush intervals

## Development

### Project Structure
```
scada-ingestion/
├── src/
│   ├── main.rs              # Entry point
│   ├── config.rs            # Configuration management
│   ├── errors.rs            # Error types
│   ├── metrics.rs           # Prometheus metrics
│   ├── opc_client.rs        # OPC-UA client
│   ├── tenant_router.rs     # Multi-tenant routing
│   ├── aggregator.rs        # Batching logic
│   ├── timescale_writer.rs  # Database persistence
│   └── grpc/
│       └── mod.rs           # gRPC server
├── proto/
│   └── scada.proto          # gRPC protocol definition
├── Cargo.toml               # Dependencies
├── Dockerfile               # Container image
└── README.md                # This file
```

### Adding Dependencies
```bash
cargo add tokio --features full
cargo add serde --features derive
```

### Code Quality
```bash
# Format code
cargo fmt

# Lint
cargo clippy

# Security audit
cargo audit
```

## Performance Tuning

### 1. Aggregation Buffer
- **Small buffer** (1K): Lower memory, higher DB load
- **Large buffer** (50K): Higher memory, lower DB load
- **Recommended**: 10K for balance

### 2. Flush Interval
- **Short interval** (1s): Near real-time, higher DB load
- **Long interval** (30s): Batch efficiency, higher latency
- **Recommended**: 5s for balance

### 3. Database Connection Pool
- **Small pool** (2): Lower memory, potential bottleneck
- **Large pool** (20): Higher memory, better throughput
- **Recommended**: 5-10 per tenant

## Security

### Authentication
- OPC-UA username/password stored encrypted in database
- gRPC uses mTLS for inter-service communication
- No public-facing endpoints (internal network only)

### Network
- Runs in private Azure Virtual Network
- Only NestJS API can communicate via gRPC
- Metrics endpoint restricted to monitoring subnet

### Data
- All readings encrypted at rest (Azure managed keys)
- Tenant data isolation (separate databases)
- Audit logging for all configuration changes

## Contributing

1. Follow Rust best practices (Clippy rules)
2. Add tests for new features
3. Update metrics when adding functionality
4. Document configuration changes
5. Run benchmarks before/after performance changes

## License

Proprietary - WellPulse Platform
