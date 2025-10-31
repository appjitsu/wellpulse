import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { scadaConnections } from './scada-connections.schema';
import { tenantUsers } from './users.schema';

/**
 * Tag Mappings Schema (Sprint 5)
 *
 * Maps OPC-UA tags (node IDs) to field entry properties for SCADA data collection.
 * Each SCADA connection has multiple tag mappings (e.g., pressure, temperature, flow rate).
 *
 * Tag Configuration JSON Structure:
 * {
 *   nodeId: "ns=2;s=Pressure",              // OPC-UA node identifier
 *   tagName: "casingPressure",              // Internal tag name
 *   fieldEntryProperty: "casingPressure",   // Field entry property to populate
 *   dataType: "Float",                      // OPC-UA data type
 *   unit: "psi",                            // Measurement unit
 *   scalingFactor: 1.0,                     // Scaling multiplier (default 1.0)
 *   deadband: 5.0                           // Min change threshold to record (optional)
 * }
 *
 * Deadband: Prevents recording insignificant changes (e.g., only record pressure if
 * it changes by more than 5 psi). Reduces database writes for noisy sensors.
 */
export const tagMappings = pgTable(
  'tag_mappings',
  {
    id: varchar('id', { length: 100 }).primaryKey(), // tag_{timestamp}_{random}
    tenantId: uuid('tenant_id').notNull(), // Denormalized for query performance
    scadaConnectionId: varchar('scada_connection_id', { length: 100 })
      .references(() => scadaConnections.id, { onDelete: 'cascade' })
      .notNull(),

    // Tag Configuration (stored as JSON)
    // See TagConfiguration value object for structure
    configuration: jsonb('configuration').notNull(),

    // Enable/Disable
    isEnabled: boolean('is_enabled').notNull().default(true), // Allow temporary disable

    // Last Reading Tracking
    lastValue: text('last_value'), // Last value read (string for all types)
    lastReadAt: timestamp('last_read_at'), // When last value was read

    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: uuid('created_by')
      .references(() => tenantUsers.id, { onDelete: 'set null' })
      .notNull(),
    updatedBy: uuid('updated_by')
      .references(() => tenantUsers.id, { onDelete: 'set null' })
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index('tag_mappings_tenant_id_idx').on(table.tenantId),
    scadaConnectionIdIdx: index('tag_mappings_scada_connection_id_idx').on(
      table.scadaConnectionId,
    ),
    isEnabledIdx: index('tag_mappings_is_enabled_idx').on(table.isEnabled),
    lastReadAtIdx: index('tag_mappings_last_read_at_idx').on(table.lastReadAt),
    tenantConnectionIdx: index('tag_mappings_tenant_connection_idx').on(
      table.tenantId,
      table.scadaConnectionId,
    ),
  }),
);

// ============================================================================
// Drizzle Relations
// ============================================================================

export const tagMappingsRelations = relations(tagMappings, ({ one }) => ({
  scadaConnection: one(scadaConnections, {
    fields: [tagMappings.scadaConnectionId],
    references: [scadaConnections.id],
  }),
  createdByUser: one(tenantUsers, {
    fields: [tagMappings.createdBy],
    references: [tenantUsers.id],
    relationName: 'createdBy',
  }),
  updatedByUser: one(tenantUsers, {
    fields: [tagMappings.updatedBy],
    references: [tenantUsers.id],
    relationName: 'updatedBy',
  }),
}));

// ============================================================================
// TypeScript Types
// ============================================================================

export type TagMapping = typeof tagMappings.$inferSelect;
export type NewTagMapping = typeof tagMappings.$inferInsert;
