# Database-Per-Tenant Multi-Tenancy Pattern

**Category**: Architecture Pattern
**Complexity**: Advanced
**Status**: ✅ Production Ready
**Related Patterns**: Repository Pattern, Unit of Work, Connection Pooling
**Industry Context**: Oil & Gas Field Data Management

---

## Overview

The Database-Per-Tenant Multi-Tenancy pattern provides complete data isolation by giving each tenant (oil & gas operator) their own dedicated database. Unlike shared-database approaches (row-level security), this pattern ensures:

- **Complete data isolation**: No risk of cross-tenant data leakage
- **Client data sovereignty**: Tenants choose where their database lives (Azure, AWS, on-premises)
- **Independent scaling**: Large tenants get dedicated resources
- **Compliance alignment**: Easier to meet regulatory requirements (data residency, audit trails)

This pattern is critical for WellPulse because oil & gas operators demand:

1. Control over where their production data is stored
2. Assurance that competitors cannot access their data (even accidentally)
3. Ability to keep databases on-premises for security/compliance

---

## The Problem

**Scenario**: WellPulse serves 50+ independent oil & gas operators. Each operator has:

- Proprietary production data (well outputs, equipment sensors, field notes)
- Regulatory compliance requirements (state-specific, data residency)
- Different infrastructure preferences (some use Azure, some AWS, some on-prem)

**Challenges with Shared Database + Row-Level Security (RLS)**:

```typescript
// ❌ Shared database approach (not suitable for WellPulse)
await db.select().from(wellsTable).where(eq(wellsTable.organizationId, currentOrgId)); // RLS filter

// Problems:
// 1. Single database failure = all tenants down
// 2. Noisy neighbor: One tenant's heavy queries slow down others
// 3. Client cannot choose database location
// 4. Compliance risk: All data in same database (harder to audit/isolate)
// 5. Psychological barrier: "My data is mixed with competitors' data"
```

**What We Need**:

- Each tenant has a completely separate database
- WellPulse API dynamically connects to the correct tenant database per request
- Efficient connection pooling (don't create new DB connections on every request)
- Support for tenant databases hosted anywhere (Azure, AWS, on-prem)

---

## The Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     WellPulse API (Azure)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tenant Identification Middleware                        │  │
│  │  (Extract subdomain → Lookup tenant in master DB)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tenant Context (Stored in Request)                      │  │
│  │  - tenantId: "acmeoil-uuid"                              │  │
│  │  - slug: "acmeoil"                                       │  │
│  │  - databaseUrl: "postgresql://..."                       │  │
│  │  - connectionType: "AZURE_PRIVATE_LINK"                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  TenantDatabaseService                                   │  │
│  │  - Maintains connection pool per tenant                  │  │
│  │  - Lazy-loads pools on first request                     │  │
│  │  - Caches pools for subsequent requests                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Repository Layer (Hexagonal Architecture)               │  │
│  │  - WellRepository.findById(tenantId, wellId)             │  │
│  │  - ProductionDataRepository.getByDate(tenantId, date)    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────┴──────────────────┬──────────────────┐
        ↓                                     ↓                  ↓
┌───────────────────┐              ┌───────────────────┐  ┌──────────────────┐
│ Tenant 1 DB       │              │ Tenant 2 DB       │  │ Tenant 3 DB      │
│ (Azure East US)   │              │ (AWS US-West-2)   │  │ (On-Premises)    │
├───────────────────┤              ├───────────────────┤  ├──────────────────┤
│ acmeoil_prod      │              │ permianprod_db    │  │ texasenergy_db   │
│ - wells           │              │ - wells           │  │ - wells          │
│ - production_data │              │ - production_data │  │ - production_data│
│ - equipment       │              │ - equipment       │  │ - equipment      │
└───────────────────┘              └───────────────────┘  └──────────────────┘
```

---

## Implementation

### 1. Master Database Schema (Tenant Registry)

The master database stores tenant metadata and routing information:

```typescript
// apps/api/src/infrastructure/database/schema/master/tenants.schema.ts
import { pgTable, varchar, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 255 }).primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(), // "acmeoil"
  name: varchar('name', { length: 255 }).notNull(), // "ACME Oil & Gas"

  // Database connection info
  databaseUrl: text('database_url').notNull(), // Full PostgreSQL connection string
  connectionType: varchar('connection_type', { length: 50 }).notNull(),
  // "AZURE_PRIVATE_LINK" | "AWS_VPN" | "ON_PREMISES_VPN" | "PUBLIC_SSL"

  // Deployment info
  region: varchar('region', { length: 50 }).notNull(), // "azure-east-us", "aws-us-west-2", "on-premises"
  provider: varchar('provider', { length: 50 }).notNull(), // "AZURE" | "AWS" | "ON_PREMISES" | "GCP"

  // Feature flags & tier
  tier: varchar('tier', { length: 50 }).notNull().default('STARTER'),
  // "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
  features: jsonb('features').notNull().default({}), // { predictiveMaintenance: true, ... }

  // Status & lifecycle
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  // "ACTIVE" | "SUSPENDED" | "TRIAL" | "MIGRATING"
  trialEndsAt: timestamp('trial_ends_at'),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});

