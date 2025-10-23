# Sprint 1: Foundation - Master Database & Monorepo Scaffolding

**Duration**: 2 weeks (Week 1-2)
**Status**: 📋 Planning
**Goal**: Establish monorepo structure, master database, and tenant provisioning foundation

---

## Objectives

By the end of Sprint 1, we will have:

1. ✅ All 6 applications scaffolded in monorepo with proper TypeScript configurations
2. ✅ Master database implemented with tenant management
3. ✅ Tenant provisioning service (create new tenant databases on signup)
4. ✅ Subdomain routing middleware working
5. ✅ Docker Compose environment fully operational
6. ✅ Shared packages/libraries for common code
7. ✅ CI/CD pipeline configured for all apps

**Deliverable**: A working monorepo where you can create a tenant via API, and a dedicated PostgreSQL database is automatically provisioned for that tenant.

---

## Architecture Overview

### Monorepo Structure

```
wellpulse/
├── apps/
│   ├── api/                    # NestJS REST API (tenant-facing)
│   ├── web/                    # Next.js operator dashboard
│   ├── admin/                  # Next.js admin portal
│   ├── electron/               # Electron desktop app (offline)
│   ├── mobile/                 # React Native mobile app (Expo)
│   └── ml/                     # Python FastAPI ML service
├── packages/
│   ├── typescript-config/      # Shared TypeScript configs
│   ├── eslint-config/          # Shared ESLint configs
│   ├── ui/                     # Shared UI components (Shadcn)
│   └── database/               # Shared database types/schemas
├── docs/
│   ├── apps/                   # Feature specifications
│   ├── patterns/               # Software patterns
│   └── sprints/                # Sprint documentation
├── docker-compose.yml
├── turbo.json
└── package.json
```

### Database Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Master Database (PostgreSQL)               │
│  wellpulse_master                                       │
├─────────────────────────────────────────────────────────┤
│  Tables:                                                │
│  - tenants (id, slug, subdomain, database_url, etc.)   │
│  - admin_users (platform admins)                       │
│  - billing_subscriptions                               │
│  - usage_metrics                                        │
└─────────────────────────────────────────────────────────┘
             ↓ References tenant databases
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Tenant DB: acme  │  │ Tenant DB: permian│ │ Tenant DB: apex  │
│ acme_wellpulse   │  │ permian_wellpulse │ │ apex_wellpulse   │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ - users          │  │ - users          │  │ - users          │
│ - wells          │  │ - wells          │  │ - wells          │
│ - production     │  │ - production     │  │ - production     │
│ - equipment      │  │ - equipment      │  │ - equipment      │
│ - field_events   │  │ - field_events   │  │ - field_events   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Tasks

### 1. Monorepo Infrastructure (Week 1, Day 1-2)

#### 1.1 Scaffold NestJS API (`apps/api`)

```bash
cd apps
npx @nestjs/cli new api --package-manager pnpm --skip-git
```

**Structure:**

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── domain/                 # Business entities (empty for now)
│   ├── application/            # Use cases (empty for now)
│   ├── infrastructure/         # External services, DB
│   │   ├── database/
│   │   │   ├── master/         # Master DB connection
│   │   │   ├── tenant/         # Tenant DB connections
│   │   │   └── migrations/
│   │   └── config/
│   └── presentation/           # Controllers, guards
│       └── health/
│           └── health.controller.ts
├── drizzle.config.ts           # Drizzle ORM config
├── tsconfig.json
└── package.json
```

**Dependencies to install:**

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/swagger": "^7.0.0",
    "drizzle-orm": "^0.30.0",
    "postgres": "^3.4.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "helmet": "^7.0.0",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0",
    "@types/node": "^20.0.0"
  }
}
```

#### 1.2 Scaffold Next.js Web App (`apps/web`)

```bash
cd apps
pnpx create-next-app@latest web \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

**Structure:**

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   └── (dashboard)/
│       └── wells/
├── components/
│   └── ui/                     # Shadcn UI components
├── lib/
│   ├── api-client.ts
│   └── utils.ts
├── hooks/
├── public/
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**Additional dependencies:**

```bash
cd apps/web
pnpm add @tanstack/react-query zustand axios
pnpm add -D @types/node
```

#### 1.3 Scaffold Next.js Admin Portal (`apps/admin`)

Same as Web app but with admin-specific pages:

```bash
cd apps
pnpx create-next-app@latest admin \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

**Key pages:**

