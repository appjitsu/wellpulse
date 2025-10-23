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

- **Dedicated subdomain**: `acme.wellpulse.app`, `permianops.wellpulse.app`
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

**🚧 Phase: Architecture & Planning Complete**

### ✅ Completed

- Monorepo infrastructure (Turborepo, pnpm, Docker Compose)
- Comprehensive pattern library (72 software patterns)
- Complete feature specifications for all 6 applications:
  - [API Feature Specification](docs/apps/api-feature-specification.md)
  - [Web Feature Specification](docs/apps/web-feature-specification.md)
  - [Admin Portal Feature Specification](docs/apps/admin-feature-specification.md)
  - [Electron Feature Specification](docs/apps/electron-feature-specification.md)
  - [Mobile Feature Specification](docs/apps/mobile-feature-specification.md)
  - [ML Service Feature Specification](docs/apps/ml-service-feature-specification.md)
- Database-agnostic multi-tenant architecture
- ETL integration patterns for external systems
- Cost optimization strategy (~$57/month bootstrap phase)

### 🔄 Next Phase: Implementation Begins

1. Scaffold all 6 applications in monorepo
2. Implement master database + tenant provisioning
3. Build authentication foundation
4. Implement well registry (first domain entity)
5. Create interactive map interface
6. Build offline sync infrastructure

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

### Development

```bash
# Start all applications
pnpm dev

# Applications will run on:
# - Web: http://localhost:3000
# - API: http://localhost:3001
# - Admin: http://localhost:3002
# - ML Service: http://localhost:8000
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
