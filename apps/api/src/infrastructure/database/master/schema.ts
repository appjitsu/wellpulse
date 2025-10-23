/**
 * Master Database Schema
 *
 * This schema defines tables stored in the master database (Azure PostgreSQL).
 * The master database manages:
 * - Tenant metadata and database connection strings
 * - Admin users (WellPulse platform staff)
 * - Billing and subscription information
 * - Usage metrics for tenant management
 */

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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Tenants Table
// ============================================================================

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 100 }).notNull().unique(), // URL-friendly: "acme-oil-gas"
    subdomain: varchar('subdomain', { length: 100 }).notNull().unique(), // "acme.wellpulse.app"
    name: varchar('name', { length: 255 }).notNull(), // "ACME Oil & Gas"

    // Database Configuration
    databaseType: varchar('database_type', { length: 50 })
      .notNull()
      .default('POSTGRESQL'), // POSTGRESQL | SQL_SERVER | MYSQL | ORACLE | ETL_SYNCED
    databaseUrl: text('database_url').notNull(), // Encrypted connection string
    databaseName: varchar('database_name', { length: 100 }).notNull(), // "acme_wellpulse"
    databaseHost: varchar('database_host', { length: 255 }), // For monitoring/health checks
    databasePort: integer('database_port'), // Default 5432 for PostgreSQL

    // Subscription & Limits
    subscriptionTier: varchar('subscription_tier', { length: 50 })
      .notNull()
      .default('STARTER'), // STARTER | PROFESSIONAL | ENTERPRISE | ENTERPRISE_PLUS
    maxWells: integer('max_wells').notNull().default(50), // Well count limit based on tier
    maxUsers: integer('max_users').notNull().default(5), // User count limit
    storageQuotaGb: integer('storage_quota_gb').notNull().default(10), // Storage limit in GB

    // Status & Lifecycle
    status: varchar('status', { length: 50 }).notNull().default('TRIAL'), // ACTIVE | SUSPENDED | TRIAL | DELETED
    trialEndsAt: timestamp('trial_ends_at'), // Trial expiration date
    suspendedAt: timestamp('suspended_at'), // When tenant was suspended
    suspensionReason: text('suspension_reason'), // Why tenant was suspended

    // Contact Information
    contactEmail: varchar('contact_email', { length: 255 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 50 }),
    billingEmail: varchar('billing_email', { length: 255 }),

    // ETL Configuration (for ETL_SYNCED tenants)
    etlConfig: jsonb('etl_config'), // SCADA/ERP integration settings
    etlLastSyncAt: timestamp('etl_last_sync_at'), // Last successful ETL sync
    etlSyncFrequencyMinutes: integer('etl_sync_frequency_minutes').default(60), // How often to sync

    // Metadata & Features
    metadata: jsonb('metadata'), // Additional custom fields
    featureFlags: jsonb('feature_flags').default({}), // Feature toggles per tenant
    billingAddress: jsonb('billing_address'), // Structured address data

    // Audit Fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'), // Soft delete
    createdBy: uuid('created_by'), // Admin user who created tenant
  },
  (table) => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
    subdomainIdx: uniqueIndex('tenants_subdomain_idx').on(table.subdomain),
    statusIdx: index('tenants_status_idx').on(table.status),
    subscriptionTierIdx: index('tenants_subscription_tier_idx').on(
      table.subscriptionTier,
    ),
    deletedAtIdx: index('tenants_deleted_at_idx').on(table.deletedAt),
  }),
);

// ============================================================================
// Admin Users Table (WellPulse Platform Staff)
// ============================================================================

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(), // bcrypt hashed password
    name: varchar('name', { length: 255 }).notNull(),

    // Role-Based Access Control
    role: varchar('role', { length: 50 }).notNull().default('SUPPORT'), // SUPER_ADMIN | ADMIN | SUPPORT
    permissions: jsonb('permissions').default([]), // Granular permissions array

    // Security
    isActive: boolean('is_active').notNull().default(true),
    isMfaEnabled: boolean('is_mfa_enabled').notNull().default(false),
    mfaSecret: text('mfa_secret'), // TOTP secret (encrypted)
    lastPasswordChangeAt: timestamp('last_password_change_at'),
    passwordExpiresAt: timestamp('password_expires_at'), // Force password rotation

    // Activity Tracking
    lastLoginAt: timestamp('last_login_at'),
    lastLoginIp: varchar('last_login_ip', { length: 45 }), // IPv6 support
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until'), // Account lockout after failed attempts

    // Metadata
    metadata: jsonb('metadata'),

    // Audit Fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'), // Soft delete
  },
  (table) => ({
    emailIdx: uniqueIndex('admin_users_email_idx').on(table.email),
    roleIdx: index('admin_users_role_idx').on(table.role),
    isActiveIdx: index('admin_users_is_active_idx').on(table.isActive),
    deletedAtIdx: index('admin_users_deleted_at_idx').on(table.deletedAt),
  }),
);

// ============================================================================
// Billing Subscriptions Table
// ============================================================================

