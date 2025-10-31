-- SCADA Readings Table (TimescaleDB Hypertable)
-- Stores high-frequency time-series SCADA data from field sensors

CREATE TABLE IF NOT EXISTS "scada_readings" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"scada_connection_id" varchar(100) NOT NULL,
	"tag_name" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"data_type" varchar(20) NOT NULL,
	"quality" varchar(20) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"unit" varchar(50),
	"min_value" double precision,
	"max_value" double precision,
	"metadata" jsonb
);
--> statement-breakpoint

-- Alarms Table
-- Stores SCADA alarm conditions with full lifecycle tracking

CREATE TABLE IF NOT EXISTS "alarms" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"scada_connection_id" varchar(100) NOT NULL,
	"tag_name" varchar(100) NOT NULL,
	"alarm_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"state" varchar(20) NOT NULL,
	"message" varchar(500) NOT NULL,
	"value" jsonb,
	"threshold" double precision,
	"trigger_count" integer DEFAULT 1 NOT NULL,
	"first_triggered_at" timestamp with time zone NOT NULL,
	"last_triggered_at" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(100),
	"cleared_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- SCADA Readings Indexes
CREATE INDEX IF NOT EXISTS "scada_readings_tenant_id_idx" ON "scada_readings" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scada_readings_well_id_idx" ON "scada_readings" USING btree ("well_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scada_readings_connection_id_idx" ON "scada_readings" USING btree ("scada_connection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scada_readings_tag_name_idx" ON "scada_readings" USING btree ("tag_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scada_readings_timestamp_idx" ON "scada_readings" USING btree ("timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scada_readings_well_time_idx" ON "scada_readings" USING btree ("tenant_id","well_id","timestamp" DESC);
--> statement-breakpoint

-- Alarms Indexes
CREATE INDEX IF NOT EXISTS "alarms_tenant_id_idx" ON "alarms" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alarms_well_id_idx" ON "alarms" USING btree ("well_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alarms_state_idx" ON "alarms" USING btree ("state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alarms_severity_idx" ON "alarms" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alarms_active_idx" ON "alarms" USING btree ("tenant_id","well_id","state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alarms_unique_idx" ON "alarms" USING btree ("tenant_id","well_id","scada_connection_id","tag_name","alarm_type");
--> statement-breakpoint

-- TimescaleDB Hypertable Configuration (optional - requires TimescaleDB extension)
-- Uncomment if TimescaleDB is enabled in your database
-- SELECT create_hypertable('scada_readings', 'timestamp', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');

-- Retention Policy (optional - auto-delete data older than 2 years)
-- SELECT add_retention_policy('scada_readings', INTERVAL '2 years', if_not_exists => TRUE);
