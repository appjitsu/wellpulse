import { FieldEntry, EntryType } from '../field-data/field-entry.entity';

export interface FieldEntryFilters {
  wellId?: string;
  entryType?: EntryType;
  createdBy?: string;
  startDate?: Date;
  endDate?: Date;
  isSynced?: boolean;
  includeDeleted?: boolean;
}

export interface IFieldEntryRepository {
  /**
   * Save a new field entry
   */
  save(tenantId: string, entry: FieldEntry): Promise<void>;

  /**
   * Find a field entry by ID
   */
  findById(tenantId: string, id: string): Promise<FieldEntry | null>;

  /**
   * Find all field entries with optional filters
   */
  findAll(
    tenantId: string,
    filters?: FieldEntryFilters,
    limit?: number,
    offset?: number,
  ): Promise<FieldEntry[]>;

  /**
   * Find field entries for a specific well
   */
  findByWellId(
    tenantId: string,
    wellId: string,
    limit?: number,
    offset?: number,
  ): Promise<FieldEntry[]>;

  /**
   * Find unsynced field entries (for sync operations)
   */
  findUnsynced(tenantId: string, limit?: number): Promise<FieldEntry[]>;

  /**
   * Update an existing field entry
   */
  update(tenantId: string, entry: FieldEntry): Promise<void>;

  /**
   * Delete a field entry (soft delete)
   */
  delete(tenantId: string, id: string, deletedBy: string): Promise<void>;

  /**
   * Count field entries with optional filters
   */
  count(tenantId: string, filters?: FieldEntryFilters): Promise<number>;

  /**
   * Get production summary for a well in a date range
   */
  getProductionSummary(
    tenantId: string,
    wellId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalOil: number;
    totalGas: number;
    totalWater: number;
    entryCount: number;
  }>;
}
