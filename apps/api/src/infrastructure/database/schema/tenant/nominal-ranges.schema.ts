import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { wells } from './wells.schema';
import { tenantUsers } from './users.schema';

/**
 * Organization-Level Nominal Ranges Schema (Sprint 4 MVP)
 *
 * Stores nominal range overrides at the organization level.
 * These override the global defaults from master DB but can be
 * overridden at the well level.
 *
 * Cascade: Well-specific > Org-level > Global template (master DB)
 */
export const orgNominalRanges = pgTable(
  'org_nominal_ranges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(), // Denormalized for query performance

    // Field Configuration
    fieldName: varchar('field_name', { length: 100 }).notNull(), // e.g., "productionVolume"
    wellType: varchar('well_type', { length: 50 }), // NULL = all well types, or "beam-pump", "pcp", etc.

    // Range Values
    minValue: decimal('min_value', { precision: 10, scale: 2 }), // NULL = no minimum
    maxValue: decimal('max_value', { precision: 10, scale: 2 }), // NULL = no maximum
    unit: varchar('unit', { length: 20 }).notNull(), // "bbl/day", "psi", etc.
    severity: varchar('severity', { length: 20 }).notNull().default('warning'), // "info" | "warning" | "critical"

    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: uuid('updated_by').references(() => tenantUsers.id),
  },
  (table) => ({
    tenantIdIdx: index('org_nominal_ranges_tenant_id_idx').on(table.tenantId),
    fieldNameIdx: index('org_nominal_ranges_field_name_idx').on(
      table.fieldName,
    ),
    wellTypeIdx: index('org_nominal_ranges_well_type_idx').on(table.wellType),
    fieldNameWellTypeIdx: index(
      'org_nominal_ranges_field_name_well_type_idx',
    ).on(table.fieldName, table.wellType),
  }),
);

/**
 * Well-Specific Nominal Ranges Schema (Sprint 4 MVP)
 *
 * Stores nominal range overrides for specific wells.
 * Highest priority in the cascade (overrides org and global defaults).
 *
 * Use case: Well with unique characteristics requiring custom thresholds
 * (e.g., high-pressure well, water disposal well, aging equipment).
 */
export const wellNominalRanges = pgTable(
  'well_nominal_ranges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    wellId: uuid('well_id')
      .notNull()
      .references(() => wells.id, { onDelete: 'cascade' }),

    // Field Configuration
    fieldName: varchar('field_name', { length: 100 }).notNull(), // e.g., "pressure"
    minValue: decimal('min_value', { precision: 10, scale: 2 }), // NULL = no minimum
    maxValue: decimal('max_value', { precision: 10, scale: 2 }), // NULL = no maximum
    unit: varchar('unit', { length: 20 }).notNull(), // "psi", "°F", etc.
    severity: varchar('severity', { length: 20 }).notNull().default('warning'), // "info" | "warning" | "critical"

    // Justification
    reason: text('reason'), // Why this well has custom ranges (audit trail)

    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: uuid('updated_by').references(() => tenantUsers.id),
  },
  (table) => ({
    wellIdIdx: index('well_nominal_ranges_well_id_idx').on(table.wellId),
    fieldNameIdx: index('well_nominal_ranges_field_name_idx').on(
      table.fieldName,
    ),
    wellFieldIdx: index('well_nominal_ranges_well_field_idx').on(
      table.wellId,
      table.fieldName,
    ),
  }),
);

// ============================================================================
// Drizzle Relations
// ============================================================================

export const orgNominalRangesRelations = relations(
  orgNominalRanges,
  ({ one }) => ({
    updatedByUser: one(tenantUsers, {
      fields: [orgNominalRanges.updatedBy],
      references: [tenantUsers.id],
    }),
  }),
);

export const wellNominalRangesRelations = relations(
  wellNominalRanges,
  ({ one }) => ({
    well: one(wells, {
      fields: [wellNominalRanges.wellId],
      references: [wells.id],
    }),
    updatedByUser: one(tenantUsers, {
      fields: [wellNominalRanges.updatedBy],
      references: [tenantUsers.id],
    }),
  }),
);

// ============================================================================
// TypeScript Types
// ============================================================================

export type OrgNominalRange = typeof orgNominalRanges.$inferSelect;
export type NewOrgNominalRange = typeof orgNominalRanges.$inferInsert;

export type WellNominalRange = typeof wellNominalRanges.$inferSelect;
export type NewWellNominalRange = typeof wellNominalRanges.$inferInsert;
