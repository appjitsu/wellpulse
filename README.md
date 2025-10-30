# WellPulse

**Oil & Gas Field Data Management Platform for the Permian Basin**

A comprehensive SaaS platform for small to mid-sized oil & gas operators to manage well operations, production data, equipment maintenance, and ESG compliance with offline-first field data entry.

---

## Overview

WellPulse provides operators with real-time visibility into their field operations through a modern, multi-platform solution:

- **📊 Interactive Map Interface** - Visualize wells, production, and equipment on maps
- **⚡ Offline Field Data Entry** - Desktop (Electron) and mobile (iOS/Android) apps for operators without internet
- **🤖 ML-Powered Predictions** - Equipment failure prediction, production optimization, anomaly detection
- **🌱 ESG Compliance** - Automated emissions tracking and regulatory reporting
- **🔗 Database-Agnostic** - Works with PostgreSQL (default), SQL Server, MySQL, Oracle, or any database via ETL
- **🏢 Multi-Tenant SaaS** - Database-per-tenant with subdomain routing (acme.wellpulse.app)

**Target Market**: Permian Basin operators with 10-500 wells looking to modernize field operations

---

## Key Features

### 🎯 Core Capabilities

**Well Management**

- Well registry with API numbers, GPS coordinates, status tracking
- Interactive map visualization with heat maps and clustering
- Lease/field grouping and hierarchy
- Custom well attributes and metadata

**Production Data Tracking**

- Daily oil, gas, water production entry (offline-capable)
- Production charts and trend analysis
- Automatic decline curve analysis
- Variance detection and alerts

**Equipment Maintenance**

- Equipment inventory (pump jacks, tanks, separators, compressors)
- Maintenance logging with photos and timestamps
- Predictive maintenance (ML-based failure prediction)
- Parts inventory tracking

**Offline Field Data Entry**

- **Electron Desktop App**: Rugged laptops for field operators
- **React Native Mobile Apps**: iOS/Android with GPS tagging
- Event sourcing pattern for 100% offline capability
- Automatic sync when connectivity restored
- Conflict resolution for multi-device scenarios

**ESG & Compliance**

- Automated emissions calculations (flaring, venting, methane)
- Regulatory reporting (Texas RRC, New Mexico OCD)
- Carbon intensity tracking
- EPA compliance dashboards

**ML & Analytics**

- Equipment failure prediction (7-30 day warnings)
- Production optimization recommendations
- Anomaly detection (leaks, unusual patterns)
- Customizable analytics dashboards

---

## Applications

WellPulse is a **monorepo** with 6 applications:

### 1. **API** (`apps/api`) - NestJS

Tenant-facing REST API with hexagonal architecture

- Multi-tenant with database-per-tenant pattern
- Supports PostgreSQL, SQL Server, MySQL, Oracle
- ETL sync for external systems (SCADA, ERP, production accounting)
- Event sourcing for offline sync
- Background jobs (overdue invoices, ETL sync)

### 2. **Web** (`apps/web`) - Next.js 15

Operator dashboard with map interface

- Interactive well maps (Mapbox/Leaflet)
- Production charts and analytics
- Equipment monitoring and alerts
- ESG compliance dashboards
- Mobile-responsive design

### 3. **Admin Portal** (`apps/admin`) - Next.js 15

SaaS platform administration

- Tenant management (create, suspend, delete)
- Billing and subscription management
- Usage analytics across all tenants
- System health monitoring
- Support ticket management

### 4. **Electron App** (`apps/electron`) - Electron + React

Offline-first desktop app for field operators

- Rugged laptop deployment (glove-friendly UI)
- 100% offline operation with local SQLite
- Photo capture via laptop webcam
- Batch sync when internet available
- Large touch targets for field conditions

### 5. **Mobile App** (`apps/mobile`) - React Native (Expo)

iOS/Android app for field operators

- Native GPS integration (auto-location tagging)
- Superior camera quality (vs laptop webcams)
- QR/barcode scanning for equipment identification
- Voice-to-text for notes
- Push notifications for alerts
- Biometric authentication (Face ID, Touch ID)

### 6. **ML Service** (`apps/ml`) - Python FastAPI

Internal microservice for machine learning

- Predictive maintenance models
- Production optimization algorithms
- Anomaly detection
- Decline curve analysis
- Emissions prediction

---

## Multi-Tenancy Architecture

### Database-Per-Tenant with Database Flexibility

Each operator (tenant) gets:

- **Dedicated subdomain**: `demo.wellpulse.app`, `permianops.wellpulse.app`
- **Dedicated database**: Isolated data, custom schema, compliance
- **Choice of database technology**: PostgreSQL (default), SQL Server, MySQL, Oracle, or any database via ETL

### Three-Tier Database Strategy

**Tier 1 (80% of clients): Native PostgreSQL**

- WellPulse-managed (Azure/AWS) or client-managed
- Simplest, fastest, most cost-effective
- Full feature support (ML, real-time sync)

**Tier 2 (15% of clients): Adapter Layer**

- Direct native adapters for SQL Server, MySQL, Oracle
- Real-time performance, no data duplication
- Enterprise tier feature

**Tier 3 (5% of clients): ETL Sync**

- Sync from **any database** to WellPulse PostgreSQL
- Integration with external systems (SCADA, ERP, production accounting)
- Read-only sync with schema mapping
- Enterprise Plus tier feature

**See**: [Pattern 72: Database-Agnostic Multi-Tenant Pattern](docs/patterns/72-Database-Agnostic-Multi-Tenant-Pattern.md)

---

## Tech Stack

### Backend

- **Framework**: NestJS 10+ (TypeScript)
- **Architecture**: Hexagonal (Domain, Application, Infrastructure, Presentation)
- **Database**: Drizzle ORM with PostgreSQL 16 (default)
- **Multi-Database**: SQL Server (mssql), MySQL (mysql2), Oracle (oracledb)
- **Cache**: Redis 7
- **Queue**: Bull/BullMQ (background jobs, ETL sync)
- **Auth**: Passport.js, JWT with httpOnly cookies
- **Email**: Nodemailer (Mailpit dev, Resend prod)

### Frontend (Web + Admin)

- **Framework**: Next.js 15 (App Router, React 19, Turbopack)
- **UI**: Tailwind CSS 4, Shadcn UI, Radix UI
- **State**: React Query, Zustand
- **Maps**: Mapbox GL JS / Leaflet
- **Charts**: Recharts

### Desktop (Electron)

- **Framework**: Electron 28+, React 19
- **Local DB**: SQLite (better-sqlite3)
- **Offline Sync**: Event sourcing pattern

### Mobile (React Native)

- **Framework**: Expo SDK 50+, React Native
- **Local DB**: AsyncStorage + expo-sqlite
- **GPS**: expo-location
- **Camera**: expo-camera
- **Biometrics**: expo-local-authentication

### ML Service (Python)

- **Framework**: FastAPI
- **ML**: scikit-learn, TensorFlow/PyTorch
- **Data**: pandas, numpy, scipy
- **Deployment**: Azure Container Apps

### DevOps

- **Monorepo**: Turborepo with pnpm workspaces
- **CI/CD**: GitHub Actions
- **Deployment**: Azure Container Apps (production), Railway (staging)
- **Docker**: Multi-stage builds, Docker Compose for local dev
- **Testing**: Jest, Testing Library, Playwright (E2E)
- **Quality**: ESLint, Prettier, TypeScript strict mode

---

## Project Status

**🔄 Sprint 3-C: Complete Demo-Ready MVP (In Progress)**

### ✅ Completed Sprints

**Sprint 1: Foundation** (Weeks 1-2)

- ✅ Monorepo infrastructure (Turborepo, pnpm, Docker Compose)
- ✅ All 6 applications scaffolded (API, Web, Admin, Electron, Mobile, ML)
- ✅ Master database schema (tenants, admin_users, billing, usage, audit)
- ✅ Tenant provisioning service
- ✅ Subdomain routing middleware
- ✅ Docker Compose environment
- ✅ CI/CD pipeline (GitHub Actions)

**Sprint 2: Authentication & User Management** (Weeks 3-4)

- ✅ JWT authentication with httpOnly cookies
- ✅ Role-based access control (RBAC)
- ✅ User domain (entities, value objects)
- ✅ Password hashing (bcrypt)
- ✅ Email verification workflow
- ✅ Password reset flow
- ✅ Login/logout/refresh endpoints
- ✅ E2E tests for auth flow
- ✅ 82.1% test coverage

**Sprint 3: Wells Domain** (Weeks 5-6)

