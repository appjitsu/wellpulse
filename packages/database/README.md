# @wellpulse/database

Shared database types and utilities for the WellPulse monorepo.

## Purpose

This package provides TypeScript types that are shared across all applications:

- **API (NestJS)**: Domain entities, DTOs
- **Web (Next.js)**: Type-safe API responses
- **Admin (Next.js)**: Tenant management types
- **Electron**: Offline database schema
- **Mobile**: Offline database schema

## Types

### Tenant Types

- `Tenant`: Complete tenant record from master database
- `TenantDatabaseType`: Database technology choices
- `TenantStatus`: Active, suspended, trial, deleted
- `SubscriptionTier`: Starter, professional, enterprise tiers

### User Types

- `TenantUser`: Users within a tenant organization
- `AdminUser`: WellPulse platform administrators
- `UserRole`: Admin, manager, operator permissions

### Well Types

- `Well`: Oil/gas well entity
- `WellStatus`: Producing, shut-in, plugged, abandoned

### Production Types

- `ProductionData`: Daily production volumes (oil, gas, water)

### Equipment Types

- `Equipment`: Field equipment inventory
- `EquipmentType`: Pump jack, separator, tank, etc.
- `EquipmentStatus`: Operational, down, maintenance

### Sync Types (Offline Apps)

- `SyncQueueItem`: Pending changes to upload when online
- `SyncAction`: Create, update, delete
- `SyncEntityType`: Entity types that can be synced

## Usage

```typescript
import type { Tenant, Well, ProductionData } from '@wellpulse/database';

function getTenant(id: string): Tenant {
  // Type-safe tenant retrieval
}

function recordProduction(data: ProductionData): void {
  // Type-safe production data entry
}
```

## Building

```bash
# Build TypeScript definitions
pnpm build

# Watch mode for development
pnpm dev
```

## Why Shared Types?

1. **Consistency**: Same types across frontend and backend
2. **Type Safety**: Catch errors at compile time
3. **Documentation**: Types serve as living documentation
4. **Refactoring**: Change types once, update everywhere
5. **Offline Sync**: Ensure local databases match server schema
