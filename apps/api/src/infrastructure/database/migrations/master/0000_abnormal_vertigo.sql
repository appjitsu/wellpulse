CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'SUPPORT' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"last_password_change_at" timestamp,
	"password_expires_at" timestamp,
	"last_login_at" timestamp,
	"last_login_ip" varchar(45),
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"admin_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"description" text NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_method" varchar(10),
	"request_path" varchar(500),
	"changes_before" jsonb,
	"changes_after" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tier" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"billing_cycle" varchar(50) DEFAULT 'MONTHLY' NOT NULL,
	"base_price_usd" integer NOT NULL,
	"per_well_price_usd" integer NOT NULL,
	"per_user_price_usd" integer NOT NULL,
	"storage_overage_price_per_gb_usd" integer NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"next_billing_date" timestamp NOT NULL,
	"canceled_at" timestamp,
	"cancellation_reason" text,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"payment_method" varchar(50),
	"last_payment_at" timestamp,
	"last_payment_amount" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"subdomain" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"database_type" varchar(50) DEFAULT 'POSTGRESQL' NOT NULL,
	"database_url" text NOT NULL,
	"database_name" varchar(100) NOT NULL,
	"database_host" varchar(255),
	"database_port" integer,
	"subscription_tier" varchar(50) DEFAULT 'STARTER' NOT NULL,
	"max_wells" integer DEFAULT 50 NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"storage_quota_gb" integer DEFAULT 10 NOT NULL,
	"status" varchar(50) DEFAULT 'TRIAL' NOT NULL,
	"trial_ends_at" timestamp,
	"suspended_at" timestamp,
	"suspension_reason" text,
	"contact_email" varchar(255) NOT NULL,
	"contact_phone" varchar(50),
	"billing_email" varchar(255),
	"etl_config" jsonb,
	"etl_last_sync_at" timestamp,
	"etl_sync_frequency_minutes" integer DEFAULT 60,
	"metadata" jsonb,
	"feature_flags" jsonb DEFAULT '{}'::jsonb,
	"billing_address" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"created_by" uuid,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "usage_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metric_date" timestamp NOT NULL,
	"active_well_count" integer DEFAULT 0 NOT NULL,
	"total_well_count" integer DEFAULT 0 NOT NULL,
	"active_user_count" integer DEFAULT 0 NOT NULL,
	"total_user_count" integer DEFAULT 0 NOT NULL,
	"storage_used_gb" integer DEFAULT 0 NOT NULL,
	"storage_quota_gb" integer DEFAULT 10 NOT NULL,
	"storage_overage_gb" integer DEFAULT 0 NOT NULL,
	"api_request_count" integer DEFAULT 0 NOT NULL,
	"api_error_count" integer DEFAULT 0 NOT NULL,
	"api_rate_limit_hits" integer DEFAULT 0 NOT NULL,
	"production_data_entries_count" integer DEFAULT 0 NOT NULL,
	"ml_predictions_count" integer DEFAULT 0 NOT NULL,
	"mobile_app_syncs_count" integer DEFAULT 0 NOT NULL,
	"electron_app_syncs_count" integer DEFAULT 0 NOT NULL,
	"avg_api_response_time_ms" integer,
	"p95_api_response_time_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_idx" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_users_role_idx" ON "admin_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "admin_users_is_active_idx" ON "admin_users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "admin_users_deleted_at_idx" ON "admin_users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_admin_user_id_idx" ON "audit_logs" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_tenant_id_idx" ON "billing_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_status_idx" ON "billing_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_next_billing_date_idx" ON "billing_subscriptions" USING btree ("next_billing_date");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_stripe_customer_id_idx" ON "billing_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenants_subscription_tier_idx" ON "tenants" USING btree ("subscription_tier");--> statement-breakpoint
CREATE INDEX "tenants_deleted_at_idx" ON "tenants" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "usage_metrics_tenant_id_idx" ON "usage_metrics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "usage_metrics_metric_date_idx" ON "usage_metrics" USING btree ("metric_date");--> statement-breakpoint
CREATE INDEX "usage_metrics_tenant_date_idx" ON "usage_metrics" USING btree ("tenant_id","metric_date");