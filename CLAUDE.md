# Claude Development Guide

**Version**: 6.0
**Last Updated**: October 23, 2025

Essential context for developing WellPulse - an Oil & Gas Field Data Management Platform for the Permian Basin.

---

## Platform Overview

WellPulse provides independent oil & gas operators with:

- **Production Data Consolidation**: Replace Excel spreadsheets with real-time dashboards
- **Predictive Maintenance**: ML-powered equipment failure prediction
- **ESG Compliance**: Automated emissions tracking and regulatory reporting
- **Offline Field Data Entry**: Electron (laptops) and React Native (mobile) apps for remote well sites

**Target Market**: Small/medium independent operators (50-500 wells, $10M-$100M revenue) in the Permian Basin

---

## Tech Stack

**Monorepo** (Turborepo + pnpm):

- `apps/api` - NestJS (REST API, Hexagonal Architecture) - **Main tenant-facing API**
- `apps/web` - Next.js 15 (App Router, React 19) - **Client dashboard** for operators (map interface, production data)
- `apps/admin` - Next.js 15 (App Router, React 19, API Routes) - **Internal admin portal** for WellPulse staff (tenant provisioning, database management)
- `apps/electron` - Electron + React - Offline field data entry on laptops
- `apps/mobile` - React Native + Expo - Mobile field data entry (iOS/Android)
- `services/ml` - Python FastAPI - ML models for predictive maintenance & production optimization

**Backend**: NestJS, Drizzle ORM, PostgreSQL (per-tenant), Passport/JWT, Nodemailer, Bull/BullMQ
**Frontend**: Next.js 15, React 19, Tailwind CSS 4, Shadcn UI, React Query, Zustand
**ML Stack**: Python, FastAPI, scikit-learn, pandas, numpy
**File Storage**: Azure Blob (default) / AWS S3 (client choice via Strategy Pattern)
**Deployment**:

- **Production**: Azure (Container Apps, PostgreSQL, Redis, Blob Storage, Service Bus)
- **Staging/PR Previews**: Railway (ephemeral environments for testing)
- **Client Databases**: Anywhere (Azure, AWS, on-premises, hybrid) - API connects via secure connection

**Ports**:

- API (Tenant-facing): `http://localhost:4000`
- Web (Client Dashboard): `http://localhost:3000`
- Admin (Internal Portal): `http://localhost:4002`
- ML Service: `http://localhost:8000`
- Mailpit: `http://localhost:8025`
- Redis: `localhost:6379`
- PostgreSQL (Master DB): `localhost:5432`

---

## Architecture

### Multi-Tenancy: Subdomain-Per-Tenant (Database-Per-Tenant)

Each operator gets their own subdomain (`acmeoil.wellpulse.io`) and dedicated database. **Clients choose where their data lives AND what database technology to use** - WellPulse API connects securely regardless of location or database type:

```
Tenant Routing (Subdomain → Database)
├── Master Database (Azure): Tenant registry, user authentication, metadata
└── Tenant Databases (Client Choice - Any Database):
    │
    ├── Tier 1: Native PostgreSQL (Default - 80% of clients)
    │   ├── Azure PostgreSQL Flexible Server (WellPulse-managed or client-managed)
    │   ├── AWS RDS PostgreSQL (if client prefers AWS)
    │   └── On-premises PostgreSQL (VPN or private connectivity)
    │
    ├── Tier 2: Adapter Layer (Enterprise - 15% of clients)
    │   ├── Microsoft SQL Server (native adapter)
    │   ├── MySQL (native adapter)
    │   └── Oracle (native adapter)
    │
    └── Tier 3: ETL Sync (Enterprise Plus - 5% of clients)
        ├── Any database technology (read-only sync to PostgreSQL)
        ├── SCADA systems (Emerson, Schneider, Rockwell)
        ├── Production accounting (PHDWin, OGsys, Quorum)
        └── ERP systems (SAP, Oracle, Microsoft Dynamics)
```

**Key Architecture Decision**: WellPulse API/Web hosted on Azure (single deployment), but **tenant databases can be anywhere** the client wants. The API establishes secure connections via:

- Azure Private Link (Azure-to-Azure)
- VPN Gateway (Azure-to-on-premises)
- Public endpoint with SSL + IP whitelisting (as fallback)

**Key Patterns**:

