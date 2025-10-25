/**
 * Test Helper: Provision Test Tenant
 *
 * Sets up a tenant database for E2E testing.
 * Creates the database and runs necessary schema migrations.
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-require-imports */

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq } from 'drizzle-orm';
import { tenants } from '../../src/infrastructure/database/master/schema';

const postgres = require('postgres');

export interface ProvisionTenantOptions {
  subdomain: string;
  slug: string;
}

/**
 * Provision a test tenant database
 *
 * Creates the tenant database if it doesn't exist and initializes schema.
 * Also registers the tenant in the master database.
 * This is idempotent - safe to run multiple times.
 *
 * @param options - Tenant configuration
 */
export async function provisionTestTenant(
  options: ProvisionTenantOptions,
): Promise<{ databaseName: string; databaseUrl: string }> {
  const { slug, subdomain } = options;
  const databaseName = `${slug.replace(/-/g, '_')}_wellpulse`;

  // Admin connection to create database
  const adminDbUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
  const adminClient = postgres(adminDbUrl, { max: 1 });

  try {
    // Create database (idempotent)
    try {
      await adminClient.unsafe(`CREATE DATABASE ${databaseName}`);
      console.log(`✅ Created test database: ${databaseName}`);
    } catch (error: any) {
      if (error.code === '42P04') {
        console.log(`ℹ️  Test database already exists: ${databaseName}`);
      } else {
        throw error;
      }
    }
  } finally {
    await adminClient.end();
  }

  // Register tenant in master database
  const masterDbUrl =
    'postgresql://postgres:postgres@localhost:5432/wellpulse_master';
  const masterClient = postgres(masterDbUrl, { max: 1 });
  const masterDb = drizzle(masterClient);

  const tenantDbUrl = `postgresql://postgres:postgres@localhost:5432/${databaseName}`;

  try {
    // Check if tenant already exists in master DB
    const existing = await masterDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (existing.length === 0) {
      // Register tenant in master database
      await masterDb.insert(tenants).values({
        slug,
        subdomain: `${subdomain}.wellpulse.local`,
        name: `Test Tenant ${slug}`,
        databaseType: 'POSTGRESQL',
        databaseUrl: tenantDbUrl,
        databaseName,
        databaseHost: 'localhost',
        databasePort: 5432,
        subscriptionTier: 'STARTER',
        maxWells: 1000,
        maxUsers: 50,
        storageQuotaGb: 100,
        status: 'ACTIVE',
        contactEmail: `admin@${slug}.test`,
      });
      console.log(`✅ Registered tenant in master DB: ${slug}`);
    } else {
      console.log(`ℹ️  Tenant already registered in master DB: ${slug}`);
    }
  } finally {
    await masterClient.end();
  }

  // Connect to tenant database and initialize schema
  const tenantClient = postgres(tenantDbUrl, { max: 1 });
  const db = drizzle(tenantClient);

  try {
    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'OPERATOR',
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        email_verified BOOLEAN NOT NULL DEFAULT false,
        verification_code VARCHAR(6),
        verification_code_expires_at TIMESTAMP,
        password_reset_token VARCHAR(64),
        password_reset_expires_at TIMESTAMP,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP,
        deleted_by UUID
      )
    `);

    // Create index on email
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)
    `);

    // Create wells table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wells (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_number VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        lease VARCHAR(255),
        field VARCHAR(255),
        operator VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        deleted_at TIMESTAMP,
        deleted_by UUID
      )
    `);

    // Create indexes on wells
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS wells_api_number_idx ON wells(api_number)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS wells_status_idx ON wells(status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS wells_operator_idx ON wells(operator)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS wells_field_idx ON wells(field)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS wells_lease_idx ON wells(lease)
    `);

    console.log(`✅ Initialized schema for: ${databaseName}`);
  } finally {
    await tenantClient.end();
  }

  return {
    databaseName,
    databaseUrl: tenantDbUrl,
  };
}

/**
 * Clean up test tenant data (but keep database structure)
 *
 * Truncates all tables to reset test data between test runs.
 * Does NOT drop the database (faster for repeated test runs).
 *
 * @param slug - Tenant slug
 */
export async function cleanTestTenantData(slug: string): Promise<void> {
  const databaseName = `${slug.replace(/-/g, '_')}_wellpulse`;
  const tenantDbUrl = `postgresql://postgres:postgres@localhost:5432/${databaseName}`;
  const tenantClient = postgres(tenantDbUrl, { max: 1 });
  const db = drizzle(tenantClient);

  try {
    // Truncate tables (cascade to handle foreign keys)
    await db.execute(sql`TRUNCATE TABLE users CASCADE`);
    await db.execute(sql`TRUNCATE TABLE wells CASCADE`);

    console.log(`✅ Cleaned test data for: ${databaseName}`);
  } catch (error) {
    console.warn(`⚠️  Error cleaning test data: ${error}`);
    // Don't fail tests if cleanup fails
  } finally {
    await tenantClient.end();
  }
}

/**
 * Drop test tenant database completely
 *
 * Use this in afterAll() if you want to remove test databases.
 * Most of the time, it's faster to keep databases between runs.
 *
 * @param slug - Tenant slug
 */
export async function dropTestTenant(slug: string): Promise<void> {
  const databaseName = `${slug.replace(/-/g, '_')}_wellpulse`;
  const adminDbUrl = 'postgresql://postgres:postgres@localhost:5432/postgres';
  const adminClient = postgres(adminDbUrl, { max: 1 });

  try {
    // Terminate connections to database before dropping
    await adminClient.unsafe(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${databaseName}'
        AND pid <> pg_backend_pid()
    `);

    // Drop database
    await adminClient.unsafe(`DROP DATABASE IF EXISTS ${databaseName}`);
    console.log(`✅ Dropped test database: ${databaseName}`);
  } catch (error) {
    console.warn(`⚠️  Error dropping test database: ${error}`);
    // Don't fail tests if drop fails
  } finally {
    await adminClient.end();
  }
}
