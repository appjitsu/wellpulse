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
ALTER TABLE "tenant_users" ADD COLUMN "azure_object_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "sso_provider" varchar(50);--> statement-breakpoint
ALTER TABLE "org_nominal_ranges" ADD CONSTRAINT "org_nominal_ranges_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_nominal_ranges" ADD CONSTRAINT "well_nominal_ranges_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_nominal_ranges" ADD CONSTRAINT "well_nominal_ranges_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD CONSTRAINT "alert_preferences_user_id_tenant_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_field_entry_id_field_entries_id_fk" FOREIGN KEY ("field_entry_id") REFERENCES "public"."field_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_tenant_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."tenant_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "tenant_users_azure_object_id_idx" ON "tenant_users" USING btree ("azure_object_id");