```
apps/admin/
├── app/
│   ├── (auth)/
│   │   └── login/
│   └── (dashboard)/
│       ├── tenants/            # Tenant management
│       ├── billing/            # Billing & subscriptions
│       ├── analytics/          # Platform analytics
│       └── support/            # Support tickets
```

#### 1.4 Scaffold Electron App (`apps/electron`)

```bash
cd apps
mkdir electron
cd electron
pnpm init
```

**Install Electron + React:**

```bash
pnpm add electron electron-builder react react-dom
pnpm add -D @types/react @types/react-dom @types/node \
  typescript vite @vitejs/plugin-react electron-vite
```

**Structure:**

```
apps/electron/
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts
│   │   └── database.ts         # SQLite connection
│   ├── renderer/               # React frontend
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── preload/
│       └── index.ts
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
└── package.json
```

#### 1.5 Scaffold React Native App (`apps/mobile`)

```bash
cd apps
pnpx create-expo-app@latest mobile --template blank-typescript
cd mobile
```

**Install dependencies:**

```bash
pnpm add expo-router expo-sqlite expo-location expo-camera
pnpm add @tanstack/react-query zustand axios
```

**Structure:**

```
apps/mobile/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx           # Home
│   │   ├── wells.tsx           # Wells list
│   │   └── sync.tsx            # Sync management
│   └── _layout.tsx
├── components/
├── hooks/
├── lib/
├── app.json
└── package.json
```

#### 1.6 Scaffold Python ML Service (`apps/ml`)

```bash
cd apps
mkdir ml
cd ml
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

**Create requirements.txt:**

```txt
fastapi==0.104.0
uvicorn[standard]==0.24.0
pydantic==2.5.0
scikit-learn==1.3.2
pandas==2.1.3
numpy==1.26.2
python-dotenv==1.0.0
```

**Install:**

```bash
pip install -r requirements.txt
```

**Structure:**

```
apps/ml/
├── src/
│   ├── main.py                 # FastAPI app
│   ├── models/                 # ML models
│   ├── routes/
│   │   ├── predict.py
│   │   └── health.py
│   └── utils/
├── requirements.txt
├── Dockerfile
└── .env.example
```

**main.py:**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WellPulse ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # API server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ml"}

@app.get("/")
async def root():
    return {"message": "WellPulse ML Service"}
```

---

### 2. Shared Packages (Week 1, Day 2-3)

#### 2.1 Create `packages/typescript-config`

```bash
mkdir -p packages/typescript-config
cd packages/typescript-config
pnpm init
```

