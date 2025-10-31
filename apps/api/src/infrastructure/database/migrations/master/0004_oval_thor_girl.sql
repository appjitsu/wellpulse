CREATE TABLE "org_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" varchar(2) NOT NULL,
	"zip_code" varchar(10) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"website" text,
	"primary_color" varchar(7) DEFAULT '#1E40AF' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#64748B' NOT NULL,
	"text_color" varchar(7) DEFAULT '#1F2937' NOT NULL,
	"background_color" varchar(7) DEFAULT '#FFFFFF' NOT NULL,
	"logo_blob_url" text,
	"logo_file_name" text,
	"logo_mime_type" varchar(20),
	"logo_size_bytes" integer,
	"logo_width" integer,
	"logo_height" integer,
	"logo_uploaded_at" timestamp with time zone,
	"header_text" text,
	"footer_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "org_branding_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "org_branding" ADD CONSTRAINT "org_branding_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_branding" ADD CONSTRAINT "org_branding_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_branding" ADD CONSTRAINT "org_branding_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;