export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Subscription Details
    tier: varchar('tier', { length: 50 }).notNull(), // STARTER | PROFESSIONAL | ENTERPRISE | ENTERPRISE_PLUS
    status: varchar('status', { length: 50 }).notNull().default('ACTIVE'), // ACTIVE | PAST_DUE | CANCELED | SUSPENDED
    billingCycle: varchar('billing_cycle', { length: 50 })
      .notNull()
      .default('MONTHLY'), // MONTHLY | ANNUAL

    // Pricing
    basePriceUsd: integer('base_price_usd').notNull(), // Monthly base price in cents ($99.00 = 9900)
    perWellPriceUsd: integer('per_well_price_usd').notNull(), // Per-well pricing in cents
    perUserPriceUsd: integer('per_user_price_usd').notNull(), // Per-user pricing in cents
    storageOveragePricePerGbUsd: integer(
      'storage_overage_price_per_gb_usd',
    ).notNull(), // Overage pricing

    // Billing Dates
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    nextBillingDate: timestamp('next_billing_date').notNull(),
    canceledAt: timestamp('canceled_at'),
    cancellationReason: text('cancellation_reason'),

    // Payment Integration
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    paymentMethod: varchar('payment_method', { length: 50 }), // CREDIT_CARD | ACH | INVOICE
    lastPaymentAt: timestamp('last_payment_at'),
    lastPaymentAmount: integer('last_payment_amount'), // In cents

    // Metadata
    metadata: jsonb('metadata'),

    // Audit Fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('billing_subscriptions_tenant_id_idx').on(
      table.tenantId,
    ),
    statusIdx: index('billing_subscriptions_status_idx').on(table.status),
    nextBillingDateIdx: index('billing_subscriptions_next_billing_date_idx').on(
      table.nextBillingDate,
    ),
    stripeCustomerIdIdx: index(
      'billing_subscriptions_stripe_customer_id_idx',
    ).on(table.stripeCustomerId),
  }),
);

// ============================================================================
// Usage Metrics Table (for billing and analytics)
// ============================================================================

export const usageMetrics = pgTable(
  'usage_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Time Period
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    metricDate: timestamp('metric_date').notNull(), // Date of measurement (for daily snapshots)

    // Well & User Counts
    activeWellCount: integer('active_well_count').notNull().default(0),
    totalWellCount: integer('total_well_count').notNull().default(0),
    activeUserCount: integer('active_user_count').notNull().default(0),
    totalUserCount: integer('total_user_count').notNull().default(0),

    // Storage Usage
    storageUsedGb: integer('storage_used_gb').notNull().default(0), // Total storage in GB
    storageQuotaGb: integer('storage_quota_gb').notNull().default(10),
    storageOverageGb: integer('storage_overage_gb').notNull().default(0),

    // API Usage
    apiRequestCount: integer('api_request_count').notNull().default(0),
    apiErrorCount: integer('api_error_count').notNull().default(0),
    apiRateLimitHits: integer('api_rate_limit_hits').notNull().default(0),

    // Feature Usage
    productionDataEntriesCount: integer('production_data_entries_count')
      .notNull()
      .default(0),
    mlPredictionsCount: integer('ml_predictions_count').notNull().default(0),
    mobileAppSyncsCount: integer('mobile_app_syncs_count').notNull().default(0),
    electronAppSyncsCount: integer('electron_app_syncs_count')
      .notNull()
      .default(0),

    // Performance Metrics
    avgApiResponseTimeMs: integer('avg_api_response_time_ms'),
    p95ApiResponseTimeMs: integer('p95_api_response_time_ms'),

    // Metadata
    metadata: jsonb('metadata'), // Additional custom metrics

    // Audit Fields
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('usage_metrics_tenant_id_idx').on(table.tenantId),
    metricDateIdx: index('usage_metrics_metric_date_idx').on(table.metricDate),
    tenantDateIdx: index('usage_metrics_tenant_date_idx').on(
      table.tenantId,
      table.metricDate,
    ),
  }),
);

// ============================================================================
// Audit Log Table (track all admin actions)
// ============================================================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }), // Nullable for admin actions
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),

    // Action Details
    action: varchar('action', { length: 100 }).notNull(), // CREATE_TENANT | SUSPEND_TENANT | UPDATE_BILLING | etc.
    entityType: varchar('entity_type', { length: 50 }).notNull(), // TENANT | SUBSCRIPTION | ADMIN_USER | etc.
    entityId: uuid('entity_id'), // ID of affected entity
    description: text('description').notNull(),

    // Request Context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    requestMethod: varchar('request_method', { length: 10 }), // GET | POST | PUT | DELETE
    requestPath: varchar('request_path', { length: 500 }),

    // Changes
    changesBefore: jsonb('changes_before'), // State before action
    changesAfter: jsonb('changes_after'), // State after action

    // Metadata
    metadata: jsonb('metadata'),

    // Timestamp
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('audit_logs_tenant_id_idx').on(table.tenantId),
    adminUserIdIdx: index('audit_logs_admin_user_id_idx').on(table.adminUserId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// Drizzle Relations
// ============================================================================

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  subscriptions: many(billingSubscriptions),
  usageMetrics: many(usageMetrics),
  auditLogs: many(auditLogs),
  createdByAdmin: one(adminUsers, {
    fields: [tenants.createdBy],
    references: [adminUsers.id],
  }),
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  createdTenants: many(tenants),
  auditLogs: many(auditLogs),
}));

export const billingSubscriptionsRelations = relations(
  billingSubscriptions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [billingSubscriptions.tenantId],
      references: [tenants.id],
    }),
  }),
);

export const usageMetricsRelations = relations(usageMetrics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [usageMetrics.tenantId],
    references: [tenants.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  adminUser: one(adminUsers, {
    fields: [auditLogs.adminUserId],
    references: [adminUsers.id],
  }),
}));

// Export all tables for Drizzle ORM
export const masterSchema = {
  tenants,
  adminUsers,
  billingSubscriptions,
  usageMetrics,
  auditLogs,
  tenantsRelations,
  adminUsersRelations,
  billingSubscriptionsRelations,
  usageMetricsRelations,
  auditLogsRelations,
};