export type Tenant = typeof tenants.$inferSelect;
```

**Example Data**:

```sql
INSERT INTO tenants (id, slug, name, database_url, connection_type, region, provider, tier, status)
VALUES
  (
    'acmeoil-uuid',
    'acmeoil',
    'ACME Oil & Gas',
    'postgresql://acmeoil_user:password@acmeoil-db.postgres.database.azure.com:5432/acmeoil_prod?sslmode=require',
    'AZURE_PRIVATE_LINK',
    'azure-east-us',
    'AZURE',
    'PROFESSIONAL',
    'ACTIVE'
  ),
  (
    'permianprod-uuid',
    'permianprod',
    'Permian Production LLC',
    'postgresql://permian_user:password@permian-db.us-west-2.rds.amazonaws.com:5432/permian_db?sslmode=require',
    'AWS_VPN',
    'aws-us-west-2',
    'AWS',
    'ENTERPRISE',
    'ACTIVE'
  ),
  (
    'texasenergy-uuid',
    'texasenergy',
    'Texas Energy Co.',
    'postgresql://texasenergy:password@192.168.50.10:5432/texasenergy_db?sslmode=require',
    'ON_PREMISES_VPN',
    'on-premises',
    'ON_PREMISES',
    'ENTERPRISE',
    'ACTIVE'
  );
```

---

### 2. Tenant Identification Middleware

Extracts tenant from subdomain and injects context into request:

```typescript
// apps/api/src/presentation/middleware/tenant-identification.middleware.ts
import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantConfigService } from '@/infrastructure/database/services/tenant-config.service';

@Injectable()
export class TenantIdentificationMiddleware implements NestMiddleware {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Extract subdomain from hostname
    const hostname = req.hostname; // e.g., "acmeoil.wellpulse.io"
    const subdomain = hostname.split('.')[0];

    // Handle special cases (marketing site, admin portal)
    if (['www', 'api', 'admin', 'app'].includes(subdomain)) {
      // Public routes or admin panel - no tenant context needed
      return next();
    }

    // Lookup tenant from master database (with caching)
    const tenant = await this.tenantConfigService.getTenantBySlug(subdomain);

    if (!tenant) {
      throw new NotFoundException(`Tenant '${subdomain}' not found`);
    }

    if (tenant.status !== 'ACTIVE') {
      throw new NotFoundException(`Tenant '${subdomain}' is ${tenant.status.toLowerCase()}`);
    }

    // Inject tenant context into request
    (req as any).tenant = {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      databaseUrl: tenant.databaseUrl,
      connectionType: tenant.connectionType,
      region: tenant.region,
      provider: tenant.provider,
      tier: tenant.tier,
      features: tenant.features,
    };