- ✅ Well entity with business rules
- ✅ Value objects (ApiNumber, Location)
- ✅ CQRS commands/queries
- ✅ RESTful API with Swagger docs
- ✅ RBAC enforcement
- ✅ Frontend UI (create, edit, delete, list)
- ✅ React Query integration
- ✅ Database schema with indexes
- ✅ E2E tests (37 scenarios)
- ✅ Unit test coverage ≥80%

**Sprint 3-B: MVP Polish** (Week 6.5)

- ✅ Admin user management (GetAllUsers query)
- ✅ Tenant filtering in admin portal
- ✅ Quality checks infrastructure
- ✅ Electron app build configuration
- ✅ Code formatting and linting

### 🟢 Current Sprint: 3-C (Weeks 7-9) - Phase 1 Complete

**Goal**: Build complete demo-ready system for client presentations

**✅ Phase 1 Completed (October 25, 2025)**:

- ✅ Field data domain (production, inspection, maintenance)
- ✅ Offline sync infrastructure (pull/push endpoints)
- ✅ Electron app offline database (SQLite + sync service)
- ✅ Tenant database migration (field_entries table)
- ✅ Realistic seed data generation (Permian Basin)

**🔨 In Progress (Phase 2)**:

- 🔨 Electron app field entry forms (UI components)
- 🔨 Web app map interface (Mapbox integration)
- 🔨 Web app field data viewing (charts and tables)
- 🔨 Mobile app basic functionality
- 🔨 Admin portal CRUD completion
- 🔨 Demo simulation scripts

**Remaining Work**: ~68 hours

- Electron UI forms (12h)
- Web app map interface (16h)
- Web app field data viewing (8h)
- Mobile app basics (16h)
- Admin portal completion (6h)
- Demo scripts (4h)
- E2E testing (6h)

### 📋 Future Sprints (Post-MVP)

**Sprint 4: Production Optimization**

- Advanced analytics (decline curves, EUR forecasting)
- Automated alerts (low production, equipment failure)
- Custom reporting (regulatory, investor)
- SCADA system integration

**Sprint 5: Mobile Enhancements**

- Photo management (annotations, OCR)
- Voice notes / voice-to-text
- Barcode scanning for equipment
- Offline maps

**Sprint 6: Scale & Performance**

- Database performance tuning
- CDN for photo storage
- Advanced caching strategies
- Multi-region deployment

---

## Quick Start

> **Note**: Applications are not yet implemented. This quick start will be updated as development progresses.

### Prerequisites

- **Node.js** 20+
- **pnpm** 10.0.0+
- **Docker** and Docker Compose
- **Python** 3.11+ (for ML service)

### Setup

```bash
# Clone repository
git clone <repository-url>
cd wellpulse

# Install dependencies
pnpm install

# Start infrastructure services
docker compose up -d

# Setup will create:
# - PostgreSQL (master DB + tenant DBs)
# - Redis (cache)
# - Mailpit (email testing)
# - MinIO (file storage)
```

### Database Setup

#### Quick Setup (Automated Scripts)

```bash
# Complete database setup (create + migrate + seed)
./scripts/create-dbs.sh --seed

# This creates:
# - Master database with super admin and 2 tenants
# - Tenant databases (wellpulse_internal, demo_wellpulse)
# - Realistic demo data for demo tenant
```

**Seed Data Created**:

**Master Database**:

- Super Admin: `admin@wellpulse.app` / `WellPulse2025!`
- WellPulse Internal: `wellpulse` (Enterprise, ACTIVE) - for admin users
- Demo Oil Company: `demo.wellpulse.app` (Starter tier, TRIAL)

**Demo Tenant Database** (demo_wellpulse):

- 4 Users:
  - `andy@demo.com` - Andy Administrator (ADMIN)
  - `mandy@demo.com` - Mandy Manager (MANAGER)
  - `peter@demo.com` - Peter Pumper (OPERATOR)
  - `polly@demo.com` - Polly Pumper (OPERATOR)
- Password (all users): `demo123`
- 15 Wells in Permian Basin (Midland-Odessa area)
- ~485 Field Entries (30 days production + weekly inspections + monthly maintenance)
- Offline sync simulation (last 3 days pending sync)

#### Manual Setup (Step-by-Step)

```bash
# Run all migrations (master + tenant databases)
pnpm --filter=api db:migrate:all

# Seed master database (super admin + sample tenants)
pnpm --filter=api db:seed:master

# Seed demo tenant database with realistic data
pnpm exec tsx apps/api/src/infrastructure/database/seeds/tenant.seed.ts demo

# Launch Drizzle Studio to visualize database schema
pnpm --filter=api db:studio

# Generate migration files (for production deployments)
pnpm --filter=api db:generate:master  # Master DB migrations
pnpm --filter=api db:generate:tenant  # Tenant DB migrations
```

