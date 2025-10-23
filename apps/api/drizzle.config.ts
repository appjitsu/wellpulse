import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Drizzle Kit Configuration for Master Database
 *
 * This configuration is for the master database that stores:
 * - Tenant metadata and database connection strings
 * - Admin users (WellPulse platform staff)
 * - Billing and subscription information
 * - Usage metrics
 *
 * Note: Tenant-specific data is stored in separate databases per tenant.
 */
export default {
  schema: './src/infrastructure/database/master/schema.ts',
  out: './src/infrastructure/database/migrations/master',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.MASTER_DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/wellpulse_master',
  },
  verbose: true,
  strict: true,
} satisfies Config;
