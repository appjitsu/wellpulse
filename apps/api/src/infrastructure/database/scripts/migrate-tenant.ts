/**
 * Tenant Database Migration Script
 *
 * Applies pending migrations to all tenant databases or a specific tenant.
 * This script reads the tenant registry from the master database and applies
 * migrations to each tenant's isolated database.
 *
 * Usage:
 *   # Migrate all tenants
 *   pnpm db:migrate:tenant
 *
 *   # Migrate specific tenant
 *   TENANT_ID=<uuid> pnpm db:migrate:tenant
 *
 * Environment variables:
 *   MASTER_DATABASE_URL - Master database connection string
 *   TENANT_ID (optional) - Specific tenant to migrate
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { eq, isNull } from 'drizzle-orm';
import { tenants } from '../master/schema';

dotenv.config();

interface Tenant {
  id: string;
  slug: string;
  name: string;
  databaseUrl: string;
  databaseType: string;
  status: string;
}

async function getTenants(): Promise<Tenant[]> {
  const masterConnectionString =
    process.env.MASTER_DATABASE_URL ||
    'postgresql://wellpulse:wellpulse@localhost:5432/wellpulse_master';

  const masterPool = new Pool({
    connectionString: masterConnectionString,
    max: 1,
  });
  const masterDb = drizzle(masterPool);

  try {
    const specificTenantId = process.env.TENANT_ID;

    let tenantsToMigrate;
    if (specificTenantId) {
      tenantsToMigrate = await masterDb
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          databaseUrl: tenants.databaseUrl,
          databaseType: tenants.databaseType,
          status: tenants.status,
        })
        .from(tenants)
        .where(eq(tenants.id, specificTenantId));
    } else {
      // Migrate all active tenants (exclude deleted and suspended)
      tenantsToMigrate = await masterDb
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          databaseUrl: tenants.databaseUrl,
          databaseType: tenants.databaseType,
          status: tenants.status,
        })
        .from(tenants)
        .where(isNull(tenants.deletedAt));
    }

    return tenantsToMigrate;
  } finally {
    await masterPool.end();
  }
}

async function migrateTenant(tenant: Tenant): Promise<void> {
  console.log(`\n🔄 Migrating tenant: ${tenant.name} (${tenant.slug})`);
  console.log(
    `📍 Database: ${tenant.databaseUrl.replace(/:[^:]*@/, ':****@')}`,
  );
  console.log(`🗄️  Database type: ${tenant.databaseType}`);

  // Only migrate PostgreSQL databases (adapters for other DBs handled separately)
  if (tenant.databaseType !== 'POSTGRESQL') {
    console.log(
      `⏭️  Skipping migration (${tenant.databaseType} databases use adapter pattern)`,
    );
    return;
  }

  // Skip suspended/deleted tenants
  if (tenant.status === 'SUSPENDED' || tenant.status === 'DELETED') {
    console.log(`⏭️  Skipping migration (tenant status: ${tenant.status})`);
    return;
  }

  const tenantPool = new Pool({
    connectionString: tenant.databaseUrl,
    max: 1,
  });
  const db = drizzle(tenantPool);

  try {
    const migrationsFolder = path.join(__dirname, '..', 'migrations', 'tenant');

    console.log('⏳ Applying migrations...');

    await migrate(db, { migrationsFolder });

    console.log(`✅ Migrations completed for ${tenant.name}`);
  } catch (error) {
    console.error(`❌ Migration failed for ${tenant.name}:`, error);
    throw error; // Re-throw to halt migration process
  } finally {
    await tenantPool.end();
  }
}

async function runMigrations() {
  console.log('🚀 Starting tenant database migrations...');

  try {
    const tenantsToMigrate = await getTenants();

    if (tenantsToMigrate.length === 0) {
      console.log('⚠️  No tenants found to migrate');
      return;
    }

    console.log(`📊 Found ${tenantsToMigrate.length} tenant(s) to migrate`);

    // Migrate tenants sequentially (safer than parallel)
    for (const tenant of tenantsToMigrate) {
      await migrateTenant(tenant);
    }

    console.log('\n✅ All tenant migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Tenant migration process failed:', error);
    process.exit(1);
  }
}

void runMigrations();
