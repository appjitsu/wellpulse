# Database Seeding Pattern

## Context

Multi-tenant applications need to seed initial data for development, testing, and production environments. In WellPulse, we have two types of databases that need seeding:

- **Master Database**: Platform-wide data (admin users, tenants, billing)
- **Tenant Databases**: Tenant-specific data (wells, users, production data)

## Problem

How do you structure seed files for a multi-database, multi-tenant application while keeping the seeding process simple, maintainable, and environment-aware?

## Solution

Use a simple `tsx`-based seeding approach with separate seed files for master and tenant databases, following Catalyst project conventions:

### Structure

```
src/infrastructure/database/
├── seeds/
│   ├── master.seed.ts    # Seeds master database
│   └── tenant.seed.ts    # Seeds tenant database(s)
├── master/
│   ├── client.ts         # Master DB connection
│   └── schema.ts         # Master schema
└── schema/
    └── tenant/
        └── index.ts      # Tenant schema
```

### Implementation

#### 1. **Master Seed File**

```typescript
// src/infrastructure/database/seeds/master.seed.ts
import { masterDb } from '../master/client';
import { tenants, adminUsers, billingSubscriptions } from '../master/schema';
import * as bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Starting master database seed...\n');

  try {
    // 1. Create Super Admin
    const hashedPassword = await bcrypt.hash('SecurePassword2025!', 10);
    const [superAdmin] = await masterDb
      .insert(adminUsers)
      .values({
        email: 'admin@platform.com',
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN',
      })
      .returning()
      .onConflictDoNothing();

    // 2. Create Sample Tenants
    const [tenant] = await masterDb
      .insert(tenants)
      .values({
        slug: 'acme',
        subdomain: 'acme',
        name: 'ACME Corp',
        databaseName: 'acme_db',
        status: 'ACTIVE',
        createdBy: superAdmin?.id,
      })
      .returning()
      .onConflictDoNothing();

    console.log('✅ Master database seed completed!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Make it executable
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { seed };
```

#### 2. **Tenant Seed File**

```typescript
// src/infrastructure/database/seeds/tenant.seed.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { wells, users } from '../schema/tenant';

async function seed() {
  console.log('🌱 Starting tenant database seed...\n');

  // Get target tenant database from environment variable
  const targetDb =
    process.env.TENANT_SEED_DATABASE_URL || 'postgresql://user:pass@localhost:5432/default_tenant';

  console.log(`📦 Target: ${targetDb.split('@')[1]}\n`);

  const pool = new Pool({ connectionString: targetDb });
  const db = drizzle(pool);

  try {
    // Seed tenant-specific data
    const [well] = await db
      .insert(wells)
      .values({
        apiNumber: 'API-42-123-45678',
        name: 'Sample Well #1',
        status: 'ACTIVE',
      })
      .returning()
      .onConflictDoNothing();

    console.log('✅ Tenant database seed completed!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Make it executable
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

export { seed };
```

#### 3. **Package.json Scripts**

```json
{
  "scripts": {
    "db:seed": "tsx src/infrastructure/database/seeds/master.seed.ts",
    "db:seed:master": "tsx src/infrastructure/database/seeds/master.seed.ts",
    "db:seed:tenant": "tsx src/infrastructure/database/seeds/tenant.seed.ts"
  }
}
```

#### 4. **Drizzle Config (No Seed Configuration Needed)**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/database/master/schema.ts',
  out: './src/infrastructure/database/migrations/master',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.MASTER_DATABASE_URL || 'postgresql://...',
  },
  verbose: true,
  strict: true,
  // NO seed: './...' configuration needed
});
```

## Usage

### Development Setup

```bash
# 1. Seed master database (creates admin users, tenants)
pnpm db:seed:master

# 2. Seed a specific tenant database
TENANT_SEED_DATABASE_URL=postgresql://user:pass@localhost:5432/acme_db pnpm db:seed:tenant

# Or use default tenant
pnpm db:seed:tenant
```

### CI/CD Pipeline

```bash
# Automated seeding in tests
DATABASE_URL=postgresql://test_db pnpm db:seed:master
TENANT_SEED_DATABASE_URL=postgresql://tenant_test_db pnpm db:seed:tenant
```

## Key Patterns

### 1. **Idempotent Seeds**

Use `.onConflictDoNothing()` to make seeds safe to run multiple times:

```typescript
const [admin] = await db
  .insert(adminUsers)
  .values({ email: 'admin@app.com', ... })
  .returning()
  .onConflictDoNothing(); // Safe to re-run
```

### 2. **Environment-Aware**

```typescript
const targetDb =
  process.env.TENANT_SEED_DATABASE_URL || // Explicit target
  process.env.DATABASE_URL || // CI/test environment
  'postgresql://localhost/default'; // Development fallback
```

### 3. **Executable Scripts**

```typescript
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal:', error);
      process.exit(1);
    });
}
```

### 4. **Modular Seeds**

For large seed files, split into modules:

```typescript
// seeds/master.seed.ts
import { seedAdmins } from './modules/seed-admins';
import { seedTenants } from './modules/seed-tenants';
import { seedBilling } from './modules/seed-billing';

async function seed() {
  await seedAdmins(masterDb);
  await seedTenants(masterDb);
  await seedBilling(masterDb);
}
```

## Benefits

1. **Simple**: No complex configuration - just TypeScript files run with `tsx`
2. **Flexible**: Environment variables control which database to seed
3. **Idempotent**: Safe to run multiple times (onConflictDoNothing)
4. **Testable**: Can import and use in tests
5. **Multi-Tenant**: Separate seeds for master vs tenant databases

## Trade-offs

- **Manual Execution**: Requires explicit script running (vs automatic on migrate)
- **No Built-in CLI**: Unlike some ORMs with `db:seed` commands
- **Environment Management**: Must manage DATABASE_URL yourself

## When to Use

- ✅ Multi-tenant applications with separate databases
- ✅ Development data setup
- ✅ Test fixtures
- ✅ Initial production data (admin users, system configs)
- ✅ Demo environments

## When NOT to Use

- ❌ Production data migrations (use migrations instead)
- ❌ Large data imports (use bulk import tools)
- ❌ Real customer data (use proper data import flows)

## Related Patterns

- [Migration-Based Schema Management Pattern](./73-Migration-Based-Schema-Management-Pattern.md)
- [Database-Per-Tenant Multi-Tenancy Pattern](./69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)

## Example: WellPulse

```bash
# Master DB: Create admin, 3 tenants (wellpulse, acme, demo)
pnpm db:seed:master

# Seed ACME tenant with sample wells
TENANT_SEED_DATABASE_URL=postgresql://wellpulse:wellpulse@localhost:5432/acme_wellpulse \
  pnpm db:seed:tenant

# Seed Demo tenant
TENANT_SEED_DATABASE_URL=postgresql://wellpulse:wellpulse@localhost:5432/demo_wellpulse \
  pnpm db:seed:tenant
```

## References

- Catalyst Project: Simple tsx-based seeding approach
- Drizzle ORM: Query builder with `.onConflictDoNothing()`
- tsx: TypeScript execute (faster than ts-node)
