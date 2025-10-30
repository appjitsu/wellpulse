import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wells } from './wells.schema';
import { tenantUsers } from './users.schema';
import { fieldEntries } from './field-entries.schema';

/**
 * Alert Preferences Schema (Sprint 4 MVP)
 *
 * Stores alert notification preferences per user and organization.
 * Allows users to customize which alerts they receive and through which channels.
 *
 * user_id NULL = organization-wide default preferences
 * user_id NOT NULL = user-specific overrides
 */
export const alertPreferences = pgTable(
  'alert_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(), // Denormalized for query performance
    userId: uuid('user_id').references(() => tenantUsers.id, {
      onDelete: 'cascade',
    }), // NULL = org-wide default

    // Alert Type
    alertType: varchar('alert_type', { length: 50 }).notNull(), // "nominal_range_violation" | "well_down" | "equipment_failure"

    // Preferences
    enabled: boolean('enabled').notNull().default(true),
    channels: jsonb('channels')
      .notNull()
      .default({ email: true, sms: false, push: false }), // { email: boolean, sms: boolean, push: boolean }

    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index('alert_preferences_tenant_id_idx').on(table.tenantId),
    userIdIdx: index('alert_preferences_user_id_idx').on(table.userId),
    alertTypeIdx: index('alert_preferences_alert_type_idx').on(table.alertType),
    tenantUserTypeIdx: index('alert_preferences_tenant_user_type_idx').on(
      table.tenantId,
      table.userId,
      table.alertType,
    ),
  }),
);

/**
 * Alerts Schema (Sprint 4 MVP)
 *
 * Stores the complete audit trail of all alerts generated in the system.
 * Used for alert history, analytics, and compliance reporting.
 *
 * Alerts are immutable once created (no updates). Acknowledgement adds
 * acknowledged_at timestamp without modifying the original alert data.
 */
export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(), // Denormalized for query performance
    wellId: uuid('well_id').references(() => wells.id, {
      onDelete: 'set null',
    }), // NULL if well deleted
    fieldEntryId: uuid('field_entry_id').references(() => fieldEntries.id, {
      onDelete: 'set null',
    }), // NULL if entry deleted

    // Alert Details
    alertType: varchar('alert_type', { length: 50 }).notNull(), // "nominal_range_violation" | "well_down" | etc.
    severity: varchar('severity', { length: 20 }).notNull(), // "info" | "warning" | "critical"

    // Violation Context (for nominal_range_violation alerts)
    fieldName: varchar('field_name', { length: 100 }), // Which field violated the range
    actualValue: decimal('actual_value', { precision: 10, scale: 2 }), // What was the value
    expectedMin: decimal('expected_min', { precision: 10, scale: 2 }), // What was the expected min
    expectedMax: decimal('expected_max', { precision: 10, scale: 2 }), // What was the expected max

    // Human-Readable Message
    message: text('message').notNull(), // e.g., "Production volume of 5 bbl/day is below minimum of 10 bbl/day"

    // Acknowledgement
    acknowledgedAt: timestamp('acknowledged_at'), // When alert was acknowledged
    acknowledgedBy: uuid('acknowledged_by').references(() => tenantUsers.id, {
      onDelete: 'set null',
    }),

    // Metadata
    metadata: jsonb('metadata'), // Additional context (e.g., { notificationsSent: ["email", "sms"] })

    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index('alerts_tenant_id_idx').on(table.tenantId),
    wellIdIdx: index('alerts_well_id_idx').on(table.wellId),
    fieldEntryIdIdx: index('alerts_field_entry_id_idx').on(table.fieldEntryId),
    createdAtIdx: index('alerts_created_at_idx').on(table.createdAt),
    severityIdx: index('alerts_severity_idx').on(table.severity),
    acknowledgedIdx: index('alerts_acknowledged_idx').on(table.acknowledgedAt), // Find unacknowledged alerts WHERE acknowledged_at IS NULL
    tenantWellIdx: index('alerts_tenant_well_idx').on(
      table.tenantId,
      table.wellId,
    ),
  }),
);

// ============================================================================
// Drizzle Relations
// ============================================================================

export const alertPreferencesRelations = relations(
  alertPreferences,
  ({ one }) => ({
    user: one(tenantUsers, {
      fields: [alertPreferences.userId],
      references: [tenantUsers.id],
    }),
  }),
);

export const alertsRelations = relations(alerts, ({ one }) => ({
  well: one(wells, {
    fields: [alerts.wellId],
    references: [wells.id],
  }),
  fieldEntry: one(fieldEntries, {
    fields: [alerts.fieldEntryId],
    references: [fieldEntries.id],
  }),
  acknowledgedByUser: one(tenantUsers, {
    fields: [alerts.acknowledgedBy],
    references: [tenantUsers.id],
  }),
}));

// ============================================================================
// TypeScript Types
// ============================================================================

export type AlertPreference = typeof alertPreferences.$inferSelect;
export type NewAlertPreference = typeof alertPreferences.$inferInsert;

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
