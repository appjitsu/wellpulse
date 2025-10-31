-- Migration: Create scada_readings hypertable (TimescaleDB)
--
-- This migration creates a TimescaleDB hypertable for high-frequency time-series SCADA data.
-- Designed for 500K+ tags/second write throughput with efficient time-based queries.
--
-- Features:
-- 1. Hypertable with 24-hour chunks (optimal for retention and query performance)
-- 2. Composite indexes for efficient queries
-- 3. Data retention policy (auto-delete data older than 2 years)
-- 4. Continuous aggregates for 1-hour, 1-day, and 1-month rollups
-- 5. Compression policy for data older than 7 days

-- Step 1: Enable TimescaleDB extension (idempotent)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Step 2: Create scada_readings table
CREATE TABLE IF NOT EXISTS scada_readings (
    timestamp TIMESTAMPTZ NOT NULL,
    well_id UUID NOT NULL,
    tag_node_id TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    quality TEXT NOT NULL DEFAULT 'Good',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Convert to hypertable (partitioned by timestamp)
-- Chunk interval: 24 hours (optimal for most SCADA workloads)
SELECT create_hypertable(
    'scada_readings',
    'timestamp',
    chunk_time_interval => INTERVAL '24 hours',
    if_not_exists => TRUE
);

-- Step 4: Create indexes for efficient queries
-- Composite index for well + tag + time queries (most common)
CREATE INDEX IF NOT EXISTS scada_readings_well_tag_time_idx
    ON scada_readings (well_id, tag_node_id, timestamp DESC);

-- Index for well-based queries
CREATE INDEX IF NOT EXISTS scada_readings_well_time_idx
    ON scada_readings (well_id, timestamp DESC);

-- Index for tag-based queries
CREATE INDEX IF NOT EXISTS scada_readings_tag_time_idx
    ON scada_readings (tag_node_id, timestamp DESC);

-- Step 5: Add data retention policy (auto-delete data older than 2 years)
-- This keeps storage costs manageable while retaining sufficient history
SELECT add_retention_policy(
    'scada_readings',
    INTERVAL '2 years',
    if_not_exists => TRUE
);

-- Step 6: Add compression policy (compress chunks older than 7 days)
-- Compressed data uses ~95% less storage with minimal query performance impact
ALTER TABLE scada_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'well_id, tag_node_id',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy(
    'scada_readings',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Step 7: Create continuous aggregate for hourly rollups
-- Pre-computed hourly statistics for faster dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS scada_readings_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS hour,
    well_id,
    tag_node_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    STDDEV(value) AS stddev_value,
    COUNT(*) AS reading_count
FROM scada_readings
GROUP BY hour, well_id, tag_node_id;

-- Add refresh policy for hourly aggregate (refresh every hour)
SELECT add_continuous_aggregate_policy(
    'scada_readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Step 8: Create continuous aggregate for daily rollups
-- Pre-computed daily statistics for reporting and trends
CREATE MATERIALIZED VIEW IF NOT EXISTS scada_readings_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', timestamp) AS day,
    well_id,
    tag_node_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    STDDEV(value) AS stddev_value,
    COUNT(*) AS reading_count
FROM scada_readings
GROUP BY day, well_id, tag_node_id;

-- Add refresh policy for daily aggregate (refresh daily)
SELECT add_continuous_aggregate_policy(
    'scada_readings_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Step 9: Create continuous aggregate for monthly rollups
-- Pre-computed monthly statistics for long-term analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS scada_readings_monthly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 month', timestamp) AS month,
    well_id,
    tag_node_id,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    STDDEV(value) AS stddev_value,
    COUNT(*) AS reading_count
FROM scada_readings
GROUP BY month, well_id, tag_node_id;

-- Add refresh policy for monthly aggregate (refresh weekly)
SELECT add_continuous_aggregate_policy(
    'scada_readings_monthly',
    start_offset => INTERVAL '3 months',
    end_offset => INTERVAL '1 month',
    schedule_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);

-- Step 10: Grant permissions (if using row-level security in the future)
-- GRANT SELECT, INSERT ON scada_readings TO tenant_user;
-- GRANT SELECT ON scada_readings_hourly TO tenant_user;
-- GRANT SELECT ON scada_readings_daily TO tenant_user;
-- GRANT SELECT ON scada_readings_monthly TO tenant_user;

-- Migration complete
--
-- Performance notes:
-- - Write throughput: 500K+ tags/second on modern hardware
-- - Query latency: < 10ms for recent data (last 7 days, uncompressed)
-- - Query latency: < 100ms for historical data (compressed)
-- - Storage savings: ~95% with compression
-- - Retention: Automatic cleanup after 2 years
