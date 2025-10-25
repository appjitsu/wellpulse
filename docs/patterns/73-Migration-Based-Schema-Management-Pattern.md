# Migration-Based Schema Management Pattern

**Category**: Database
**Type**: Infrastructure
**Complexity**: Intermediate
**Status**: Recommended

---

## Problem

In a multi-tenant SaaS application with evolving database schemas:

1. **Data Loss Risk**: Using `db:push` overwrites schema without preserving data
2. **No Version Control**: Can't track schema changes over time
3. **No Rollback**: Can't undo failed schema deployments
4. **Team Conflicts**: Developers can't coordinate schema changes
5. **Production Risk**: Schema changes applied without testing or review
6. **Multi-Tenant Complexity**: Need to apply schema changes to hundreds of tenant databases

---

## Solution

Use **migration-based schema management** with Drizzle Kit to generate version-controlled, incremental schema change scripts that can be reviewed, tested, and safely applied to production databases.

### Core Principles

1. **Schema as Code**: Define schema in TypeScript, generate SQL migrations
2. **Version Control**: Commit migration files to git with application code
3. **Incremental Changes**: Each migration represents one logical schema change
4. **Idempotency**: Migrations track what's been applied (no duplicate runs)
5. **Transactional**: PostgreSQL transactions ensure all-or-nothing application
6. **Reviewable**: Migration SQL can be code-reviewed before deployment

---

## Implementation

### 1. Drizzle Configuration (Multi-Tenant)

**Master Database Config** (`drizzle.config.ts`):

```typescript
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/infrastructure/database/master/schema.ts',
  out: './src/infrastructure/database/migrations/master',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.MASTER_DATABASE_URL || 'postgresql://localhost/master',
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

**Tenant Database Config** (`drizzle.tenant.config.ts`):

```typescript
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/infrastructure/database/schema/tenant/index.ts',
  out: './src/infrastructure/database/migrations/tenant',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.TENANT_TEMPLATE_DATABASE_URL || 'postgresql://localhost/tenant_template',
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

### 2. Migration Scripts

**Master Migration Runner** (`scripts/migrate-master.ts`):

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as path from 'path';

