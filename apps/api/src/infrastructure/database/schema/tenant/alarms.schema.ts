/**
 * Alarms Schema (Tenant Database)
 *
 * Stores SCADA alarm conditions with full lifecycle tracking.
 *
 * Design decisions:
 * - Alarms have lifecycle: ACTIVE � ACKNOWLEDGED � CLEARED
 * - Composite index on (tenant_id, well_id, state) for active alarm queries
 * - Acknowledgment tracking (who, when)
 * - Trigger count for recurring alarms
 * - Severity-based indexing for priority queries
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';

export const alarms = pgTable(
  'alarms',
  {
    id: varchar('id', { length: 100 }).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    wellId: uuid('well_id').notNull(),
    scadaConnectionId: varchar('scada_connection_id', {
      length: 100,
    }).notNull(),
    tagName: varchar('tag_name', { length: 100 }).notNull(),
    alarmType: varchar('alarm_type', { length: 50 }).notNull(), // HIGH_VALUE, LOW_VALUE, etc.
    severity: varchar('severity', { length: 20 }).notNull(), // INFORMATIONAL, WARNING, CRITICAL
    state: varchar('state', { length: 20 }).notNull(), // ACTIVE, ACKNOWLEDGED, CLEARED
    message: varchar('message', { length: 500 }).notNull(),
    value: jsonb('value'), // Current alarm value (number, string, or boolean)
    threshold: doublePrecision('threshold'), // Threshold that triggered alarm (if applicable)
    triggerCount: integer('trigger_count').notNull().default(1),
    firstTriggeredAt: timestamp('first_triggered_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    lastTriggeredAt: timestamp('last_triggered_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    acknowledgedAt: timestamp('acknowledged_at', {
      withTimezone: true,
      mode: 'date',
    }),
    acknowledgedBy: varchar('acknowledged_by', { length: 100 }),
    clearedAt: timestamp('cleared_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('alarms_tenant_id_idx').on(table.tenantId),
    wellIdIdx: index('alarms_well_id_idx').on(table.wellId),
    stateIdx: index('alarms_state_idx').on(table.state),
    severityIdx: index('alarms_severity_idx').on(table.severity),
    // Composite for active alarm queries
    activeIdx: index('alarms_active_idx').on(
      table.tenantId,
      table.wellId,
      table.state,
    ),
    // Composite for retriggering detection
    uniqueAlarmIdx: index('alarms_unique_idx').on(
      table.tenantId,
      table.wellId,
      table.scadaConnectionId,
      table.tagName,
      table.alarmType,
    ),
  }),
);

export type AlarmRow = typeof alarms.$inferSelect;
export type NewAlarmRow = typeof alarms.$inferInsert;
