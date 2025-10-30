CREATE TABLE "tenant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"well_id" uuid NOT NULL,
	"entry_type" varchar(20) NOT NULL,
	"production_data" jsonb,
	"inspection_data" jsonb,
	"maintenance_data" jsonb,
	"recorded_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"device_id" text NOT NULL,
	"latitude" real,
	"longitude" real,
	"photos" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
ALTER TABLE "wells" ADD CONSTRAINT "wells_created_by_tenant_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wells" ADD CONSTRAINT "wells_updated_by_tenant_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wells" ADD CONSTRAINT "wells_deleted_by_tenant_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."tenant_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_entries" ADD CONSTRAINT "field_entries_well_id_wells_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."wells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_users_email_idx" ON "tenant_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "tenant_users_status_idx" ON "tenant_users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_users_role_idx" ON "tenant_users" USING btree ("role");--> statement-breakpoint
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
CREATE INDEX "field_entries_deleted_at_idx" ON "field_entries" USING btree ("deleted_at");