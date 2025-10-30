/**
 * Audit Logs Schema (Tenant Database)
 *
 * Stores complete audit trail of all domain events.
 * Enables compliance reporting, security investigations, and state reconstruction.
 *
 * Retention Policy:
 * - STARTER: 90 days
 * - PROFESSIONAL: 1 year
 * - ENTERPRISE: 7 years
 * - ENTERPRISE_PLUS: Unlimited (or per compliance requirements)
 *
 * Querying:
 * - By aggregate (e.g., all events for well-123)
 * - By user (e.g., all actions by user-456)
 * - By event type (e.g., all WellActivated events)
 * - By time range (e.g., events in last 30 days)
 *
 * Performance:
 * - Partitioned by month for large datasets
 * - Indexed on aggregateId, userId, eventType, occurredAt
 * - Append-only (no updates/deletes)
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const auditLogs = pgTable(
  'audit_logs',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Event identification
    eventId: varchar('event_id', { length: 100 }).notNull().unique(),
    eventType: varchar('event_type', { length: 100 }).notNull(),

    // Timing
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Aggregate (what was affected)
    aggregateId: uuid('aggregate_id').notNull(),
    aggregateType: varchar('aggregate_type', { length: 50 }).notNull(),

    // Actor (who did it)
    userId: uuid('user_id'), // Null for system events

    // Event data
    payload: jsonb('payload').notNull(),
    metadata: jsonb('metadata'),

    // Tenant context (for cross-tenant queries, though this is tenant DB)
    tenantId: uuid('tenant_id').notNull(),
  },
  (table) => ({
    // Performance indexes
    aggregateIdx: index('audit_logs_aggregate_idx').on(
      table.aggregateId,
      table.aggregateType,
    ),
    userIdx: index('audit_logs_user_idx').on(table.userId),
    eventTypeIdx: index('audit_logs_event_type_idx').on(table.eventType),
    occurredAtIdx: index('audit_logs_occurred_at_idx').on(table.occurredAt),

    // Composite indexes for common queries
    aggregateTimeIdx: index('audit_logs_aggregate_time_idx').on(
      table.aggregateId,
      table.occurredAt,
    ),
    userTimeIdx: index('audit_logs_user_time_idx').on(
      table.userId,
      table.occurredAt,
    ),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
