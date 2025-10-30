# Database Migration Guide

**Version**: 1.0
**Last Updated**: October 23, 2025

This guide explains WellPulse's migration-based schema management strategy for both master and tenant databases.

---

## Overview

WellPulse uses **Drizzle Kit** for type-safe, migration-based database schema management. We maintain two separate migration tracks:

1. **Master Database**: Tenant registry, admin users, billing, usage metrics
2. **Tenant Databases**: Wells, users, production data (per-tenant isolation)

**Why Migrations?**

✅ **Zero data loss** during schema changes
✅ **Version control** for database schema
✅ **Rollback capability** for failed deployments
✅ **Team collaboration** with mergeable migration files
✅ **Production safety** with dry-run testing

---

## Quick Start

### Automated Database Setup

For a complete clean slate setup (recommended for local development):

```bash
# Drop all databases, create fresh ones, run migrations, and seed data
./scripts/drop-dbs.sh && ./scripts/create-dbs.sh --seed

# Or individually:
./scripts/drop-dbs.sh          # Drop all WellPulse databases
./scripts/create-dbs.sh --seed # Create, migrate, and seed
./scripts/create-dbs.sh        # Create and migrate only (no seed data)
```

**What these scripts do**:
- `drop-dbs.sh`: Safely drops all WellPulse databases (wellpulse_master, wellpulse_internal, demo_wellpulse)
- `create-dbs.sh`: Creates databases, runs migrations, optionally seeds demo data
- Both scripts provide color-coded output and error handling

### Development Workflow

```bash
# 1. Make schema changes
# Edit: apps/api/src/infrastructure/database/master/schema.ts
# OR:   apps/api/src/infrastructure/database/schema/tenant/*.ts

# 2. Generate migration files
pnpm --filter=api db:generate:master    # For master schema changes
pnpm --filter=api db:generate:tenant    # For tenant schema changes

# 3. Review generated migration files
# Check: apps/api/src/infrastructure/database/migrations/master/
# OR:    apps/api/src/infrastructure/database/migrations/tenant/

# 4. Apply migrations to local databases
pnpm --filter=api db:migrate:master     # Apply to master DB
pnpm --filter=api db:migrate:tenant     # Apply to all tenant DBs
pnpm --filter=api db:migrate:all        # Apply to both (sequential)

# 5. Commit migration files to git
git add apps/api/src/infrastructure/database/migrations/
git commit -m "feat(db): add wells production_data table"
```

---

## Master Database Migrations

### Configuration

**File**: `apps/api/drizzle.config.ts`

```typescript
export default {
  schema: './src/infrastructure/database/master/schema.ts',
  out: './src/infrastructure/database/migrations/master',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.MASTER_DATABASE_URL,
  },
} satisfies Config;
```

### Generate Migration

```bash
# After modifying apps/api/src/infrastructure/database/master/schema.ts
pnpm --filter=api db:generate:master
```

**Output**: `apps/api/src/infrastructure/database/migrations/master/0001_xxxxx.sql`

### Apply Migration

```bash
# Local development
pnpm --filter=api db:migrate:master

# Production (Azure)
MASTER_DATABASE_URL=<azure-url> pnpm --filter=api db:migrate:master
```

---

## Tenant Database Migrations

### Configuration

**File**: `apps/api/drizzle.tenant.config.ts`

```typescript
export default {
  schema: './src/infrastructure/database/schema/tenant/index.ts',
  out: './src/infrastructure/database/migrations/tenant',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.TENANT_TEMPLATE_DATABASE_URL,
  },
} satisfies Config;
```

### Generate Migration

```bash
# After modifying apps/api/src/infrastructure/database/schema/tenant/*.ts
pnpm --filter=api db:generate:tenant
```

**Output**: `apps/api/src/infrastructure/database/migrations/tenant/0001_xxxxx.sql`

### Apply Migration

```bash
# Migrate all tenants
pnpm --filter=api db:migrate:tenant

# Migrate specific tenant only
TENANT_ID=<uuid> pnpm --filter=api db:migrate:tenant
```

**How it works**:

1. Script reads tenant registry from master database
2. For each ACTIVE tenant with `databaseType='POSTGRESQL'`:
   - Connects to tenant's database using `databaseUrl`
   - Applies pending migrations from `migrations/tenant/` folder
   - Logs success/failure per tenant
3. Skips non-PostgreSQL tenants (SQL Server, MySQL, Oracle use adapter pattern)

---

## Migration File Structure

