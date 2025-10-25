import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Drizzle Kit Configuration for Tenant Databases
 *
 * This configuration is for tenant-specific databases that store:
 * - Wells (production data, equipment, operators)
 * - Users (tenant employees with RBAC)
 * - Time-series data (production volumes, sensor readings)
 * - Field data entries (offline sync from mobile/electron apps)
 *
 * Note: Each tenant has their own isolated database. This config is used
 * to generate migration scripts that are applied to each tenant database
 * during provisioning or schema updates.
 */
export default {
  schema: './src/infrastructure/database/schema/tenant/index.ts',
  out: './src/infrastructure/database/migrations/tenant',
  dialect: 'postgresql',
  dbCredentials: {
    // For migration generation, we use a template database
    // In production, migrations are applied to each tenant's database
    url:
      process.env.TENANT_TEMPLATE_DATABASE_URL ||
      'postgresql://wellpulse:wellpulse@localhost:5432/wellpulse_tenant_template',
  },
  verbose: true,
  strict: true,
} satisfies Config;