**tsconfig.base.json:**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Base",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false
  }
}
```

#### 2.2 Create `packages/eslint-config`

```bash
mkdir -p packages/eslint-config
cd packages/eslint-config
pnpm init
```

**package.json:**

```json
{
  "name": "@wellpulse/eslint-config",
  "version": "0.0.0",
  "main": "index.js",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-import": "^2.29.0"
  }
}
```

#### 2.3 Create `packages/database`

Shared database types and utilities:

```bash
mkdir -p packages/database
cd packages/database
pnpm init
```

**package.json:**

```json
{
  "name": "@wellpulse/database",
  "version": "0.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "drizzle-orm": "^0.30.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**src/types.ts:**

```typescript
export interface Tenant {
  id: string;
  slug: string;
  subdomain: string;
  name: string;
  databaseUrl: string;
  databaseType: 'POSTGRESQL' | 'SQL_SERVER' | 'MYSQL' | 'ORACLE' | 'ETL_SYNCED';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  createdAt: Date;
}
```

---

### 3. Master Database Schema (Week 1, Day 3-4)

#### 3.1 Create Master Database Schema

**apps/api/src/infrastructure/database/schema/master/tenants.schema.ts:**

```typescript
import { pgTable, varchar, uuid, timestamp, jsonb, text } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(), // URL-friendly: "acme", "permian-ops"
  subdomain: varchar('subdomain', { length: 100 }).notNull().unique(), // acme.wellpulse.app
  name: varchar('name', { length: 255 }).notNull(), // "ACME Oil & Gas"

  // Database configuration
  databaseType: varchar('database_type', { length: 50 }).notNull().default('POSTGRESQL'),
  databaseUrl: text('database_url').notNull(), // Connection string
  databaseName: varchar('database_name', { length: 100 }).notNull(), // acme_wellpulse

  // Billing
  subscriptionTier: varchar('subscription_tier', { length: 50 }).notNull().default('STARTER'),
  // "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "ENTERPRISE_PLUS"
  maxWells: integer('max_wells').default(100), // Enforce well limits

  // Status
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  // "ACTIVE" | "SUSPENDED" | "TRIAL" | "DELETED"

  // ETL configuration (for Tier 3 clients)
  etlConfig: jsonb('etl_config'), // Schema mapping, sync interval, etc.

  // Contact info
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),

  // Metadata
  metadata: jsonb('metadata'), // Custom fields

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('ADMIN'),
  // "SUPER_ADMIN" | "ADMIN" | "SUPPORT"

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
});

export const billingSubscriptions = pgTable('billing_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),

  tier: varchar('tier', { length: 50 }).notNull(), // "STARTER", "PROFESSIONAL", etc.
  pricePerMonth: integer('price_per_month').notNull(), // Cents (9900 = $99)

  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  // "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING"

  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),

  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usageMetrics = pgTable('usage_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),

  date: date('date').notNull(), // Daily metrics

  wellCount: integer('well_count').notNull().default(0),
  productionRecords: integer('production_records').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),
  apiRequests: integer('api_requests').notNull().default(0),
  storageUsedMb: integer('storage_used_mb').notNull().default(0),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### 3.2 Create Drizzle Configuration

**apps/api/drizzle.config.ts:**

```typescript
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/infrastructure/database/schema/master/*.schema.ts',
  out: './src/infrastructure/database/migrations/master',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.MASTER_DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

#### 3.3 Generate and Apply Migrations

```bash
cd apps/api

# Generate migration
pnpm drizzle-kit generate:pg

# Apply migration
pnpm drizzle-kit push:pg
```

---

### 4. Tenant Provisioning Service (Week 1, Day 4-5)

**apps/api/src/infrastructure/database/services/tenant-provisioning.service.ts:**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { tenants } from '../schema/master/tenants.schema';

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);
  private readonly masterDb;

  constructor(private readonly configService: ConfigService) {
    const masterDbUrl = this.configService.get<string>('MASTER_DATABASE_URL')!;
    const client = postgres(masterDbUrl);
    this.masterDb = drizzle(client);
  }

  /**
   * Provision a new tenant database
   *
   * Steps:
   * 1. Generate tenant slug and database name
   * 2. Create PostgreSQL database
   * 3. Run tenant schema migrations
   * 4. Insert tenant record in master DB
   * 5. Return tenant credentials
   */
  async provisionTenant(params: {
    name: string;
    contactEmail: string;
    subscriptionTier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'ENTERPRISE_PLUS';
  }): Promise<{ tenantId: string; subdomain: string; databaseUrl: string }> {
    const slug = this.generateSlug(params.name);
    const subdomain = `${slug}.wellpulse.app`;
    const databaseName = `${slug}_wellpulse`;

    this.logger.log(`Provisioning tenant: ${slug}`);

    try {
      // Step 1: Create PostgreSQL database
      await this.createTenantDatabase(databaseName);

      // Step 2: Run tenant schema migrations
      const databaseUrl = this.getTenantDatabaseUrl(databaseName);
      await this.runTenantMigrations(databaseUrl);

      // Step 3: Insert tenant record
      const [tenant] = await this.masterDb
        .insert(tenants)
        .values({
          slug,
          subdomain,
          name: params.name,
          databaseType: 'POSTGRESQL',
          databaseUrl,
          databaseName,
          subscriptionTier: params.subscriptionTier,
          contactEmail: params.contactEmail,
          status: 'ACTIVE',
          maxWells: this.getMaxWellsForTier(params.subscriptionTier),
        })
        .returning();

      this.logger.log(`Tenant provisioned successfully: ${tenant.id}`);

      return {
        tenantId: tenant.id,
        subdomain: tenant.subdomain,
        databaseUrl: tenant.databaseUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to provision tenant: ${slug}`, error);
      throw error;
    }
  }

  /**
   * Create a new PostgreSQL database
   */
  private async createTenantDatabase(databaseName: string): Promise<void> {
    const adminDbUrl = this.configService.get<string>('POSTGRES_ADMIN_URL')!;
    const adminClient = postgres(adminDbUrl);

    try {
      // Create database (requires admin privileges)
      await adminClient.unsafe(`CREATE DATABASE ${databaseName}`);
      this.logger.log(`Database created: ${databaseName}`);
    } catch (error: any) {
      if (error.code === '42P04') {
        // Database already exists
        this.logger.warn(`Database already exists: ${databaseName}`);
      } else {
        throw error;
      }
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Run tenant schema migrations on new database
   */
  private async runTenantMigrations(databaseUrl: string): Promise<void> {
    const tenantClient = postgres(databaseUrl);
    const tenantDb = drizzle(tenantClient);

    try {
      // Run migrations (will implement in Sprint 3)
      // For now, just verify connection
      await tenantClient`SELECT 1`;
      this.logger.log('Tenant database connection verified');
    } finally {
      await tenantClient.end();
    }
  }

  /**
   * Generate URL-friendly slug from tenant name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Construct tenant database URL
   */
  private getTenantDatabaseUrl(databaseName: string): string {
    const host = this.configService.get<string>('POSTGRES_HOST', 'localhost');
    const port = this.configService.get<number>('POSTGRES_PORT', 5432);
    const user = this.configService.get<string>('POSTGRES_USER', 'postgres');
    const password = this.configService.get<string>('POSTGRES_PASSWORD');

    return `postgresql://${user}:${password}@${host}:${port}/${databaseName}`;
  }

  /**
   * Get max wells based on subscription tier
   */
  private getMaxWellsForTier(tier: string): number {
    const limits = {
      STARTER: 100,
      PROFESSIONAL: 500,
      ENTERPRISE: 2000,
      ENTERPRISE_PLUS: 999999,
    };
    return limits[tier] || 100;
  }
}
```

---

### 5. Subdomain Routing Middleware (Week 2, Day 1)

**apps/api/src/presentation/middleware/tenant-context.middleware.ts:**

```typescript
import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '@/infrastructure/database/services/tenant.service';

// Extend Express Request to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantSlug?: string;
    }
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extract subdomain from Host header
    const host = req.headers.host || '';
    const subdomain = this.extractSubdomain(host);

    if (!subdomain) {
      // No subdomain = main website or admin portal
      return next();
    }

    // Look up tenant by subdomain
    const tenant = await this.tenantService.findBySubdomain(`${subdomain}.wellpulse.app`);

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${subdomain}`);
    }

    if (tenant.status !== 'ACTIVE') {
      throw new NotFoundException(`Tenant is not active: ${subdomain}`);
    }

    // Attach tenant context to request
    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;

    next();
  }

  /**
   * Extract subdomain from host
   * Examples:
   *   acme.wellpulse.app -> acme
   *   localhost:3001 -> null
   *   wellpulse.app -> null
   */
  private extractSubdomain(host: string): string | null {
    const parts = host.split('.');

    // localhost or IP address
    if (parts.length < 3) {
      return null;
    }

    // acme.wellpulse.app -> acme
    // acme.localhost:3001 -> acme (for local dev)
    const subdomain = parts[0];

    // Ignore www
    if (subdomain === 'www') {
      return null;
    }

    return subdomain;
  }
}
```

**Apply middleware in app.module.ts:**

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TenantContextMiddleware } from './presentation/middleware/tenant-context.middleware';

