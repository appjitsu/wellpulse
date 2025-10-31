-- Migration: Add CSV Imports Tables
-- Created: 2025-10-30
-- Description: Add csv_imports and csv_import_errors tables for CSV data ingestion

-- Create enums
DO $$ BEGIN
 CREATE TYPE "import_status" AS ENUM('queued', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "conflict_strategy" AS ENUM('skip', 'overwrite', 'merge');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create csv_imports table
CREATE TABLE IF NOT EXISTS "csv_imports" (
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

-- Create csv_import_errors table
CREATE TABLE IF NOT EXISTS "csv_import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"well_id" varchar(255),
	"entry_date" timestamp with time zone,
	"error_message" text NOT NULL,
	"raw_row" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for csv_imports
CREATE INDEX IF NOT EXISTS "csv_imports_tenant_created_idx" ON "csv_imports" ("tenant_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "csv_imports_tenant_status_idx" ON "csv_imports" ("tenant_id","status");

-- Create index for csv_import_errors
CREATE INDEX IF NOT EXISTS "csv_import_errors_import_idx" ON "csv_import_errors" ("import_id");

-- Add foreign key constraint
DO $$ BEGIN
 ALTER TABLE "csv_import_errors" ADD CONSTRAINT "csv_import_errors_import_id_csv_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "csv_imports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
