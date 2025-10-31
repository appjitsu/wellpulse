/**
 * SCADA Readings Schema (Tenant Database)
 *
 * TimescaleDB hypertable for storing high-frequency time-series SCADA data.
 * This table is optimized for write-heavy workloads (500K+ tags/second).
 *
 * Design decisions:
 * - Hypertable partitioned by timestamp (24-hour chunks)
 * - Composite index on (tenant_id, well_id, timestamp DESC) for efficient queries
 * - No foreign keys to maximize write performance
 * - Data retention policy (auto-delete data older than 2 years)
 * - Continuous aggregates for 1-hour, 1-day, 1-month rollups
 * - JSON storage for polymorphic values (number, string, boolean)
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';

export const scadaReadings = pgTable(
  'scada_readings',
  {
    id: varchar('id', { length: 100 }).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    wellId: uuid('well_id').notNull(),
    scadaConnectionId: varchar('scada_connection_id', {
      length: 100,
    }).notNull(),
    tagName: varchar('tag_name', { length: 100 }).notNull(),
    value: jsonb('value').notNull(), // Stores number, string, or boolean
    dataType: varchar('data_type', { length: 20 }).notNull(), // 'number', 'string', 'boolean'
    quality: varchar('quality', { length: 20 }).notNull(), // 'GOOD', 'BAD', 'UNCERTAIN', 'OUT_OF_RANGE', 'STALE'
    timestamp: timestamp('timestamp', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    unit: varchar('unit', { length: 50 }),
    minValue: doublePrecision('min_value'),
    maxValue: doublePrecision('max_value'),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    tenantIdIdx: index('scada_readings_tenant_id_idx').on(table.tenantId),
    wellIdIdx: index('scada_readings_well_id_idx').on(table.wellId),
    connectionIdIdx: index('scada_readings_connection_id_idx').on(
      table.scadaConnectionId,
    ),
    tagNameIdx: index('scada_readings_tag_name_idx').on(table.tagName),
    timestampIdx: index('scada_readings_timestamp_idx').on(table.timestamp),
    // Composite index for time-series queries
    wellTimeIdx: index('scada_readings_well_time_idx').on(
      table.tenantId,
      table.wellId,
      table.timestamp.desc(),
    ),
  }),
);

export type ScadaReadingRow = typeof scadaReadings.$inferSelect;
export type NewScadaReadingRow = typeof scadaReadings.$inferInsert;
