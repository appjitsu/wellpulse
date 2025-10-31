import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wells } from './wells.schema';
import { tenantUsers } from './users.schema';

/**
 * SCADA Connections Schema (Sprint 5)
 *
 * Stores SCADA connection configurations for real-time data integration from RTUs/PLCs.
 * Each well can have one active SCADA connection for automated data collection.
 *
 * Connection lifecycle:
 * - inactive: Not yet started or manually stopped
 * - connecting: Attempting to establish OPC-UA connection
 * - active: Connected and collecting data
 * - error: Connection failed (see last_error_message)
 *
 * IoT Edge Gateway polls these connections and sends readings to IoT Hub → Event Grid → API webhook.
 */
export const scadaConnections = pgTable(
  'scada_connections',
  {
    id: varchar('id', { length: 100 }).primaryKey(), // scada_{timestamp}_{random}
    tenantId: uuid('tenant_id').notNull(), // Denormalized for query performance
    wellId: uuid('well_id')
      .references(() => wells.id, { onDelete: 'cascade' })
      .notNull(),

    // Connection Details
    name: varchar('name', { length: 100 }).notNull(), // User-friendly name (e.g., "Acme Well 001 RTU")
    description: text('description'), // Optional notes

    // OPC-UA Endpoint Configuration (stored as JSON)
    // { url, securityMode, securityPolicy, username, password }
    endpointConfig: jsonb('endpoint_config').notNull(),

    // Polling Configuration
    pollIntervalSeconds: integer('poll_interval_seconds').notNull().default(5), // How often to poll SCADA system (1-300 seconds)

    // Connection Status
    status: varchar('status', { length: 20 }).notNull().default('inactive'), // "inactive" | "connecting" | "active" | "error"
    lastConnectedAt: timestamp('last_connected_at'), // Last successful connection
    lastErrorMessage: text('last_error_message'), // Error details if status = "error"

    // Enable/Disable
    isEnabled: boolean('is_enabled').notNull().default(true), // Allow temporary disable without deleting

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
    tenantIdIdx: index('scada_connections_tenant_id_idx').on(table.tenantId),
    wellIdIdx: index('scada_connections_well_id_idx').on(table.wellId),
    statusIdx: index('scada_connections_status_idx').on(table.status),
    isEnabledIdx: index('scada_connections_is_enabled_idx').on(table.isEnabled),
    tenantWellIdx: index('scada_connections_tenant_well_idx').on(
      table.tenantId,
      table.wellId,
    ),
    // Ensure unique connection name per tenant
    tenantNameIdx: index('scada_connections_tenant_name_idx').on(
      table.tenantId,
      table.name,
    ),
  }),
);

// ============================================================================
// Drizzle Relations
// ============================================================================

export const scadaConnectionsRelations = relations(
  scadaConnections,
  ({ one }) => ({
    well: one(wells, {
      fields: [scadaConnections.wellId],
      references: [wells.id],
    }),
    createdByUser: one(tenantUsers, {
      fields: [scadaConnections.createdBy],
      references: [tenantUsers.id],
      relationName: 'createdBy',
    }),
    updatedByUser: one(tenantUsers, {
      fields: [scadaConnections.updatedBy],
      references: [tenantUsers.id],
      relationName: 'updatedBy',
    }),
  }),
);

// ============================================================================
// TypeScript Types
// ============================================================================

export type ScadaConnection = typeof scadaConnections.$inferSelect;
export type NewScadaConnection = typeof scadaConnections.$inferInsert;
