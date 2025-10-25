/**
 * Wells Read Projection Schema
 *
 * Denormalized view of wells data optimized for query performance.
 * This is a materialized view pattern where complex queries are
 * pre-computed and stored for fast retrieval.
 *
 * Benefits:
 * - Faster queries (no joins required)
 * - Reduced database load
 * - Optimized for specific query patterns
 *
 * Trade-offs:
 * - Data duplication
 * - Must be kept in sync with source data via event handlers
 *
 * Update Strategy:
 * - Updated via domain events (WellCreated, WellUpdated, etc.)
 * - Eventually consistent (acceptable for read models)
 */

import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
} from 'drizzle-orm/pg-core';

export const wellsReadProjection = pgTable('wells_read_projection', {
  // Identity
  id: uuid('id').primaryKey(),
  apiNumber: varchar('api_number', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),

  // Status
  status: varchar('status', { length: 50 }).notNull(),

  // Location (denormalized for fast geo queries)
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),

  // Operational Details
  lease: varchar('lease', { length: 255 }),
  field: varchar('field', { length: 255 }),
  operator: varchar('operator', { length: 255 }),

  // Audit Fields
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),

  // Future: Add aggregated fields for even faster queries
  // totalProductionLast30Days: decimal('total_production_last_30_days'),
  // lastMaintenanceDate: timestamp('last_maintenance_date'),
  // alertCount: integer('alert_count'),
});