- `TenantDatabaseService` manages connection pools per tenant
- Repository Factory selects correct adapter based on tenant's database type
- ETL Sync for external system integration (SCADA, ERP, etc.)
- See [Database-Per-Tenant Pattern](./docs/patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md) and [Database-Agnostic Pattern](./docs/patterns/72-Database-Agnostic-Multi-Tenant-Pattern.md)

### Backend: Hexagonal (4 Layers)

Dependencies point inward: Presentation → Application → Domain ← Infrastructure

```
Presentation (Controllers, DTOs, Guards, Tenant Middleware)
     ↓
Application (Commands, Queries, Use Cases)
     ↓
Domain (Entities, Value Objects, Business Rules)
     ↑
Infrastructure (Tenant Repositories, DB Connection Pooling, External APIs)
```

**Rule**: Domain layer has NO dependencies on infrastructure.

### Frontend: Layered (Shared across Web/Electron/Mobile)

```
UI (Components, Pages)
  ↓
State (React Query, Zustand, Offline Sync State)
  ↓
Business Logic (Commands, Queries, Conflict Resolution)
  ↓
Data Access (Repositories, API Client, Local SQLite/AsyncStorage)
```

### Offline-First Architecture (Electron/Mobile Apps)

```
Field Device (Offline)           Cloud API (When Online)
├── SQLite/AsyncStorage      →   Batch Sync Endpoint
├── Event Log (append-only)  →   Conflict Resolution
├── Queue (pending changes)  →   PostgreSQL Persistence
└── Auto-sync when online    →   Dashboard Real-time Update
```

**Sync Strategy**: Batch sync at end of shift (not real-time). See [Offline Batch Sync Pattern](./docs/patterns/XX-Offline-Batch-Sync-Pattern.md).

---

## Pattern Selection (Oil & Gas Domain)

Every feature MUST follow patterns from `docs/patterns/`. See [Pattern Integration Guide](./docs/patterns/16-Pattern-Integration-Guide.md).

**Basic CRUD (Wells, Equipment, Operators)?** → Repository + DTO + Basic CQRS
**Complex business rules (Production calculations, Safety checks)?** → DDD (Entities, Value Objects, Aggregates) + Specification
**External integrations (SCADA systems, Legacy databases)?** → Anti-Corruption Layer + Adapter + Circuit Breaker
**Offline field data entry?** → Event Sourcing + SAGA + Local-First State Management
**File uploads (Equipment photos, Leak reports)?** → Strategy Pattern (Azure/AWS pluggable storage)
**ML predictions (Predictive maintenance, Anomaly detection)?** → Background Jobs + Observer Pattern
**Time-series data (Production volumes, Sensor readings)?** → Specialized time-series patterns
**Complex validation (ESG compliance rules, State regulations)?** → Chain of Responsibility + Specification

---

## Development Workflow

### Quality Checks - MANDATORY

Run before completing ANY feature:

```bash
pnpm format      # Prettier
pnpm lint        # ESLint (0 errors)
pnpm type-check  # TypeScript (must pass)
pnpm test        # ≥80% coverage required
pnpm build       # Must succeed
```

**Or use the `/quality` command** to run all checks automatically.

### Feature Implementation Order

**Backend**: Domain → Repository Interfaces → Application → Infrastructure → Presentation → Tests → Quality Checks

**Frontend**: Types → Data Access → Business Logic → Hooks → Components → Pages → Tests → Quality Checks

---

## Essential Commands

```bash
# Development
pnpm dev                          # All apps
pnpm --filter=api dev             # Backend only
pnpm --filter=web dev             # Frontend only

# Database (Migration-Based Schema Management)
pnpm --filter=api db:generate:master   # Generate master DB migration
pnpm --filter=api db:generate:tenant   # Generate tenant DB migration
pnpm --filter=api db:migrate:master    # Apply master DB migrations
pnpm --filter=api db:migrate:tenant    # Apply tenant DB migrations
pnpm --filter=api db:migrate:all       # Apply all migrations (master + tenant)
pnpm --filter=api db:studio            # Drizzle Studio

# Testing
pnpm test                         # All tests
pnpm --filter=api test:cov        # Backend coverage
pnpm --filter=web test:coverage   # Frontend coverage

# Quality
pnpm lint
pnpm format
pnpm type-check
pnpm build
```

---

## New Entity Checklist (Tenant-Scoped)

**Note**: Most entities are tenant-scoped (Wells, Equipment, FieldData). Follow this checklist:

1. Domain entity: `apps/api/src/domain/{entity}/` with tenant validation
2. Repository interface: `apps/api/src/domain/repositories/` with `tenantId` parameter
3. Drizzle schema: `apps/api/src/infrastructure/database/schema/` in **tenant database**
4. Generate & apply migration: `pnpm --filter=api db:generate:tenant` → `pnpm --filter=api db:migrate:tenant`
5. Repository implementation: `apps/api/src/infrastructure/database/repositories/` using `TenantDatabaseService`
6. Command/Query handlers: `apps/api/src/application/{entity}/` with tenant context
7. Controller: `apps/api/src/presentation/{entity}/` with `@TenantContext()` decorator
8. Frontend repository: `apps/web/lib/repositories/` (Web dashboard)
9. React Query hooks: `apps/web/hooks/`
10. Components: `apps/web/components/{entity}/`
11. Offline support (if needed):
    - Electron local schema: `apps/electron/src/db/schema/`
    - Mobile local schema: `apps/mobile/src/db/schema/`
    - Sync handler: `apps/api/src/application/sync/`

---

## Key Documentation

**Patterns** (73+ software development patterns in `docs/patterns/`):

- **[Pattern Catalog](./docs/patterns/README.md)** - Full pattern index
- **[Pattern Integration Guide](./docs/patterns/16-Pattern-Integration-Guide.md)** - How to choose patterns
- **[Database-Per-Tenant Multi-Tenancy Pattern](./docs/patterns/XX-Database-Per-Tenant-Multi-Tenancy-Pattern.md)** 🆕 - Subdomain routing + connection pooling
- **[Migration-Based Schema Management Pattern](./docs/patterns/73-Migration-Based-Schema-Management-Pattern.md)** 🆕 - Safe, version-controlled database migrations
- **[Offline Batch Sync Pattern](./docs/patterns/XX-Offline-Batch-Sync-Pattern.md)** 🆕 - Field data entry sync strategy
- **[Conflict Resolution Pattern](./docs/patterns/XX-Conflict-Resolution-Pattern.md)** 🆕 - Resolving offline data conflicts
- **[Value Object Layer Boundary Pattern](./docs/patterns/61-Value-Object-Layer-Boundary-Pattern.md)** - Accessing value objects across layers

**Market Research**:

- **[Permian Basin Market Research](./docs/research/01-permian-basin-market-research.md)** 🎯 - Target market analysis, pain points, competitive landscape
- **[Architecture Feedback](./docs/research/02-architecture-feedback.md)** 🏗️ - Complete architectural decisions and implementation guidance

**Guides**:

- **[Security Best Practices](./docs/guides/security-best-practices.md)** - Comprehensive security guide
- **[API Rate Limiting](./docs/guides/api-rate-limiting.md)** - Multi-tier throttling documentation
- **[Database Migrations](./docs/guides/database-migrations.md)** 🆕 - Migration workflow, patterns, troubleshooting

**Claude Code Commands** (available via `/` prefix):

- Quality checks, feature implementation, PR creation, code review, debugging, testing
- See `.claude/commands/` for 15+ available slash commands

---

## Key Principles

**Architecture**: Dependencies inward, pattern-driven, separation of concerns, SOLID, database-per-tenant isolation
**Quality**: Type safety, ≥80% test coverage, immutability, proper error handling
**Security**: Multi-tier rate limiting, JWT (httpOnly cookies for web), RBAC, input validation, audit logging, soft delete
**Performance**: React Query caching, connection pooling per tenant, prevent N+1, proper indexing for time-series queries
**Offline-First**: Event sourcing for local changes, batch sync at end of shift, conflict resolution with safety bias

**Multi-Tenancy**: Every query must include tenant context:

```typescript
// ✅ Good: Tenant-scoped query
const well = await wellRepo.findById(tenantId, wellId);

// ❌ Bad: No tenant isolation
const well = await wellRepo.findById(wellId);
```

**Value Objects**: Always extract primitives when crossing layer boundaries:

- Domain entities: `well.location.latitude` (extract from value object)
- DTOs/Responses: `well.location` (already a primitive object)

---

## Anti-Patterns

❌ Business logic in controllers → ✅ Business logic in domain
❌ Direct DB in domain → ✅ Repository pattern
❌ Mixing layers → ✅ Respect boundaries
❌ Using `any` → ✅ Proper types
❌ Hard delete → ✅ Soft delete (deletedAt)
❌ localStorage tokens → ✅ httpOnly cookies