    next();
  }
}
```

**Apply middleware globally**:

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TenantIdentificationMiddleware } from './presentation/middleware/tenant-identification.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply tenant identification middleware globally
  app.use(TenantIdentificationMiddleware);

  await app.listen(3001);
}
```

---

### 3. Tenant Config Service (Master DB Queries)

Fetches tenant metadata from master database with caching:

```typescript
// apps/api/src/infrastructure/database/services/tenant-config.service.ts
import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { tenants, Tenant } from '@/infrastructure/database/schema/master/tenants.schema';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

@Injectable()
export class TenantConfigService {
  private masterDb: NodePgDatabase;
  private tenantCache: Map<string, Tenant> = new Map(); // In-memory cache

  constructor(private readonly configService: ConfigService) {
    // Connect to master database
    const masterDbUrl = this.configService.get('DATABASE_URL_MASTER');
    const pool = new Pool({ connectionString: masterDbUrl });
    this.masterDb = drizzle(pool);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    // Check cache first (avoid DB query on every request)
    if (this.tenantCache.has(slug)) {
      return this.tenantCache.get(slug);
    }

    // Query master database
    const results = await this.masterDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const tenant = results[0];

    // Cache tenant (invalidate after 5 minutes)
    this.tenantCache.set(slug, tenant);
    setTimeout(() => this.tenantCache.delete(slug), 5 * 60 * 1000);

    return tenant;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const results = await this.masterDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return results.length > 0 ? results[0] : null;
  }

  async getAllActiveTenants(): Promise<Tenant[]> {
    return await this.masterDb.select().from(tenants).where(eq(tenants.status, 'ACTIVE'));
  }

  // Invalidate cache when tenant is updated
  invalidateCache(slug: string): void {
    this.tenantCache.delete(slug);
  }
}
```

---

### 4. Tenant Database Service (Connection Pooling)

**Core Pattern**: Lazy-load connection pools per tenant, cache them for reuse.

```typescript
// apps/api/src/infrastructure/database/services/tenant-database.service.ts
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { TenantConfigService } from './tenant-config.service';
import * as schema from '@/infrastructure/database/schema/tenant'; // Tenant-scoped tables

@Injectable()
export class TenantDatabaseService {
  private readonly logger = new Logger(TenantDatabaseService.name);
  private connectionPools: Map<string, { pool: Pool; db: NodePgDatabase }> = new Map();

  constructor(private readonly tenantConfigService: TenantConfigService) {}

  /**
   * Get Drizzle database instance for a specific tenant.
   * Lazy-loads connection pool on first request, caches for subsequent requests.
   */
  async getTenantDatabase(tenantId: string): Promise<NodePgDatabase> {
    // Return cached connection pool if available
    if (this.connectionPools.has(tenantId)) {
      return this.connectionPools.get(tenantId).db;
    }

    // Fetch tenant configuration
    const tenant = await this.tenantConfigService.getTenantById(tenantId);

    if (!tenant) {
      throw new InternalServerErrorException(`Tenant ${tenantId} not found in master database`);
    }

    this.logger.log(
      `Creating connection pool for tenant: ${tenant.slug} (${tenant.connectionType})`,
    );

    // Create new PostgreSQL connection pool
    const pool = new Pool({
      connectionString: tenant.databaseUrl,
      max: 20, // Max connections per tenant (tune based on load)
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Timeout if connection takes >5s
      ssl: this.getSslConfig(tenant.connectionType),
    });

    // Handle connection errors
    pool.on('error', (err) => {
      this.logger.error(`PostgreSQL pool error for tenant ${tenant.slug}:`, err);
    });

    // Create Drizzle ORM instance
    const db = drizzle(pool, { schema });

    // Cache the connection pool
    this.connectionPools.set(tenantId, { pool, db });

    this.logger.log(`Connection pool created for tenant: ${tenant.slug}`);

    return db;
  }

  /**
   * Close connection pool for a specific tenant.
   * Useful when tenant is deleted or migrated.
   */
  async closeTenantPool(tenantId: string): Promise<void> {
    if (this.connectionPools.has(tenantId)) {
      const { pool } = this.connectionPools.get(tenantId);
      await pool.end();
      this.connectionPools.delete(tenantId);
      this.logger.log(`Connection pool closed for tenant: ${tenantId}`);
    }
  }

  /**
   * Close all connection pools (used during graceful shutdown).
   */
  async closeAllPools(): Promise<void> {
    this.logger.log('Closing all tenant connection pools...');

    const closePromises = Array.from(this.connectionPools.values()).map(({ pool }) => pool.end());

    await Promise.all(closePromises);

    this.connectionPools.clear();

    this.logger.log('All tenant connection pools closed');
  }

  /**
   * Get SSL configuration based on connection type.
   */
  private getSslConfig(connectionType: string): any {
    switch (connectionType) {
      case 'AZURE_PRIVATE_LINK':
      case 'AWS_VPN':
      case 'ON_PREMISES_VPN':
        return { rejectUnauthorized: true }; // Require valid SSL cert

      case 'PUBLIC_SSL':
        return { rejectUnauthorized: true };

      default:
        return false; // No SSL (only for local dev)
    }
  }
}
```