@Module({
  // ... modules
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
```

---

### 6. Docker Compose Environment (Week 2, Day 1-2)

**docker-compose.yml:**

```yaml
version: '3.9'

services:
  # PostgreSQL (Master + Tenant databases)
  postgres:
    image: postgres:16-alpine
    container_name: wellpulse-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: wellpulse_master
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis (Caching)
  redis:
    image: redis:7-alpine
    container_name: wellpulse-redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  # Mailpit (Email testing)
  mailpit:
    image: axllent/mailpit:latest
    container_name: wellpulse-mailpit
    ports:
      - '1025:1025' # SMTP
      - '8025:8025' # Web UI
    environment:
      MP_MAX_MESSAGES: 5000
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

  # Azurite (Azure Blob Storage Emulator)
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite:latest
    container_name: wellpulse-azurite
    command: azurite-blob --blobHost 0.0.0.0 --blobPort 10000
    ports:
      - '10000:10000' # Blob service
    volumes:
      - azurite_data:/data
    environment:
      AZURITE_ACCOUNTS: devstoreaccount1:Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
    healthcheck:
      test: ['CMD', 'nc', '-z', 'localhost', '10000']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  azurite_data:
```

**Start services:**

```bash
docker compose up -d
```

---

### 7. Environment Configuration (Week 2, Day 2)

**apps/api/.env.example:**

```bash
# Server
NODE_ENV=development
PORT=3001

# Master Database
MASTER_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wellpulse_master

# PostgreSQL Admin (for creating tenant databases)
POSTGRES_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Email (Mailpit for dev)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@wellpulse.app

# Azure Blob Storage (Azurite emulator for local dev)
AZURE_STORAGE_ACCOUNT_NAME=devstoreaccount1
AZURE_STORAGE_ACCOUNT_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;

# Feature Flags
ENABLE_REGISTRATION=true
ENABLE_ETL_SYNC=false  # Enable in Sprint 10+
```

**apps/web/.env.local.example:**

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Feature Flags
NEXT_PUBLIC_ENABLE_MAPS=true
NEXT_PUBLIC_ENABLE_ML_PREDICTIONS=false

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

---

### 8. Update Turbo Configuration (Week 2, Day 2)

**turbo.json:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**"],
      "dependsOn": []
    },
    "format": {
      "outputs": [],
      "cache": false
    }
  }
}
```

---

### 9. CI/CD Pipeline (Week 2, Day 3)

**.github/workflows/ci.yml:**

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: wellpulse_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Run tests
        run: pnpm test
        env:
          MASTER_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wellpulse_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379

      - name: Build
        run: pnpm build
```

---

## Testing Strategy

### Sprint 1 Tests

**apps/api/src/infrastructure/database/services/tenant-provisioning.service.spec.ts:**

```typescript
describe('TenantProvisioningService', () => {
  let service: TenantProvisioningService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TenantProvisioningService, ConfigService],
    }).compile();

    service = module.get<TenantProvisioningService>(TenantProvisioningService);
  });

  describe('provisionTenant', () => {
    it('should create a new tenant database and record', async () => {
      const result = await service.provisionTenant({
        name: 'ACME Oil & Gas',
        contactEmail: 'admin@acme.com',
        subscriptionTier: 'STARTER',
      });

      expect(result).toHaveProperty('tenantId');
      expect(result).toHaveProperty('subdomain');
      expect(result.subdomain).toMatch(/acme-oil-gas\.wellpulse\.app/);
    });

    it('should generate correct slug from tenant name', async () => {
      // Test slug generation
      const slug = service['generateSlug']('ACME Oil & Gas LLC');
      expect(slug).toBe('acme-oil-gas-llc');
    });
  });
});
```

**Manual Testing:**

```bash
# Start services
docker compose up -d
cd apps/api