#### Database Management Scripts

```bash
# Create all databases, run migrations, and seed demo data
./scripts/create-dbs.sh --seed

# Create all databases and run migrations (no seed data)
./scripts/create-dbs.sh

# Drop all WellPulse databases (clean slate)
./scripts/drop-dbs.sh

# Reset everything (drop + recreate + seed)
./scripts/drop-dbs.sh && ./scripts/create-dbs.sh --seed
```

### Development

```bash
# Start all applications
pnpm dev

# Applications will run on:
# - Web: http://localhost:4001
# - API: http://localhost:4000
# - Admin: http://localhost:4002
# - ML Service: http://localhost:8000

# Quality checks
pnpm format       # Format code with Prettier
pnpm lint         # Lint with ESLint
pnpm type-check   # Check TypeScript types
pnpm test         # Run all tests
pnpm build        # Build all applications
```

### Mobile

```bash
# Use EAS to setup the project in /apps/mobile (already done)
cd apps/mobile && npx eas-cli@latest init --id d6bb620a-b861-482a-ac09-7cdf86e05a84

# Use EAS to make builds for ios and andriod
cd apps/mobile && npx eas-cli@latest build --platform all --auto-submit
```

---

## Demo Setup

### Complete Demo-Ready System

WellPulse is designed to be demo-ready with realistic seed data and simulation scripts. You can show the entire offline-to-online sync workflow in a 15-minute live demo.

### Prerequisites for Demo

Ensure all applications are built and the database is seeded:

```bash
# Build all applications
pnpm build

# Ensure infrastructure is running
docker compose up -d

# Run database migrations
pnpm --filter=api db:migrate:all

# Seed realistic demo data
pnpm --filter=api seed:demo
```

### Demo Credentials

After running `seed:demo`, you'll have:

**Demo Tenant: Permian Petroleum LLC**

- Subdomain: `permian.wellpulse.local`
- Database: `permian_petroleum_db`

**Users**:

- Admin: `andy@demo.com` / `demo123`
- Manager: `mandy@demo.com` / `demo123`
- Pumper: `peter@demo.com` / `demo123`

**Data**:

- 50 wells in Permian Basin (real GPS coordinates)
- 500+ field entries (30 days of production data)
- Realistic lease groupings and statuses

### Running the Demo

#### 1. Start All Applications

```bash
# Start all dev servers
pnpm dev

# Access points:
# Web App: http://localhost:4001
# Admin Portal: http://localhost:4002
# API: http://localhost:4000
# Electron App: Opens in desktop window
```

#### 2. Web App Demo (Operations Manager View)

```bash
# Open browser to demo tenant
open http://permian.wellpulse.local:4001

# Login as manager
# Email: mandy@demo.com
# Password: demo123

# Demo flow:
# 1. View interactive map with 50 wells plotted
# 2. Click well marker to see details popup
# 3. Navigate to well details page
# 4. View production chart (30 days of data)
# 5. View recent field entries table
```

#### 3. Electron App Demo (Field Operator View)

```bash
# Launch Electron app
pnpm --filter=electron dev

# Login as pumper
# Email: peter@demo.com
# Password: demo123

# Demo flow:
# 1. Disconnect WiFi/Ethernet (go offline)
# 2. Navigate to well list (shows cached wells)
# 3. Select "Permian 001"
# 4. Enter production data:
#    - Oil: 82.3 bbls
#    - Gas: 375.8 mcf
#    - Water: 28.4 bbls
#    - Runtime: 24 hours
#    - Notes: "Equipment running great. No issues."
# 5. Submit (saves to local SQLite)
# 6. Show sync queue (1 pending entry)
# 7. Reconnect WiFi
# 8. Click "Sync Now"
# 9. Watch entry upload
# 10. Return to web app
# 11. Refresh well details - NEW ENTRY APPEARS!
```

#### 4. Admin Portal Demo (Live Provisioning)

```bash
# Open admin portal
open http://localhost:4002

# Login as super admin
# Email: superadmin@wellpulse.io
# Password: WellPulse2025!

# Demo flow:
# 1. Click "Create Tenant"
# 2. Fill in prospect's company name
# 3. Enter admin email
# 4. Select subscription tier
# 5. Click "Create" (takes ~2 seconds)
# 6. Show success message with subdomain
# 7. Admin receives welcome email
```