```
apps/api/src/infrastructure/database/
├── migrations/
│   ├── master/              # Master database migrations
│   │   ├── meta/
│   │   │   └── _journal.json         # Migration history
│   │   ├── 0000_initial.sql
│   │   ├── 0001_add_tenants.sql
│   │   └── 0002_add_billing.sql
│   └── tenant/              # Tenant database migrations
│       ├── meta/
│       │   └── _journal.json
│       ├── 0000_initial.sql
│       ├── 0001_add_wells.sql
│       └── 0002_add_users.sql
├── scripts/
│   ├── migrate-master.ts    # Master migration runner
│   └── migrate-tenant.ts    # Tenant migration runner
├── master/
│   └── schema.ts            # Master schema definition
└── schema/
    └── tenant/
        ├── index.ts         # Tenant schema index
        ├── wells.schema.ts  # Wells table
        └── users.schema.ts  # Users table
```

---

## Common Workflows

### 1. Adding a New Table (Tenant)

```typescript
// apps/api/src/infrastructure/database/schema/tenant/equipment.schema.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  wellId: uuid('well_id')
    .notNull()
    .references(() => wells.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

```bash
# Generate migration
pnpm --filter=api db:generate:tenant

# Review generated SQL in migrations/tenant/0003_add_equipment.sql

# Apply to all tenants
pnpm --filter=api db:migrate:tenant

# Commit
git add apps/api/src/infrastructure/database/migrations/tenant/
git commit -m "feat(db): add equipment table for tenant databases"
```

### 2. Modifying a Column

```typescript
// Before
status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),

// After (added more statuses)
status: varchar('status', { length: 100 }).notNull().default('ACTIVE'),
```

```bash
# Generate migration
pnpm --filter=api db:generate:tenant

# Review SQL - Drizzle will generate ALTER TABLE statement
# Example: ALTER TABLE wells ALTER COLUMN status TYPE varchar(100);

# Apply migration
pnpm --filter=api db:migrate:tenant
```

### 3. Renaming a Column (Dangerous!)

⚠️ **WARNING**: Column renames can cause data loss if not handled carefully.

**Safe approach** (3-step migration):

```typescript
// Step 1: Add new column
export const wells = pgTable('wells', {
  // ... other columns
  operatorName: varchar('operator_name', { length: 255 }), // NEW
  operator: varchar('operator', { length: 255 }), // OLD (still exists)
});
```

```bash
pnpm --filter=api db:generate:tenant  # Migration: ADD COLUMN operator_name
pnpm --filter=api db:migrate:tenant

# Step 2: Deploy application code that writes to BOTH columns
# (backfill data from operator to operator_name)

# Step 3: After backfill, drop old column
```

**Better approach**: Use views or aliases in application layer instead of renaming.

### 4. Adding Indexes

```typescript
export const wells = pgTable(
  'wells',
  {
    // ... columns
  },
  (table) => ({
    apiNumberIdx: uniqueIndex('wells_api_number_idx').on(table.apiNumber),
    statusIdx: index('wells_status_idx').on(table.status),
    locationIdx: index('wells_location_idx').on(table.latitude, table.longitude), // NEW
  }),
);
```

```bash
pnpm --filter=api db:generate:tenant
pnpm --filter=api db:migrate:tenant
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested locally
- [ ] Migration files committed to git
- [ ] Database backups created
- [ ] Rollback plan documented
- [ ] Downtime window scheduled (if required)

### Deployment Steps

```bash
# 1. Backup databases (Azure automated backups or manual)
# Azure: Point-in-time restore enabled (7-35 days retention)

# 2. Apply master migrations (Azure master database)
MASTER_DATABASE_URL=$AZURE_MASTER_DB pnpm --filter=api db:migrate:master

# 3. Apply tenant migrations (all active tenants)
MASTER_DATABASE_URL=$AZURE_MASTER_DB pnpm --filter=api db:migrate:tenant

# 4. Deploy application code (Azure Container Apps)
# Code expects new schema - deploy AFTER migrations succeed
```

### Rollback Strategy

**If migration fails**:

```bash
# Option 1: Fix migration forward (preferred)
# - Write a new migration to correct the issue
# - Don't edit existing migration files (breaks idempotency)

# Option 2: Restore from backup (last resort)
# - Azure: Point-in-time restore
# - Requires downtime and data loss since last backup
```

**If application fails after migration**:

