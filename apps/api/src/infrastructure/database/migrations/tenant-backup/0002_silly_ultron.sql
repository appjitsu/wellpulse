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
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_created_by_tenant_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scada_connections" ADD CONSTRAINT "scada_connections_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_scada_connection_id_scada_connections_id_fk" FOREIGN KEY ("scada_connection_id") REFERENCES "public"."scada_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_created_by_tenant_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_mappings" ADD CONSTRAINT "tag_mappings_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "tag_mappings_tenant_connection_idx" ON "tag_mappings" USING btree ("tenant_id","scada_connection_id");