import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { tenantUsers } from './users.schema';

/**
 * Tenant Wells Schema
 *
 * Stores well registry data for each tenant.
 * Each tenant has their own isolated wells table in their dedicated database.
 *
 * Wells are the core asset in oil & gas operations, representing physical well sites
 * in the field. API numbers uniquely identify wells per Texas RRC regulations.
 */
export const wells = pgTable(
  'wells',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Well Identification
    name: varchar('name', { length: 255 }).notNull(),
    apiNumber: varchar('api_number', { length: 20 }).notNull().unique(),
    // Format: XX-XXX-XXXXX (e.g., 42-165-12345)

    // Location (Permian Basin coordinates)
    latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
    // Range: -90 to 90 degrees, precision to ~1cm
    longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
    // Range: -180 to 180 degrees, precision to ~1cm

    // Well Status
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    // Values: "ACTIVE" | "INACTIVE" | "PLUGGED"

    // Operational Information
    lease: varchar('lease', { length: 255 }),
    field: varchar('field', { length: 255 }),
    operator: varchar('operator', { length: 255 }),

    // Important Dates
    spudDate: timestamp('spud_date'), // Date drilling began
    completionDate: timestamp('completion_date'), // Date well completed

    // Custom metadata (flexible JSONB for client-specific fields)
    metadata: jsonb('metadata').default({}).notNull(),

    // Audit Fields
    createdBy: uuid('created_by').references(() => tenantUsers.id),
    updatedBy: uuid('updated_by').references(() => tenantUsers.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    deletedBy: uuid('deleted_by').references(() => tenantUsers.id),
  },
  (table) => {
    return {
      // Performance indexes
      apiNumberIdx: index('wells_api_number_idx').on(table.apiNumber),
      statusIdx: index('wells_status_idx').on(table.status),
      leaseIdx: index('wells_lease_idx').on(table.lease),
      fieldIdx: index('wells_field_idx').on(table.field),
      operatorIdx: index('wells_operator_idx').on(table.operator),

      // Geospatial index for location-based queries (composite)
      locationIdx: index('wells_location_idx').on(
        table.latitude,
        table.longitude,
      ),

      // Soft delete index
      deletedAtIdx: index('wells_deleted_at_idx').on(table.deletedAt),

      // Sorting index (most recent first)
      createdAtIdx: index('wells_created_at_idx').on(table.createdAt),
    };
  },
);

export type Well = typeof wells.$inferSelect;
export type NewWell = typeof wells.$inferInsert;