**Graceful Shutdown Hook**:

```typescript
// apps/api/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ... other setup

  // Graceful shutdown: Close all database connections
  app.enableShutdownHooks();

  process.on('SIGTERM', async () => {
    const tenantDbService = app.get(TenantDatabaseService);
    await tenantDbService.closeAllPools();
    await app.close();
  });

  await app.listen(3001);
}
```

---

### 5. Repository Pattern with Tenant Context

Every repository method **requires** `tenantId` parameter:

```typescript
// apps/api/src/infrastructure/database/repositories/well.repository.ts
import { Injectable } from '@nestjs/common';
import { IWellRepository } from '@/domain/repositories/well.repository.interface';
import { Well } from '@/domain/wells/well.entity';
import { TenantDatabaseService } from '../services/tenant-database.service';
import { wellsTable } from '../schema/tenant/wells.schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class WellRepository implements IWellRepository {
  constructor(private readonly tenantDbService: TenantDatabaseService) {}

  async findById(tenantId: string, wellId: string): Promise<Well | null> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    const results = await db
      .select()
      .from(wellsTable)
      .where(
        and(
          eq(wellsTable.id, wellId),
          eq(wellsTable.deletedAt, null), // Soft delete filter
        ),
      )
      .limit(1);

    return results[0] ? this.toDomain(results[0]) : null;
  }

  async findAll(tenantId: string): Promise<Well[]> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    const results = await db.select().from(wellsTable).where(eq(wellsTable.deletedAt, null));

    return results.map(this.toDomain);
  }

  async save(tenantId: string, well: Well): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    const data = this.toPersistence(well);

    await db.insert(wellsTable).values(data).onConflictDoUpdate({
      target: wellsTable.id,
      set: data,
    });
  }

  async delete(tenantId: string, wellId: string): Promise<void> {
    const db = await this.tenantDbService.getTenantDatabase(tenantId);

    // Soft delete
    await db.update(wellsTable).set({ deletedAt: new Date() }).where(eq(wellsTable.id, wellId));
  }

  private toDomain(row: any): Well {
    // Map database row to domain entity
    return Well.create(
      {
        name: row.name,
        apiNumber: row.api_number,
        location: { latitude: row.latitude, longitude: row.longitude },
        status: row.status,
        createdAt: row.created_at,
      },
      row.id,
    );
  }

  private toPersistence(well: Well): any {
    // Map domain entity to database row
    return {
      id: well.id,
      name: well.name,
      api_number: well.apiNumber,
      latitude: well.location.latitude,
      longitude: well.location.longitude,
      status: well.status,
      created_at: well.createdAt,
      updated_at: new Date(),
    };
  }
}
```

**Critical Rule**: ❌ **NEVER** allow a repository method without `tenantId`. This prevents accidental cross-tenant data access.

---

### 6. Controller with Tenant Context

Use custom decorator to extract tenant from request:

```typescript
// apps/api/src/presentation/decorators/tenant-context.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantContext = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.tenant; // Injected by TenantIdentificationMiddleware
});
```

**Usage in Controller**:

```typescript
// apps/api/src/presentation/wells/wells.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/presentation/guards/jwt-auth.guard';
import { TenantContext } from '@/presentation/decorators/tenant-context.decorator';
import { GetWellByIdQuery } from '@/application/wells/queries/get-well-by-id.query';
import { QueryBus } from '@nestjs/cqrs';

@Controller('wells')
@UseGuards(JwtAuthGuard) // Ensure user is authenticated
export class WellsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':wellId')
  async getWellById(
    @TenantContext() tenant: any, // Tenant context from subdomain
    @Param('wellId') wellId: string,
  ) {
    const query = new GetWellByIdQuery(tenant.id, wellId);
    return this.queryBus.execute(query);
  }
}
```

**Flow**:

1. Request: `GET https://acmeoil.wellpulse.io/wells/well-123`
2. Middleware extracts subdomain `acmeoil`
3. Middleware fetches tenant from master DB
4. Middleware injects tenant into `req.tenant`
5. Controller extracts tenant via `@TenantContext()` decorator
6. Query handler uses `tenantId` to get correct database connection

---

## Benefits

### 1. **Complete Data Isolation**

Each tenant's data is in a separate database. No risk of accidental cross-tenant queries.

```typescript
// ✅ With Database-Per-Tenant
const acmeoilDb = await tenantDbService.getTenantDatabase('acmeoil-uuid');
const permianDb = await tenantDbService.getTenantDatabase('permianprod-uuid');

// These are completely separate databases
// No way for acmeoil to access permianprod data
```

### 2. **Client Data Sovereignty**

Clients choose where their database lives:

```typescript
// Client A: Azure East US (close to their headquarters)
tenants.databaseUrl = 'postgresql://...@azure-east-us.postgres.database.azure.com/...';

// Client B: AWS US-West-2 (they already use AWS)
tenants.databaseUrl = 'postgresql://...@us-west-2.rds.amazonaws.com/...';

// Client C: On-premises (behind their firewall)
tenants.databaseUrl = 'postgresql://...@192.168.50.10/...';
```

### 3. **Independent Scaling**

Large tenants get dedicated database servers:

```typescript
// Small tenant: Shared Azure PostgreSQL (Burstable B1ms, $30/month)
// Large tenant: Dedicated Azure PostgreSQL (General Purpose 8 vCores, $500/month)
```

### 4. **Easier Compliance**

Each tenant's database can have different:

- Backup retention policies
- Encryption keys
- Audit logging levels
- Geographic location (data residency requirements)

### 5. **Simplified Migrations**

Migrate one tenant at a time (not all-or-nothing):

```typescript
// Migrate acmeoil from on-prem to Azure
// 1. Create new Azure PostgreSQL database
// 2. Dump/restore data
// 3. Update tenants.databaseUrl in master DB
// 4. TenantDatabaseService automatically uses new connection
// 5. Other tenants unaffected
```

---

## Performance Considerations

### Connection Pool Sizing

**Rule of Thumb**: `max_connections = (number_of_replicas * pool_size) + buffer`

```typescript
// Example: 3 API replicas, 20 connections per replica
// Total connections needed: 3 * 20 = 60 connections

const pool = new Pool({
  max: 20, // Per-tenant pool size
  min: 5, // Keep 5 connections warm
  idleTimeoutMillis: 30000, // Close idle connections after 30s
});
```

**Azure PostgreSQL Flexible Server limits**:

- Burstable B1ms: 50 max connections
- General Purpose 2 vCores: 859 max connections
- General Purpose 4 vCores: 1719 max connections

**Recommendation**: For shared tenant databases (multiple small tenants on one server), use **lower pool sizes** (5-10 connections per tenant).

### Caching Strategy

Cache tenant metadata aggressively:

```typescript
// ✅ Good: Cache tenant for 5 minutes
this.tenantCache.set(slug, tenant);
setTimeout(() => this.tenantCache.delete(slug), 5 * 60 * 1000);

// ❌ Bad: Query master DB on every request
const tenant = await this.masterDb.select()...
```

