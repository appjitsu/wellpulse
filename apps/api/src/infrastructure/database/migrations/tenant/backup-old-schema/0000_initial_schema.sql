-- Initial Tenant Schema Migration
-- Created: 2025-10-30
-- Includes all tenant tables with corrected UUID types

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Users table
CREATE TABLE IF NOT EXISTS "tenant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"role_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	CONSTRAINT "tenant_users_email_unique" UNIQUE("email")
);

-- Wells table
CREATE TABLE IF NOT EXISTS "wells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_number" varchar(14) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"operator" varchar(255),
	"field" varchar(255),
	"county" varchar(100),
	"state" varchar(2),
	"latitude" double precision,
	"longitude" double precision,
	"spud_date" timestamp,
	"completion_date" timestamp,
	"first_production_date" timestamp,
	"total_depth" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	CONSTRAINT "wells_api_number_unique" UNIQUE("api_number")
);

-- Wells read projection
CREATE TABLE IF NOT EXISTS "wells_read_projection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_number" varchar(14) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"operator" varchar(255),
	"field" varchar(255),
	"county" varchar(100),
	"state" varchar(2),
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wells_read_projection_api_number_unique" UNIQUE("api_number")
);

-- Field entries table (corrected to UUID)
CREATE TABLE IF NOT EXISTS "field_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"entry_type" varchar(20) NOT NULL,
	"production_data" jsonb,
	"inspection_data" jsonb,
	"maintenance_data" jsonb,
	"recorded_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"device_id" text NOT NULL,
	"latitude" real,
	"longitude" real,
	"photos" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);

-- Nominal ranges table
CREATE TABLE IF NOT EXISTS "nominal_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"well_id" uuid,
	"field_name" varchar(100) NOT NULL,
	"min_value" numeric(10, 2),
	"max_value" numeric(10, 2),
	"unit" varchar(20),
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid
);

-- Alert preferences table
CREATE TABLE IF NOT EXISTS "alert_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"channels" jsonb DEFAULT '{"email":true,"sms":false,"push":false}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Alerts table
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"well_id" uuid,
	"field_entry_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"field_name" varchar(100),
	"actual_value" numeric(10, 2),
	"expected_min" numeric(10, 2),
	"expected_max" numeric(10, 2),
	"message" text NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"actor_id" uuid NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

-- SCADA connections table
CREATE TABLE IF NOT EXISTS "scada_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"endpoint_url" varchar(500) NOT NULL,
	"security_mode" varchar(50) NOT NULL,
	"security_policy" varchar(50) NOT NULL,
	"username" text,
	"password" text,
	"poll_interval_seconds" integer DEFAULT 60 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_connected_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);

-- Tag mappings table
CREATE TABLE IF NOT EXISTS "tag_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"opc_node_id" varchar(500) NOT NULL,
	"tag_name" varchar(255) NOT NULL,
	"data_type" varchar(50) NOT NULL,
	"unit" varchar(50),
	"scaling_factor" double precision DEFAULT 1,
	"deadband" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);

