ALTER TABLE "tenants" ADD COLUMN "tenant_id" varchar(15) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "secret_key_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "secret_rotated_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_tenant_id_idx" ON "tenants" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_tenant_id_unique" UNIQUE("tenant_id");