async function runMigration() {
  const connectionString = process.env.MASTER_DATABASE_URL;
  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  try {
    const migrationsFolder = path.join(__dirname, '..', 'migrations', 'master');
    await migrate(db, { migrationsFolder });
    console.log('✅ Master migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
```

**Tenant Migration Runner** (`scripts/migrate-tenant.ts`):

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { eq, isNull } from 'drizzle-orm';
import { tenants } from '../master/schema';

async function getTenants() {
  const masterPool = new Pool({
    connectionString: process.env.MASTER_DATABASE_URL,
    max: 1,
  });
  const masterDb = drizzle(masterPool);

  try {
    // Get all active tenants (exclude deleted)
    return await masterDb
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        databaseUrl: tenants.databaseUrl,
        databaseType: tenants.databaseType,
      })
      .from(tenants)
      .where(isNull(tenants.deletedAt));
  } finally {
    await masterPool.end();
  }
}

async function migrateTenant(tenant) {
  console.log(`🔄 Migrating: ${tenant.name}`);

  // Only migrate PostgreSQL databases
  if (tenant.databaseType !== 'POSTGRESQL') {
    console.log(`⏭️  Skipping (${tenant.databaseType} uses adapter)`);
    return;
  }

  const tenantPool = new Pool({
    connectionString: tenant.databaseUrl,
    max: 1,
  });
  const db = drizzle(tenantPool);

  try {
    const migrationsFolder = path.join(__dirname, '..', 'migrations', 'tenant');
    await migrate(db, { migrationsFolder });
    console.log(`✅ Completed: ${tenant.name}`);
  } catch (error) {
    console.error(`❌ Failed: ${tenant.name}`, error);
    throw error;
  } finally {
    await tenantPool.end();
  }
}

async function runMigrations() {
  const tenantsToMigrate = await getTenants();
  console.log(`📊 Migrating ${tenantsToMigrate.length} tenants`);

  for (const tenant of tenantsToMigrate) {
    await migrateTenant(tenant);
  }

  console.log('✅ All migrations completed');
}

runMigrations();
```

### 3. Package Scripts

**package.json**:

```json
{
  "scripts": {
    "db:generate:master": "drizzle-kit generate --config=drizzle.config.ts",
    "db:generate:tenant": "drizzle-kit generate --config=drizzle.tenant.config.ts",
    "db:migrate:master": "ts-node src/infrastructure/database/scripts/migrate-master.ts",
    "db:migrate:tenant": "ts-node src/infrastructure/database/scripts/migrate-tenant.ts",
    "db:migrate:all": "pnpm db:migrate:master && pnpm db:migrate:tenant"
  }
}
```

### 4. Workflow

**Development** (adding a new table):

```typescript
// 1. Define schema
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
# 2. Generate migration
pnpm db:generate:tenant

# 3. Review generated SQL
cat src/infrastructure/database/migrations/tenant/0003_add_equipment.sql

# 4. Apply migration locally
pnpm db:migrate:tenant

# 5. Commit migration file
git add src/infrastructure/database/migrations/tenant/
git commit -m "feat(db): add equipment table"
```

**Production Deployment**:

```bash
# 1. Backup databases (Azure automated backups)

# 2. Apply migrations
MASTER_DATABASE_URL=$PROD_MASTER pnpm db:migrate:master
MASTER_DATABASE_URL=$PROD_MASTER pnpm db:migrate:tenant

# 3. Deploy application code (expects new schema)
```

---

## Examples

### Example 1: Adding a Column

**Schema Change**:

```typescript
export const wells = pgTable('wells', {
  // ... existing columns
  operatorEmail: varchar('operator_email', { length: 255 }), // NEW
});
```

**Generated Migration** (`0004_add_operator_email.sql`):

```sql
ALTER TABLE "wells" ADD COLUMN "operator_email" varchar(255);
```

**Apply**:

```bash
pnpm db:generate:tenant
pnpm db:migrate:tenant
```

### Example 2: Adding a NOT NULL Column (Safe Pattern)

**Problem**: Can't add NOT NULL column to table with existing rows.

**Solution**: 3-step migration:

**Step 1**: Add column as nullable:

```typescript
export const wells = pgTable('wells', {
  operatorEmail: varchar('operator_email', { length: 255 }), // Nullable first
});
```

```bash
pnpm db:generate:tenant  # Migration 0005: ADD COLUMN (nullable)
pnpm db:migrate:tenant
```

**Step 2**: Backfill data (application code or SQL):

```typescript
// Application code backfills data
await wellRepository.updateAll({ operatorEmail: 'default@example.com' });
```

**Step 3**: Add NOT NULL constraint:

```typescript
export const wells = pgTable('wells', {
  operatorEmail: varchar('operator_email', { length: 255 }).notNull(), // Now NOT NULL
});
```

```bash
pnpm db:generate:tenant  # Migration 0006: ALTER COLUMN SET NOT NULL
pnpm db:migrate:tenant
```

### Example 3: Renaming a Column (Safe Pattern)

**Problem**: Direct rename causes data loss.

**Solution**: 3-step migration with dual-write period.

**Step 1**: Add new column:

```typescript
export const wells = pgTable('wells', {
  operator: varchar('operator', { length: 255 }), // OLD
  operatorName: varchar('operator_name', { length: 255 }), // NEW
});
```

**Step 2**: Dual-write application code (writes to both columns):

```typescript
await wellRepository.update(wellId, {
  operator: name, // OLD column
  operatorName: name, // NEW column (duplicate data)
});
```

**Step 3**: Drop old column (after full backfill):

```typescript
export const wells = pgTable('wells', {
  // operator removed
  operatorName: varchar('operator_name', { length: 255 }).notNull(),
});
```

---

## Benefits

### 1. Zero Data Loss

- Migrations preserve existing data during schema changes
- Transactions ensure all-or-nothing application (PostgreSQL)
- Rollback capability if migration fails

### 2. Version Control

- Migration files tracked in git alongside code
- Full schema history (who, when, why)
- Code review for schema changes (SQL review)

### 3. Team Collaboration

- Merge conflicts resolved in migration files (not runtime)
- Consistent schema across all environments
- Clear ownership of schema changes (git blame)

### 4. Production Safety

- Test migrations in staging before production
- Dry-run capability (generate migration, review SQL, don't apply)
- Automated CI/CD integration (apply on deploy)

### 5. Multi-Tenant Scale

- Apply schema changes to hundreds of tenant databases
- Track migration status per tenant
- Skip non-PostgreSQL tenants (adapter pattern)

---

## Drawbacks

### 1. Complexity

- More steps than `db:push` (generate → review → apply)
- Requires discipline (never skip migration generation)

**Mitigation**: Clear documentation, CI/CD enforcement

### 2. Merge Conflicts

- Two developers modifying schema simultaneously
- Migration file timestamps conflict

**Mitigation**: Communicate schema changes, regenerate migrations after merge

### 3. Multi-Tenant Performance

- Sequential migration of 1000+ tenants takes time
- Network latency for remote databases

**Mitigation**: Parallelize with connection pooling, use job queue (Bull/BullMQ)

---

## When to Use

✅ **Use migration-based schema management when**:

- Working in a team (multiple developers)
- Deploying to production (data loss unacceptable)
- Need schema version control (audit trail)
- Multi-tenant architecture (consistent schema across tenants)
- Require rollback capability (undo failed deployments)

❌ **Use `db:push` when**:

- Solo local development (rapid prototyping)
- Throwaway databases (test data, no production consequences)
- Initial schema design (frequent changes, no existing data)

**Rule of Thumb**: If data matters, use migrations.

---

## Troubleshooting

### Error: "(0, postgres_1.default) is not a function"

**Cause**: Migration script using `postgres-js` library while rest of codebase uses `node-postgres` (pg).

**Solution**: Standardize on one PostgreSQL client library. WellPulse uses `node-postgres` (pg):

```typescript
// ❌ Wrong: postgres-js
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
const connection = postgres(url, { max: 1 });

// ✅ Correct: node-postgres
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: url, max: 1 });
```

**Why it matters**: Different client libraries have incompatible APIs and connection pooling behavior. Using two libraries causes runtime errors and makes connection pool monitoring inconsistent.

### Error: "relation already exists"

**Cause**: Table was created via `db:push` or previous migration, but Drizzle's migration tracking isn't aware.

**Solution**: Drop and recreate tenant databases in development:

```bash
# Development only - destroys all data!
psql -U superuser -c "DROP DATABASE tenant_db;"
psql -U superuser -c "CREATE DATABASE tenant_db OWNER tenant_user;"
pnpm db:migrate:tenant
```

**Production**: Never drop databases. Instead, manually track which migrations have been applied.

### Error: "database does not exist"

**Cause**: Tenant database hasn't been created yet.

**Solution**: Migration scripts only apply schema changes - they don't create databases. Create databases first:

```bash
# Create tenant database
psql -U superuser -c "CREATE DATABASE acme_wellpulse OWNER wellpulse;"

# Then run migrations
pnpm db:migrate:tenant
```

---

## Related Patterns

- **[Database-Per-Tenant Multi-Tenancy Pattern](./69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)** - Tenant isolation strategy
- **[Repository Pattern](./02-Repository-Pattern.md)** - Database access abstraction
- **[Audit Log Pattern](./29-Audit-Log-Pattern.md)** - Track schema change audit trail
- **[Database Seeding Pattern](./74-Database-Seeding-Pattern.md)** - Populate databases with initial/test data

---

## References

- [Drizzle Kit Migrations](https://orm.drizzle.team/kit-docs/overview)
- [Evolutionary Database Design (Martin Fowler)](https://martinfowler.com/articles/evodb.html)
- [PostgreSQL Transactional DDL](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis)

---

## Implementation Checklist

- [ ] Create separate configs for master and tenant databases
- [ ] Implement migration runner scripts with proper error handling
- [ ] Add migration npm scripts to package.json
- [ ] Generate initial migrations for existing schemas
- [ ] Test migration workflow locally (generate → apply → verify)
- [ ] Document workflow in project README
- [ ] Integrate into CI/CD pipeline (automated migration on deploy)
- [ ] Train team on migration best practices
- [ ] Enforce "no db:push in production" rule (CI/CD check)
- [ ] Set up database backups before migration (Azure automated backups)

---

**Tags**: #database #migrations #schema-management #multi-tenancy #drizzle #postgresql