-- SCADA readings hypertable (TimescaleDB)
CREATE TABLE IF NOT EXISTS "scada_readings" (
	"timestamp" timestamp with time zone NOT NULL,
	"well_id" uuid NOT NULL,
	"tag_node_id" text NOT NULL,
	"value" double precision NOT NULL,
	"quality" text DEFAULT 'Good' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "field_entries" ADD CONSTRAINT "field_entries_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "nominal_ranges" ADD CONSTRAINT "nominal_ranges_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_tenant_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_field_entry_id_field_entries_id_fk" FOREIGN KEY ("field_entry_id") REFERENCES "public"."field_entries"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_tenant_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_connection_id_scada_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."scada_connections"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes
CREATE INDEX IF NOT EXISTS "tenant_users_tenant_id_idx" ON "tenant_users" ("tenant_id");
CREATE INDEX IF NOT EXISTS "field_entries_tenant_id_idx" ON "field_entries" ("tenant_id");
CREATE INDEX IF NOT EXISTS "field_entries_well_id_idx" ON "field_entries" ("well_id");
CREATE INDEX IF NOT EXISTS "field_entries_entry_type_idx" ON "field_entries" ("entry_type");
CREATE INDEX IF NOT EXISTS "field_entries_recorded_at_idx" ON "field_entries" ("recorded_at");
CREATE INDEX IF NOT EXISTS "field_entries_synced_at_idx" ON "field_entries" ("synced_at");
CREATE INDEX IF NOT EXISTS "field_entries_created_by_idx" ON "field_entries" ("created_by");
CREATE INDEX IF NOT EXISTS "field_entries_well_recorded_idx" ON "field_entries" ("well_id","recorded_at");
CREATE INDEX IF NOT EXISTS "field_entries_tenant_type_idx" ON "field_entries" ("tenant_id","entry_type");
CREATE INDEX IF NOT EXISTS "field_entries_deleted_at_idx" ON "field_entries" ("deleted_at");
CREATE INDEX IF NOT EXISTS "nominal_ranges_tenant_id_idx" ON "nominal_ranges" ("tenant_id");
CREATE INDEX IF NOT EXISTS "nominal_ranges_well_id_idx" ON "nominal_ranges" ("well_id");
CREATE INDEX IF NOT EXISTS "nominal_ranges_field_name_idx" ON "nominal_ranges" ("field_name");
CREATE INDEX IF NOT EXISTS "nominal_ranges_tenant_well_field_idx" ON "nominal_ranges" ("tenant_id","well_id","field_name");
CREATE INDEX IF NOT EXISTS "alert_preferences_tenant_id_idx" ON "alert_preferences" ("tenant_id");
CREATE INDEX IF NOT EXISTS "alert_preferences_user_id_idx" ON "alert_preferences" ("user_id");
CREATE INDEX IF NOT EXISTS "alert_preferences_alert_type_idx" ON "alert_preferences" ("alert_type");
CREATE INDEX IF NOT EXISTS "alert_preferences_tenant_user_type_idx" ON "alert_preferences" ("tenant_id","user_id","alert_type");
CREATE INDEX IF NOT EXISTS "alerts_tenant_id_idx" ON "alerts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "alerts_well_id_idx" ON "alerts" ("well_id");
CREATE INDEX IF NOT EXISTS "alerts_field_entry_id_idx" ON "alerts" ("field_entry_id");
CREATE INDEX IF NOT EXISTS "alerts_created_at_idx" ON "alerts" ("created_at");
CREATE INDEX IF NOT EXISTS "alerts_severity_idx" ON "alerts" ("severity");
CREATE INDEX IF NOT EXISTS "alerts_acknowledged_idx" ON "alerts" ("acknowledged_at");
CREATE INDEX IF NOT EXISTS "alerts_tenant_well_idx" ON "alerts" ("tenant_id","well_id");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_idx" ON "audit_logs" ("entity_type");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_id_idx" ON "audit_logs" ("entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_entity_idx" ON "audit_logs" ("tenant_id","entity_type","entity_id");
CREATE INDEX IF NOT EXISTS "scada_connections_tenant_id_idx" ON "scada_connections" ("tenant_id");
CREATE INDEX IF NOT EXISTS "scada_connections_well_id_idx" ON "scada_connections" ("well_id");
CREATE INDEX IF NOT EXISTS "scada_connections_is_enabled_idx" ON "scada_connections" ("is_enabled");
CREATE INDEX IF NOT EXISTS "tag_mappings_tenant_id_idx" ON "tag_mappings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tag_mappings_connection_id_idx" ON "tag_mappings" ("connection_id");
CREATE INDEX IF NOT EXISTS "tag_mappings_well_id_idx" ON "tag_mappings" ("well_id");
CREATE INDEX IF NOT EXISTS "tag_mappings_opc_node_id_idx" ON "tag_mappings" ("opc_node_id");
CREATE INDEX IF NOT EXISTS "scada_readings_well_tag_time_idx" ON "scada_readings" ("well_id","tag_node_id","timestamp" DESC);
CREATE INDEX IF NOT EXISTS "scada_readings_well_time_idx" ON "scada_readings" ("well_id","timestamp" DESC);
CREATE INDEX IF NOT EXISTS "scada_readings_tag_time_idx" ON "scada_readings" ("tag_node_id","timestamp" DESC);

-- Convert scada_readings to TimescaleDB hypertable
SELECT create_hypertable('scada_readings', 'timestamp', chunk_time_interval => INTERVAL '24 hours', if_not_exists => TRUE);

-- Add compression policy
ALTER TABLE scada_readings SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'well_id, tag_node_id',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('scada_readings', INTERVAL '7 days', if_not_exists => TRUE);

-- Add retention policy
SELECT add_retention_policy('scada_readings', INTERVAL '2 years', if_not_exists => TRUE);

-- Create continuous aggregates
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
GROUP BY hour, well_id, tag_node_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('scada_readings_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

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
GROUP BY day, well_id, tag_node_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('scada_readings_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);
