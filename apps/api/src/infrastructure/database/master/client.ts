/**
 * Master Database Client
 *
 * Provides a Drizzle ORM client connected to the master database.
 * The master database stores tenant metadata, admin users, billing, and usage metrics.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool as PgPool } from 'pg';
import * as schema from './schema';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: unknown) => PgPool };

/**
 * PostgreSQL connection pool for master database
 * - Manages tenant metadata and platform-level data
 * - Separate from tenant databases
 */

const pool: PgPool = new Pool({
  connectionString:
    process.env.MASTER_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/wellpulse_master',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Fail fast if connection takes > 10s
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

/**
 * Drizzle ORM instance for master database
 * - Type-safe queries with full TypeScript support
 * - Includes all master schema relations
 */
export const masterDb = drizzle(pool as never, { schema });

/**
 * Gracefully close master database connection pool
 * Should be called during application shutdown
 */
export async function closeMasterDatabase(): Promise<void> {
  await pool.end();
}

/**
 * Health check for master database connection
 * @returns true if database is accessible, false otherwise
 */
export async function checkMasterDatabaseHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Master database health check failed:', error);
    return false;
  }
}