### Simulation Scripts

#### Simulate Field Data Entry

```bash
# Simulate an operator entering production data
tsx scripts/simulate-field-entry.ts \
  --well="42-165-30001" \
  --operator="peter@demo.com" \
  --oil=75.5 \
  --gas=350.2 \
  --water=32.1

# Output:
# ✅ Field entry created for Permian 001
# ✅ Entry ID: abc-123-def-456
# ✅ Recorded at: 2025-01-24T10:30:00Z
```

#### Provision New Client

```bash
# Provision a new client during live demo
tsx scripts/provision-client.ts \
  --company="ACME Oil & Gas" \
  --email="admin@acmeoil.com" \
  --tier="PROFESSIONAL"

# Output:
# ✅ Client provisioned:
#    Tenant: ACME Oil & Gas
#    Subdomain: acme-oil-gas.wellpulse.io
#    Admin: admin@acmeoil.com
#    Temp Password: (sent via email)
#    Database: acme_oil_gas_db (created)
#    Schema: wells, users, field_entries (migrated)
```

#### Generate Realistic Field Data

```bash
# Generate 30 days of production data for all wells
tsx scripts/generate-field-data.ts \
  --tenant="permian-petroleum" \
  --days=30 \
  --wells=50 \
  --entries-per-day=35

# Output:
# ✅ Generating field data...
#    Wells: 50
#    Days: 30
#    Expected entries: ~1050 (35 per day)
# ✅ Created 1,047 field entries
# ✅ Date range: 2024-12-25 to 2025-01-24
# ✅ Average entries per well: 20.9
```

#### Simulate Offline Sync

```bash
# Simulate offline device syncing pending entries
tsx scripts/simulate-sync.ts \
  --device-id="demo-laptop-001" \
  --tenant="permian-petroleum"

# Output:
# ✅ Syncing device: demo-laptop-001
#    Pending entries: 15
# ✅ Pull: Downloaded 2 new wells
# ✅ Push: Uploaded 15 field entries
#    Succeeded: 15
#    Failed: 0
#    Conflicts: 0
# ✅ Sync complete
```

### Demo Script (15 Minutes)

**Setup** (5 minutes before client arrives):

1. ✅ Run `pnpm dev` (all apps running)
2. ✅ Run `pnpm --filter=api seed:demo` (if not already seeded)
3. ✅ Open web app and verify map loads
4. ✅ Open Electron app and verify login works
5. ✅ Disconnect Electron app from WiFi

**Demo Flow**:

**Part 1: Web App (5 min)**

- Login as <mandy@demo.com>
- Show map with 50 wells color-coded by status
- Click well marker → popup with details
- Navigate to well details page
- Show production chart (30 days of trend data)
- Show recent field entries table

**Part 2: Offline Capability (5 min)**

- Show Electron app is offline (WiFi disconnected)
- Navigate to well list (cached data still works)
- Select "Permian 001"
- Enter production data (oil, gas, water, runtime)
- Submit (saves to local SQLite, not synced yet)
- Show sync queue (1 pending entry)

**Part 3: The Magic Sync (3 min)**

- Reconnect WiFi
- Click "Sync Now" button
- Watch progress indicator
- Show success message
- **Return to web app**
- Refresh well details page
- **✨ Magic moment**: New entry appears on chart!

**Part 4: Live Provisioning (2 min)**

- "Want to see how fast we can get you set up?"
- Open admin portal
- Create new tenant with client's company name
- ~2 seconds later: "You're live at {subdomain}.wellpulse.io"
- "Check your email for credentials!"

**Closing**: "That's the entire workflow. Field operators work completely offline, and you see everything in real-time. When can we get you started?"

### Troubleshooting Demo Issues

**Map not loading?**

```bash
# Check Mapbox token
echo $NEXT_PUBLIC_MAPBOX_TOKEN

# Set token if missing
export NEXT_PUBLIC_MAPBOX_TOKEN="your-token-here"
```

**Sync failing?**

```bash
# Check API is running
curl http://localhost:4000/health

# Check tenant database exists
pnpm --filter=api db:studio
# Look for permian_petroleum_db
```

**No seed data?**

```bash
# Re-seed demo data
pnpm --filter=api seed:demo --force

# Verify data
psql -h localhost -U wellpulse -d permian_petroleum_db -c "SELECT COUNT(*) FROM wells;"
# Should return 50
```

