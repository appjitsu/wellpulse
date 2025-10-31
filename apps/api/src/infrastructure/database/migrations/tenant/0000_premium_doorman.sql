CREATE TYPE "public"."conflict_strategy" AS ENUM('skip', 'overwrite', 'merge');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"azure_object_id" varchar(255),
	"sso_provider" varchar(50),
	"role" varchar(50) DEFAULT 'OPERATOR' NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"email_verified" boolean DEFAULT false,
	"email_verification_code" varchar(10),
	"email_verification_expires" timestamp,
	"password_reset_token" varchar(100),
	"password_reset_expires" timestamp,
	"last_login_at" timestamp,
	"refresh_token_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	CONSTRAINT "tenant_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"api_number" varchar(20) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"lease" varchar(255),
	"field" varchar(255),
	"operator" varchar(255),
	"spud_date" timestamp,
	"completion_date" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	CONSTRAINT "wells_api_number_unique" UNIQUE("api_number")
);
--> statement-breakpoint
CREATE TABLE "wells_read_projection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"api_number" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"lease" varchar(255),
	"field" varchar(255),
	"operator" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "wells_read_projection_api_number_unique" UNIQUE("api_number")
);
--> statement-breakpoint
CREATE TABLE "field_entries" (
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
--> statement-breakpoint
CREATE TABLE "org_nominal_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"well_type" varchar(50),
	"min_value" numeric(10, 2),
	"max_value" numeric(10, 2),
	"unit" varchar(20) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "well_nominal_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"well_id" uuid NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"min_value" numeric(10, 2),
	"max_value" numeric(10, 2),
	"unit" varchar(20) NOT NULL,
	"severity" varchar(20) DEFAULT 'warning' NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "alert_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"channels" jsonb DEFAULT '{"email":true,"sms":false,"push":false}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
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
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"user_id" uuid,
	"payload" jsonb NOT NULL,
	"metadata" jsonb,
	"tenant_id" uuid NOT NULL,
	CONSTRAINT "audit_logs_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "scada_connections" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"endpoint_config" jsonb NOT NULL,
	"poll_interval_seconds" integer DEFAULT 5 NOT NULL,
	"status" varchar(20) DEFAULT 'inactive' NOT NULL,
	"last_connected_at" timestamp,
	"last_error_message" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_mappings" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scada_connection_id" varchar(100) NOT NULL,
	"configuration" jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_value" text,
	"last_read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scada_readings" (
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
CREATE TABLE "alarms" (
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
CREATE TABLE "csv_import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"well_id" varchar(255),
	"entry_date" timestamp with time zone,
	"error_message" text NOT NULL,
	"raw_row" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "csv_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"status" "import_status" DEFAULT 'queued' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"rows_processed" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"rows_skipped" integer DEFAULT 0 NOT NULL,
	"column_mapping" jsonb NOT NULL,
	"conflict_strategy" "conflict_strategy" DEFAULT 'skip' NOT NULL,
	"error_summary" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "wells" ADD CONSTRAINT "wells_created_by_tenant_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wells" ADD CONSTRAINT "wells_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wells" ADD CONSTRAINT "wells_deleted_by_tenant_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_entries" ADD CONSTRAINT "field_entries_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_nominal_ranges" ADD CONSTRAINT "org_nominal_ranges_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_nominal_ranges" ADD CONSTRAINT "well_nominal_ranges_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_nominal_ranges" ADD CONSTRAINT "well_nominal_ranges_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_tenant_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_field_entry_id_field_entries_id_fk" FOREIGN KEY ("field_entry_id") REFERENCES "public"."field_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_tenant_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_created_by_tenant_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_scada_connection_id_scada_connections_id_fk" FOREIGN KEY ("scada_connection_id") REFERENCES "public"."scada_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_created_by_tenant_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_import_errors" ADD CONSTRAINT "csv_import_errors_import_id_csv_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."csv_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_users_email_idx" ON "tenant_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "tenant_users_status_idx" ON "tenant_users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_users_role_idx" ON "tenant_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "tenant_users_azure_object_id_idx" ON "tenant_users" USING btree ("azure_object_id");--> statement-breakpoint
CREATE INDEX "wells_api_number_idx" ON "wells" USING btree ("api_number");--> statement-breakpoint
CREATE INDEX "wells_status_idx" ON "wells" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wells_lease_idx" ON "wells" USING btree ("lease");--> statement-breakpoint
CREATE INDEX "wells_field_idx" ON "wells" USING btree ("field");--> statement-breakpoint
CREATE INDEX "wells_operator_idx" ON "wells" USING btree ("operator");--> statement-breakpoint
CREATE INDEX "wells_location_idx" ON "wells" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "wells_deleted_at_idx" ON "wells" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "wells_created_at_idx" ON "wells" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "field_entries_tenant_id_idx" ON "field_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "field_entries_well_id_idx" ON "field_entries" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "field_entries_entry_type_idx" ON "field_entries" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "field_entries_recorded_at_idx" ON "field_entries" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "field_entries_synced_at_idx" ON "field_entries" USING btree ("synced_at");--> statement-breakpoint
CREATE INDEX "field_entries_created_by_idx" ON "field_entries" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "field_entries_well_recorded_idx" ON "field_entries" USING btree ("well_id","recorded_at");--> statement-breakpoint
CREATE INDEX "field_entries_tenant_type_idx" ON "field_entries" USING btree ("tenant_id","entry_type");--> statement-breakpoint
CREATE INDEX "field_entries_deleted_at_idx" ON "field_entries" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "org_nominal_ranges_tenant_id_idx" ON "org_nominal_ranges" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "org_nominal_ranges_field_name_idx" ON "org_nominal_ranges" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "org_nominal_ranges_well_type_idx" ON "org_nominal_ranges" USING btree ("well_type");--> statement-breakpoint
CREATE INDEX "org_nominal_ranges_field_name_well_type_idx" ON "org_nominal_ranges" USING btree ("field_name","well_type");--> statement-breakpoint
CREATE INDEX "well_nominal_ranges_well_id_idx" ON "well_nominal_ranges" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "well_nominal_ranges_field_name_idx" ON "well_nominal_ranges" USING btree ("field_name");--> statement-breakpoint
CREATE INDEX "well_nominal_ranges_well_field_idx" ON "well_nominal_ranges" USING btree ("well_id","field_name");--> statement-breakpoint
CREATE INDEX "alert_preferences_tenant_id_idx" ON "alert_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "alert_preferences_user_id_idx" ON "alert_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alert_preferences_alert_type_idx" ON "alert_preferences" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "alert_preferences_tenant_user_type_idx" ON "alert_preferences" USING btree ("tenant_id","user_id","alert_type");--> statement-breakpoint
CREATE INDEX "alerts_tenant_id_idx" ON "alerts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "alerts_well_id_idx" ON "alerts" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "alerts_field_entry_id_idx" ON "alerts" USING btree ("field_entry_id");--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_acknowledged_idx" ON "alerts" USING btree ("acknowledged_at");--> statement-breakpoint
CREATE INDEX "alerts_tenant_well_idx" ON "alerts" USING btree ("tenant_id","well_id");--> statement-breakpoint
CREATE INDEX "audit_logs_aggregate_idx" ON "audit_logs" USING btree ("aggregate_id","aggregate_type");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_aggregate_time_idx" ON "audit_logs" USING btree ("aggregate_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_time_idx" ON "audit_logs" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "scada_connections_tenant_id_idx" ON "scada_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scada_connections_well_id_idx" ON "scada_connections" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "scada_connections_status_idx" ON "scada_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scada_connections_is_enabled_idx" ON "scada_connections" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "scada_connections_tenant_well_idx" ON "scada_connections" USING btree ("tenant_id","well_id");--> statement-breakpoint
CREATE INDEX "scada_connections_tenant_name_idx" ON "scada_connections" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "tag_mappings_tenant_id_idx" ON "tag_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tag_mappings_scada_connection_id_idx" ON "tag_mappings" USING btree ("scada_connection_id");--> statement-breakpoint
CREATE INDEX "tag_mappings_is_enabled_idx" ON "tag_mappings" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "tag_mappings_last_read_at_idx" ON "tag_mappings" USING btree ("last_read_at");--> statement-breakpoint
CREATE INDEX "tag_mappings_tenant_connection_idx" ON "tag_mappings" USING btree ("tenant_id","scada_connection_id");--> statement-breakpoint
CREATE INDEX "scada_readings_tenant_id_idx" ON "scada_readings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "scada_readings_well_id_idx" ON "scada_readings" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "scada_readings_connection_id_idx" ON "scada_readings" USING btree ("scada_connection_id");--> statement-breakpoint
CREATE INDEX "scada_readings_tag_name_idx" ON "scada_readings" USING btree ("tag_name");--> statement-breakpoint
CREATE INDEX "scada_readings_timestamp_idx" ON "scada_readings" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "scada_readings_well_time_idx" ON "scada_readings" USING btree ("tenant_id","well_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "alarms_tenant_id_idx" ON "alarms" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "alarms_well_id_idx" ON "alarms" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "alarms_state_idx" ON "alarms" USING btree ("state");--> statement-breakpoint
CREATE INDEX "alarms_severity_idx" ON "alarms" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alarms_active_idx" ON "alarms" USING btree ("tenant_id","well_id","state");--> statement-breakpoint
CREATE INDEX "alarms_unique_idx" ON "alarms" USING btree ("tenant_id","well_id","scada_connection_id","tag_name","alarm_type");--> statement-breakpoint
CREATE INDEX "csv_import_errors_import_idx" ON "csv_import_errors" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "csv_imports_tenant_created_idx" ON "csv_imports" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "csv_imports_tenant_status_idx" ON "csv_imports" USING btree ("tenant_id","status");