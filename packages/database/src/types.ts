/**
 * Shared database types for WellPulse monorepo
 *
 * These types are used across:
 * - API (NestJS backend)
 * - Web (Next.js dashboard)
 * - Admin (Next.js admin portal)
 * - Electron (offline desktop app)
 * - Mobile (React Native app)
 */

// ============================================================================
// Tenant Types
// ============================================================================

export type TenantDatabaseType =
  | 'POSTGRESQL' // Default, managed by WellPulse
  | 'SQL_SERVER' // Enterprise tier
  | 'MYSQL' // Enterprise tier
  | 'ORACLE' // Enterprise tier
  | 'ETL_SYNCED'; // Enterprise Plus tier (any database via ETL)

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'DELETED';

export type SubscriptionTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'ENTERPRISE_PLUS';

export interface Tenant {
  id: string;
  slug: string; // URL-friendly: "acme-oil-gas"
  subdomain: string; // "acme.wellpulse.app"
  name: string; // "ACME Oil & Gas"
  databaseType: TenantDatabaseType;
  databaseUrl: string; // Connection string
  databaseName: string; // "acme_wellpulse"
  subscriptionTier: SubscriptionTier;
  maxWells: number;
  status: TenantStatus;
  etlConfig?: Record<string, unknown>; // For ETL_SYNCED tenants
  contactEmail: string;
  contactPhone?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ============================================================================
// User Types
// ============================================================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export interface TenantUser {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// ============================================================================
// Well Types
// ============================================================================

export type WellStatus = 'PRODUCING' | 'SHUT_IN' | 'PLUGGED' | 'ABANDONED';

export interface Well {
  id: string;
  tenantId: string;
  apiNumber: string; // Official API well number
  name: string;
  latitude: number;
  longitude: number;
  status: WellStatus;
  leaseId?: string;
  fieldId?: string;
  spudDate?: Date;
  completionDate?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdBy: string;
  updatedBy: string;
}

// ============================================================================
// Production Types
// ============================================================================

export interface ProductionData {
  id: string;
  tenantId: string;
  wellId: string;
  productionDate: Date;
  oilVolume: number; // Barrels
  gasVolume: number; // MCF (thousand cubic feet)
  waterVolume: number; // Barrels
  runTime: number; // Hours
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  synced: boolean; // For offline apps
}

// ============================================================================
// Equipment Types
// ============================================================================

export type EquipmentType = 'PUMP_JACK' | 'SEPARATOR' | 'TANK' | 'COMPRESSOR' | 'HEATER_TREATER';

export type EquipmentStatus = 'OPERATIONAL' | 'DOWN' | 'MAINTENANCE' | 'RETIRED';

export interface Equipment {
  id: string;
  tenantId: string;
  wellId?: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  installDate?: Date;
  status: EquipmentStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ============================================================================
// Sync Types (for offline apps)
// ============================================================================

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncEntityType = 'well' | 'production' | 'equipment' | 'maintenance';

export interface SyncQueueItem {
  id: string;
  action: SyncAction;
  entityType: SyncEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  retryCount: number;
  lastError?: string;
}