# Apply master migrations
pnpm drizzle-kit push:pg

# Start API
pnpm dev

# Test tenant provisioning (via API or service directly)
curl -X POST http://localhost:3001/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ACME Oil & Gas",
    "contactEmail": "admin@acme.com",
    "subscriptionTier": "STARTER"
  }'

# Verify tenant database was created
psql -U postgres -h localhost -c '\l' | grep wellpulse

# Should see:
# wellpulse_master
# acme-oil-gas_wellpulse
```

---

## Success Criteria

Sprint 1 is complete when:

- [ ] All 6 applications scaffolded and runnable (`pnpm dev` works)
- [ ] Master database created with tenants table
- [ ] Tenant provisioning service creates new databases automatically
- [ ] Subdomain routing middleware extracts tenant context from requests
- [ ] Docker Compose environment runs all services (PostgreSQL, Redis, Mailpit, Azurite)
- [ ] Shared packages (`typescript-config`, `eslint-config`, `database`) usable across apps
- [ ] CI/CD pipeline runs lint, type-check, and tests on push
- [ ] Manual test: Create tenant via API → verify tenant database exists

---

## Blockers & Risks

| Risk                                          | Mitigation                                            |
| --------------------------------------------- | ----------------------------------------------------- |
| PostgreSQL permissions for creating databases | Use admin connection string with superuser privileges |
| Subdomain routing in local dev                | Use `/etc/hosts` entries: `127.0.0.1 acme.localhost`  |
| Monorepo complexity                           | Keep turbo.json simple, add tasks incrementally       |
| Missing Python dependencies for ML service    | Docker container will handle Python environment       |

---

## Next Sprint Preview

**Sprint 2: Authentication (Week 3-4)**

Once Sprint 1 is complete, Sprint 2 will implement:

- User registration with email verification
- Login/logout with JWT (httpOnly cookies)
- Refresh token rotation
- Password reset flow
- RBAC (Admin, Manager, Operator roles)
- First tenant user creation during signup

This will enable actual users to sign up for WellPulse and access their tenant dashboard.

---

**Sprint 1 starts now! 🚀**
