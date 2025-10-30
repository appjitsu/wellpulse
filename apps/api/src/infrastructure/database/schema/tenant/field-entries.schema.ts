import {
  pgTable,
  text,
  timestamp,
  real,
  jsonb,
  index,
  varchar,
  uuid,
} from 'drizzle-orm/pg-core';
import { wells } from './wells.schema';

export const fieldEntries = pgTable(
  'field_entries',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    wellId: uuid('well_id')
      .notNull()
      .references(() => wells.id, { onDelete: 'cascade' }),
    entryType: varchar('entry_type', { length: 20 }).notNull(), // PRODUCTION, INSPECTION, MAINTENANCE

    // Data stored as JSONB for flexibility
    productionData: jsonb('production_data'),
    inspectionData: jsonb('inspection_data'),
    maintenanceData: jsonb('maintenance_data'),

    // Timestamps
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(), // Offline time
    syncedAt: timestamp('synced_at', { withTimezone: true }), // When synced to cloud

    // User and device tracking
    createdBy: text('created_by').notNull(), // User ID
    deviceId: text('device_id').notNull(), // For conflict resolution

    // Optional location (GPS from device)
    latitude: real('latitude'),
    longitude: real('longitude'),

    // Optional attachments
    photos: jsonb('photos').$type<string[]>(), // Array of URLs
    notes: text('notes'),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    // Index for tenant isolation
    tenantIdIdx: index('field_entries_tenant_id_idx').on(table.tenantId),

    // Index for well-based queries (most common)
    wellIdIdx: index('field_entries_well_id_idx').on(table.wellId),

    // Index for entry type filtering
    entryTypeIdx: index('field_entries_entry_type_idx').on(table.entryType),

    // Index for date range queries (production reports)
    recordedAtIdx: index('field_entries_recorded_at_idx').on(table.recordedAt),

    // Index for sync status queries (offline entries)
    syncedAtIdx: index('field_entries_synced_at_idx').on(table.syncedAt),

    // Index for user activity tracking
    createdByIdx: index('field_entries_created_by_idx').on(table.createdBy),

    // Composite index for common query pattern: well + date range
    wellRecordedIdx: index('field_entries_well_recorded_idx').on(
      table.wellId,
      table.recordedAt,
    ),

    // Composite index for tenant + entry type queries
    tenantTypeIdx: index('field_entries_tenant_type_idx').on(
      table.tenantId,
      table.entryType,
    ),

    // Index for soft delete filtering
    deletedAtIdx: index('field_entries_deleted_at_idx').on(table.deletedAt),
  }),
);

export type FieldEntryRow = typeof fieldEntries.$inferSelect;
export type NewFieldEntryRow = typeof fieldEntries.$inferInsert;
