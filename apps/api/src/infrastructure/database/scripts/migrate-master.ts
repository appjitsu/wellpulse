/**
 * Master Database Migration Script
 *
 * Applies pending migrations to the master database.
 * Run this script when deploying schema changes to production.
 *
 * Usage:
 *   pnpm db:migrate:master
 *
 * Environment variables required:
 *   MASTER_DATABASE_URL - Connection string for master database
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { Sql } from 'postgres';

// Handle CommonJS/ESM interop for postgres package
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require('postgres') as (
  url: string,
  options?: { max?: number },
) => Sql;

dotenv.config();

async function runMigration() {
  const connectionString =
    process.env.MASTER_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/wellpulse_master';

  console.log('🔄 Starting master database migration...');
  console.log(`📍 Database: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

  // Create connection for migrations
  const migrationConnection = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationConnection);

  try {
    const migrationsFolder = path.join(__dirname, '..', 'migrations', 'master');

    console.log(`📁 Migrations folder: ${migrationsFolder}`);
    console.log('⏳ Applying migrations...');

    await migrate(db, { migrationsFolder });

    console.log('✅ Master database migrations completed successfully!');
  } catch (error: unknown) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationConnection.end();
    console.log('🔌 Database connection closed');
  }
}

void runMigration();