```bash
# Option 1: Deploy hotfix with schema-compatible code
# Option 2: Write reverse migration to undo schema changes
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/src/infrastructure/database/schema/**'
      - 'apps/api/src/infrastructure/database/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run master migrations
        env:
          MASTER_DATABASE_URL: ${{ secrets.AZURE_MASTER_DB_URL }}
        run: pnpm --filter=api db:migrate:master

      - name: Run tenant migrations
        env:
          MASTER_DATABASE_URL: ${{ secrets.AZURE_MASTER_DB_URL }}
        run: pnpm --filter=api db:migrate:tenant
```

---

## Troubleshooting

### Migration Fails: "relation already exists"

**Cause**: Migration already applied, but Drizzle's migration tracker out of sync.

**Solution**: Manually insert migration record:

```sql
-- Check migration history
SELECT * FROM __drizzle_migrations ORDER BY created_at DESC;

-- Manually mark migration as applied (CAREFUL!)
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('xxxxx', CURRENT_TIMESTAMP);
```

### Tenant Migration Fails for One Tenant

**Cause**: Tenant database connectivity issue or schema drift.

**Solution**: Migrate specific tenant manually:

```bash
# Check tenant's database connectivity
TENANT_ID=<failing-tenant-uuid> pnpm --filter=api db:migrate:tenant

# If still failing, connect directly to tenant DB
psql $TENANT_DATABASE_URL
# Inspect schema, fix manually, then retry migration
```

### Schema Drift Between Environments

**Cause**: Someone used `db:push` in production (bypassing migrations).

**Prevention**:

- **NEVER** use `db:push` in production
- Always use `db:generate` + `db:migrate`
- Enforce via CI/CD (fail builds if migrations not generated)

**Fix**:

```bash
# Generate migration from current schema
pnpm --filter=api db:generate:tenant

# Drizzle will detect drift and generate corrective migration
# Review SQL carefully before applying
```

---

## Database Management Scripts

WellPulse includes two Bash scripts for automated database lifecycle management in local development:

### `scripts/create-dbs.sh`

**Purpose**: Complete database provisioning from scratch

**Features**:
- Creates master database
- Runs master migrations
- Seeds master database (creates tenant records)
- Dynamically discovers tenant databases from master
- Creates all tenant databases
- Runs tenant migrations
- Optionally seeds demo tenant data

**Usage**:

```bash
# Create databases with demo data
./scripts/create-dbs.sh --seed

# Create databases without demo data
./scripts/create-dbs.sh
```

**What it does**:

1. Creates `wellpulse_master` database
2. Runs master migrations (`apps/api/src/infrastructure/database/scripts/migrate-master.ts`)
3. Seeds master database (`apps/api/src/infrastructure/database/seeds/master.seed.ts`)
   - Creates super admin user
   - Creates 2 tenants (wellpulse, demo)
4. Queries master database for tenant database names
5. Creates tenant databases (`wellpulse_internal`, `demo_wellpulse`)
6. Runs tenant migrations across all databases
7. Optionally seeds demo tenant with realistic data (485 field entries, 15 wells, 4 users)

**Output**:

- Color-coded progress indicators (blue, green, red, yellow)
- Summary table of tenants
- Login credentials for master admin and demo users

### `scripts/drop-dbs.sh`

**Purpose**: Safely drop all WellPulse databases for clean slate testing

**Features**:
- Terminates active connections before dropping
- Drops all WellPulse databases
- Provides clear status feedback

**Usage**:

```bash
./scripts/drop-dbs.sh
```

**What it does**:

1. Terminates active connections to WellPulse databases
2. Drops `wellpulse_master`
3. Drops `wellpulse_internal`
4. Drops `demo_wellpulse`

**Safety**: Uses `DROP DATABASE IF EXISTS` to avoid errors if databases don't exist

### Common Workflows with Scripts

**Clean slate setup**:

```bash
./scripts/drop-dbs.sh && ./scripts/create-dbs.sh --seed
```

**Test migration without seed data**:

```bash
./scripts/drop-dbs.sh && ./scripts/create-dbs.sh
```

**Verify seed script changes**:

```bash
# Drop and recreate with fresh seed data
./scripts/drop-dbs.sh
./scripts/create-dbs.sh --seed
```

### Script Implementation Details

**Dynamic Database Discovery**:

The `create-dbs.sh` script queries the master database to discover which tenant databases need to be created:

```bash
TENANT_DBS=$(psql -h localhost -d wellpulse_master -t -c "SELECT database_name FROM tenants ORDER BY subdomain;")

for db in $TENANT_DBS; do
  psql -h localhost -d postgres -c "CREATE DATABASE $db OWNER wellpulse;"
done
```

This ensures the script stays in sync with the tenant registry without hardcoding database names.

