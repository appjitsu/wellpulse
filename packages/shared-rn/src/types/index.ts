/**
 * WellPulse Field - Shared TypeScript Types
 * Used across iOS, Android, macOS, and Windows
 */

/**
 * Field Entry - Production data recorded at well site
 */
export interface FieldEntry {
  /** UUID v4 */
  id: string;
  /** Well identifier (e.g., "TX-450") */
  wellName: string;
  /** Field operator/technician name */
  operatorName: string;
  /** Entry date (ISO 8601 date string, e.g., "2025-10-25") */
  entryDate: string;
  /** Production volume in barrels per day */
  productionVolume: number;
  /** Pressure in PSI (optional) */
  pressure?: number;
  /** Temperature in Fahrenheit (optional) */
  temperature?: number;
  /** Freeform notes/observations (optional) */
  notes?: string;
  /** Sync status: false = pending, true = synced */
  synced: boolean;
  /** Created timestamp (ISO 8601, e.g., "2025-10-25T10:00:00Z") */
  createdAt: string;
  /** Last updated timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Field Entry Create DTO
 * Input for creating a new field entry (excludes generated fields)
 */
export interface CreateFieldEntryDTO {
  wellName: string;
  operatorName: string;
  entryDate: string;
  productionVolume: number;
  pressure?: number;
  temperature?: number;
  notes?: string;
}

/**
 * Field Entry Database Row
 * Raw database row format (before mapping to domain entity)
 */
export interface FieldEntryRow {
  id: string;
  well_name: string;
  operator_name: string;
  entry_date: string;
  production_volume: number;
  pressure: number | null;
  temperature: number | null;
  notes: string | null;
  synced: number; // SQLite doesn't have boolean, use 0/1
  created_at: string;
  updated_at: string;
}

/**
 * Sync Status
 */
export interface SyncStatus {
  /** Number of unsynced entries */
  pendingCount: number;
  /** Last successful sync timestamp */
  lastSyncAt?: string;
  /** Currently syncing */
  isSyncing: boolean;
  /** Sync error message */
  error?: string;
}

/**
 * Well (simplified for offline app)
 */
export interface Well {
  id: string;
  /** Well identifier (e.g., "TX-450") */
  name: string;
  /** Operator/lease name */
  operator?: string;
  /** Well location coordinates */
  latitude?: number;
  longitude?: number;
}