**Electron app not building?**

```bash
# Rebuild Electron app
pnpm --filter=electron build

# Check for errors
pnpm --filter=electron dev
```

---

## Documentation

### Feature Specifications

- [API Feature Specification](docs/apps/api-feature-specification.md)
- [Web Dashboard Feature Specification](docs/apps/web-feature-specification.md)
- [Admin Portal Feature Specification](docs/apps/admin-feature-specification.md)
- [Electron App Feature Specification](docs/apps/electron-feature-specification.md)
- [Mobile App Feature Specification](docs/apps/mobile-feature-specification.md)
- [ML Service Feature Specification](docs/apps/ml-service-feature-specification.md)

### Architecture Patterns

- [Pattern Catalog](docs/patterns/README.md) - All 72 patterns
- [Database-Per-Tenant Multi-Tenancy](docs/patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
- [Database-Agnostic Multi-Tenant](docs/patterns/72-Database-Agnostic-Multi-Tenant-Pattern.md)
- [Offline Batch Sync Pattern](docs/patterns/70-Offline-Batch-Sync-Pattern.md)
- [Conflict Resolution Pattern](docs/patterns/71-Conflict-Resolution-Pattern.md)

### Development Guides

- [CLAUDE.md](CLAUDE.md) - Development guidelines for AI assistants
- [Offline Sync API](docs/guides/offline-sync-api.md) - Complete API reference for offline sync endpoints
- [Database Migrations](docs/guides/database-migrations.md) - Migration workflow and best practices
- [Security Best Practices](docs/guides/security-best-practices.md) - Comprehensive security guide
- [API Rate Limiting](docs/guides/api-rate-limiting.md) - Multi-tier throttling documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [SECURITY.md](SECURITY.md) - Security policies

---

## Architecture Principles

### Backend (Hexagonal Architecture)

```
Presentation (Controllers, DTOs, Guards)
     ↓
Application (Commands, Queries, Use Cases)
     ↓
Domain (Entities, Value Objects, Business Rules)
     ↑
Infrastructure (Repositories, DB, External APIs)
```

**Rule**: Domain layer has NO dependencies on infrastructure

### Frontend (Layered Architecture)

```
UI (Components, Pages)
  ↓
State (React Query, Zustand)
  ↓
Business Logic (Commands, Queries)
  ↓
Data Access (Repositories, API Client)
```

### Key Principles

- **Dependencies inward**: Outer layers depend on inner layers
- **Pattern-driven development**: Use established patterns from catalog
- **Separation of concerns**: Clear boundaries between layers
- **Type safety**: TypeScript strict mode, no `any`
- **Test coverage**: ≥80% coverage requirement
- **Immutability**: Prefer immutable data structures
- **Error handling**: Proper error types and user-friendly messages

---

## Target Market

### Primary Users

- **Lease Operators / Pumpers**: Daily field operations, data entry
- **Production Managers**: Production oversight, analytics, optimization
- **Operations Managers**: High-level operations management
- **HSE Managers**: Safety, environmental, ESG compliance

### Geographic Focus

- **Permian Basin** (Texas & New Mexico) - Initial focus
- Expansion: Eagle Ford, Bakken, DJ Basin (future phases)

### Company Size

- **10-100 wells**: Small operators (Starter tier, $99/month)
- **100-500 wells**: Mid-sized operators (Professional tier, $299/month)
- **500+ wells**: Large operators (Enterprise tier, $999+/month)

---

## Pricing Strategy (SaaS)

| Tier                | Wells    | Price/Month | Database Support                | Features                                 |
| ------------------- | -------- | ----------- | ------------------------------- | ---------------------------------------- |
| **Starter**         | 10-100   | $99         | WellPulse PostgreSQL            | Web + Offline Apps, Basic ML             |
| **Professional**    | 100-500  | $299        | Client PostgreSQL               | Advanced ML, Custom Reports              |
| **Enterprise**      | 500-2000 | $999        | SQL Server/MySQL/Oracle Adapter | Priority Support, Integrations           |
| **Enterprise Plus** | 2000+    | $1,999      | ETL Sync from Any Database      | SCADA/ERP Integration, Dedicated Support |

**Custom Integrations**: $5,000-$25,000 one-time setup (SCADA, production accounting, ERP)

---

## License

UNLICENSED - Private project

---

© 2025 WellPulse, LLC. All rights reserved.