**Connection Termination**:

Before dropping databases, `drop-dbs.sh` terminates active connections to avoid "database is being accessed" errors:

```bash
psql -h localhost -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '$db' AND pid <> pg_backend_pid();
"
```

**Error Handling**:

Both scripts use `set -e` to exit immediately on any command failure, ensuring database consistency.

---

## Migration Patterns

### Pattern 1: Adding a NOT NULL Column

**Problem**: Can't add NOT NULL column to table with existing data.

**Solution**: 3-step migration:

```sql
-- Step 1: Add column as nullable
ALTER TABLE wells ADD COLUMN operator_email VARCHAR(255);

-- Step 2: Backfill data (application code or SQL)
UPDATE wells SET operator_email = 'default@example.com' WHERE operator_email IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE wells ALTER COLUMN operator_email SET NOT NULL;
```

### Pattern 2: Splitting a Column

**Problem**: Need to split `location` (varchar) into `latitude` and `longitude` (decimal).

**Solution**:

```sql
-- Step 1: Add new columns
ALTER TABLE wells ADD COLUMN latitude DECIMAL(10, 7);
ALTER TABLE wells ADD COLUMN longitude DECIMAL(10, 7);

-- Step 2: Backfill from old column (application code)
-- Parse "32.7767,-96.7970" → latitude=32.7767, longitude=-96.7970

-- Step 3: Drop old column (after full backfill)
ALTER TABLE wells DROP COLUMN location;
```

### Pattern 3: Foreign Key Migration

**Problem**: Adding foreign key to table with orphaned records.

**Solution**:

```sql
-- Step 1: Clean up orphaned records
DELETE FROM equipment WHERE well_id NOT IN (SELECT id FROM wells);

-- Step 2: Add foreign key
ALTER TABLE equipment ADD CONSTRAINT equipment_well_id_fk
  FOREIGN KEY (well_id) REFERENCES wells(id) ON DELETE CASCADE;
```

---

## Best Practices

### DO ✅

- **Always generate migrations** for schema changes (never hand-write SQL)
- **Review generated SQL** before applying (Drizzle sometimes makes incorrect assumptions)
- **Test migrations locally** against realistic data volumes
- **Use transactions** (Drizzle does this by default for PostgreSQL)
- **Commit migrations to git** with descriptive commit messages
- **Apply migrations before deploying code** (schema-first deployment)
- **Keep migrations small** (one logical change per migration)
- **Use `pnpm db:migrate:all`** for local development (applies master + tenant)

### DON'T ❌

- **Never use `db:push` in production** (bypasses migration history)
- **Never edit existing migration files** (breaks idempotency)
- **Never delete migration files** (causes sync issues)
- **Don't rename columns directly** (use 3-step migration pattern)
- **Don't add NOT NULL constraints without backfilling** (migration will fail)
- **Don't apply migrations manually** (use migration scripts)
- **Don't skip code review for migrations** (schema changes are critical)

---

## FAQ

### Q: When should I use `db:push` vs `db:migrate`?

**A**:

- **`db:push`**: Local development only, when iterating rapidly on schema design
- **`db:migrate`**: Always for production, staging, and shared environments

### Q: How do I test migrations before production?

**A**:

1. Apply to local development database
2. Apply to staging environment (Railway ephemeral preview)
3. Test with realistic data volumes (seed with production-like data)
4. Run application tests against migrated schema

### Q: What if a migration fails halfway through?

**A**: PostgreSQL transactions ensure atomicity:

- If migration fails, entire transaction rolls back
- Database remains in pre-migration state
- Fix migration file, then retry

### Q: How do I handle multi-tenant migrations at scale?

**A**: Current approach (sequential):

- Safe for 10-100 tenants
- For 1000+ tenants: parallelize with connection pooling
- For 10,000+ tenants: use job queue (Bull/BullMQ) + progress tracking

### Q: Can I run migrations from the NestJS app?

**A**: Not recommended:

- Migration scripts run once per deployment (not per app instance)
- Use standalone scripts (`migrate-master.ts`, `migrate-tenant.ts`)
- Avoids race conditions with multiple app instances

---

## Additional Resources

- [Drizzle Kit Migrations Docs](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL ALTER TABLE Docs](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Database Migration Best Practices (Martin Fowler)](https://martinfowler.com/articles/evodb.html)
- [WellPulse Multi-Tenancy Pattern](../patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)

---

**Next Steps**: See [Database Performance Optimization Guide](./database-performance.md) for indexing strategies.