**Redis Caching (Optional)**:

```typescript
// For production, use Redis for cross-process caching
const cachedTenant = await redis.get(`tenant:${slug}`);
if (cachedTenant) return JSON.parse(cachedTenant);

// Cache for 10 minutes
await redis.setex(`tenant:${slug}`, 600, JSON.stringify(tenant));
```

---

## Anti-Patterns

### ❌ **Don't: Forget Tenant Context**

```typescript
// ❌ BAD: No tenantId parameter
async findById(wellId: string): Promise<Well> {
  // Which tenant's database should we query?
  const db = await this.tenantDbService.getTenantDatabase(???);
}

// ✅ GOOD: Always require tenantId
async findById(tenantId: string, wellId: string): Promise<Well> {
  const db = await this.tenantDbService.getTenantDatabase(tenantId);
}
```

### ❌ **Don't: Create New Pools on Every Request**

```typescript
// ❌ BAD: New pool for every request (connection exhaustion)
async findById(tenantId: string, wellId: string): Promise<Well> {
  const pool = new Pool({ connectionString: tenant.databaseUrl });
  const db = drizzle(pool);
  // ...
}

// ✅ GOOD: Reuse cached connection pool
async findById(tenantId: string, wellId: string): Promise<Well> {
  const db = await this.tenantDbService.getTenantDatabase(tenantId); // Cached
  // ...
}
```

### ❌ **Don't: Store Tenant Databases in Code**

```typescript
// ❌ BAD: Hardcoded database URLs
const tenantDatabases = {
  acmeoil: 'postgresql://...',
  permianprod: 'postgresql://...',
};

// ✅ GOOD: Store in master database (dynamic, supports new tenants without code changes)
const tenant = await this.tenantConfigService.getTenantBySlug(slug);
```

---

## Testing Strategy

### Unit Tests: Mock TenantDatabaseService

```typescript
// apps/api/test/unit/repositories/well.repository.spec.ts
describe('WellRepository', () => {
  let repository: WellRepository;
  let mockTenantDbService: jest.Mocked<TenantDatabaseService>;

  beforeEach(() => {
    mockTenantDbService = {
      getTenantDatabase: jest.fn(),
    } as any;

    repository = new WellRepository(mockTenantDbService);
  });

  it('should find well by ID', async () => {
    const mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ id: 'well-123', name: 'Well A' }]),
    };

    mockTenantDbService.getTenantDatabase.mockResolvedValue(mockDb as any);

    const well = await repository.findById('tenant-uuid', 'well-123');

    expect(well).toBeDefined();
    expect(well.name).toBe('Well A');
    expect(mockTenantDbService.getTenantDatabase).toHaveBeenCalledWith('tenant-uuid');
  });
});
```

### Integration Tests: Use Test Tenant Database

```typescript
// apps/api/test/integration/wells/wells.e2e-spec.ts
describe('Wells API (E2E)', () => {
  let app: INestApplication;
  let tenantDbService: TenantDatabaseService;

  const TEST_TENANT_ID = 'test-tenant-uuid';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    tenantDbService = app.get(TenantDatabaseService);

    // Create test tenant in master DB
    await createTestTenant(TEST_TENANT_ID);

    // Run migrations on test tenant database
    await runMigrationsForTenant(TEST_TENANT_ID);

    await app.init();
  });

  afterAll(async () => {
    // Clean up test tenant database
    await dropTestTenantDatabase(TEST_TENANT_ID);
    await app.close();
  });

  it('should create a well for test tenant', async () => {
    const response = await request(app.getHttpServer())
      .post('/wells')
      .set('Host', 'testtenant.wellpulse.io') // Simulate subdomain
      .send({ name: 'Test Well', apiNumber: 'TX-12345' })
      .expect(201);

    expect(response.body.name).toBe('Test Well');
  });
});
```

---

## Migration Strategy

### Onboarding New Tenant

