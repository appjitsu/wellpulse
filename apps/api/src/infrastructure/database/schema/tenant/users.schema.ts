import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Tenant Users Schema
 *
 * Stores user authentication and profile data for each tenant.
 * Each tenant has their own isolated user table in their dedicated database.
 *
 * First user created in a tenant is automatically assigned ADMIN role.
 */
export const tenantUsers = pgTable(
  'tenant_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Credentials
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),

    // Profile
    name: varchar('name', { length: 255 }).notNull(),

    // Authorization
    role: varchar('role', { length: 50 }).notNull().default('OPERATOR'),
    // Roles: "ADMIN" | "MANAGER" | "OPERATOR"

    // Account Status
    status: varchar('status', { length: 50 }).notNull().default('PENDING'),
    // Status: "PENDING" | "ACTIVE" | "SUSPENDED"

    // Email Verification
    emailVerified: boolean('email_verified').default(false),
    emailVerificationCode: varchar('email_verification_code', { length: 10 }),
    emailVerificationExpires: timestamp('email_verification_expires'),

    // Password Reset
    passwordResetToken: varchar('password_reset_token', { length: 100 }),
    passwordResetExpires: timestamp('password_reset_expires'),

    // Session Management
    lastLoginAt: timestamp('last_login_at'),
    refreshTokenHash: text('refresh_token_hash'), // Hashed refresh token for validation

    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    deletedBy: uuid('deleted_by'),
  },
  (table) => {
    return {
      emailIdx: index('tenant_users_email_idx').on(table.email),
      statusIdx: index('tenant_users_status_idx').on(table.status),
      roleIdx: index('tenant_users_role_idx').on(table.role),
    };
  },
);

export type TenantUser = typeof tenantUsers.$inferSelect;
export type NewTenantUser = typeof tenantUsers.$inferInsert;
