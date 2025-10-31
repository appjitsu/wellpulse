/**
 * CSV Imports Schema (Tenant Database)
 *
 * Tracks CSV file uploads for production data import.
 * Stores import metadata, status, and error tracking.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Import status enum
export const importStatusEnum = pgEnum('import_status', [
  'queued',
  'processing',
  'completed',
  'failed',
]);

// Conflict strategy enum
export const conflictStrategyEnum = pgEnum('conflict_strategy', [
  'skip',
  'overwrite',
  'merge',
]);

export const csvImports = pgTable(
  'csv_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    status: importStatusEnum('status').notNull().default('queued'),
    totalRows: integer('total_rows').notNull().default(0),
    rowsProcessed: integer('rows_processed').notNull().default(0),
    rowsFailed: integer('rows_failed').notNull().default(0),
    rowsSkipped: integer('rows_skipped').notNull().default(0),
    columnMapping: jsonb('column_mapping').notNull(), // ColumnMappingProps JSON
    conflictStrategy: conflictStrategyEnum('conflict_strategy')
      .notNull()
      .default('skip'),
    errorSummary: text('error_summary'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },
  (table) => ({
    tenantCreatedIdx: index('csv_imports_tenant_created_idx').on(
      table.tenantId,
      table.createdAt.desc(),
    ),
    tenantStatusIdx: index('csv_imports_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);

export const csvImportErrors = pgTable(
  'csv_import_errors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importId: uuid('import_id')
      .notNull()
      .references(() => csvImports.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    wellId: varchar('well_id', { length: 255 }), // May be null if well lookup failed
    entryDate: timestamp('entry_date', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message').notNull(),
    rawRow: jsonb('raw_row'), // Original CSV row data for retry
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    importIdx: index('csv_import_errors_import_idx').on(table.importId),
  }),
);

export type CsvImportRecord = typeof csvImports.$inferSelect;
export type NewCsvImportRecord = typeof csvImports.$inferInsert;
export type CsvImportErrorRecord = typeof csvImportErrors.$inferSelect;
export type NewCsvImportErrorRecord = typeof csvImportErrors.$inferInsert;