1. **Client provisions database** (Azure, AWS, or on-prem)
2. **Client shares connection string** with WellPulse
3. **WellPulse creates tenant record** in master database:

```typescript
await masterDb.insert(tenants).values({
  id: uuidv4(),
  slug: 'newclient',
  name: 'New Client Oil & Gas',
  databaseUrl: 'postgresql://...', // Provided by client
  connectionType: 'AZURE_PRIVATE_LINK',
  region: 'azure-west-us',
  provider: 'AZURE',
  tier: 'PROFESSIONAL',
  status: 'ACTIVE',
});
```

4. **Run migrations on tenant database**:

```bash
pnpm --filter=api db:migrate --tenant=newclient
```

5. **Test connection**:

```bash
pnpm --filter=api db:test-connection --tenant=newclient
```

6. **Tenant is live** (subdomain automatically works via middleware)

---

## Related Patterns

- **Repository Pattern**: All data access goes through repositories with `tenantId` parameter
- **Unit of Work**: Manage transactions across tenant-scoped repositories
- **Connection Pooling**: Reuse database connections for performance
- **Middleware Pattern**: Extract tenant context from subdomain
- **Strategy Pattern**: Support multiple database providers (Azure, AWS, on-prem)

---

## When to Use This Pattern

### ✅ Use Database-Per-Tenant When:

- **Clients demand data sovereignty** (choose where data lives)
- **Compliance requires data isolation** (healthcare, finance, oil & gas)
- **Tenants have different scaling needs** (small vs. large operators)
- **You support hybrid cloud** (on-prem + cloud databases)
- **Psychological isolation matters** ("My data is NOT mixed with competitors")

### ❌ Don't Use Database-Per-Tenant When:

- **Tenants are small/similar** (row-level security is simpler)
- **You need cross-tenant reporting** (hard with separate databases)
- **You can't manage connection pooling complexity**
- **Database costs are prohibitive** (every tenant = separate database cost)

---

## Real-World Example: WellPulse

**Scenario**: ACME Oil & Gas (50 wells) wants to use WellPulse but requires their database to stay on-premises for security.

**Setup**:

```yaml
1. ACME provisions on-prem PostgreSQL:
   - Server: 192.168.50.10 (internal network)
   - Database: acmeoil_prod

2. ACME configures VPN to Azure:
   - Site-to-Site VPN between ACME office and Azure VPN Gateway

3. WellPulse creates tenant record:
   - Slug: acmeoil
   - Database URL: postgresql://...@192.168.50.10:5432/acmeoil_prod
   - Connection Type: ON_PREMISES_VPN

4. WellPulse runs migrations over VPN

5. ACME accesses: https://acmeoil.wellpulse.io
   - TenantIdentificationMiddleware extracts "acmeoil"
   - TenantDatabaseService connects to 192.168.50.10 via VPN
   - All data stays on ACME's premises
```

**Sales Advantage**: "Your data never leaves your building. We just connect to it securely."

---

## Summary

The **Database-Per-Tenant Multi-Tenancy Pattern** provides:

1. **Complete data isolation** (separate databases per tenant)
2. **Client data sovereignty** (tenants choose database location)
3. **Efficient connection pooling** (lazy-load, cache pools)
4. **Hybrid cloud support** (Azure, AWS, on-prem)
5. **Independent scaling** (small tenants share, large tenants get dedicated resources)

**Critical Implementation Points**:

- Store tenant metadata in master database
- Lazy-load connection pools (don't create upfront)
- Always require `tenantId` parameter in repositories
- Use middleware to extract tenant from subdomain
- Support multiple connection types (Private Link, VPN, SSL)

This pattern is essential for WellPulse because oil & gas operators demand control over their data and won't accept shared database architectures.

---

**Related Documentation**:

- [Azure Production Architecture](../deployment/azure-production-architecture.md)
- [Offline Batch Sync Pattern](./70-Offline-Batch-Sync-Pattern.md)
- [Conflict Resolution Pattern](./71-Conflict-Resolution-Pattern.md)
