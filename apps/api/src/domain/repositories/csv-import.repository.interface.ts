/**
 * CSV Import Repository Interface
 *
 * Contract for CSV import persistence operations.
 *
 * Pattern: Repository Pattern
 * @see docs/patterns/08-Repository-Pattern.md
 */

import type { CsvImport } from '../csv/csv-import.entity';

export interface CsvImportRepository {
  /**
   * Save a CSV import record
   */
  save(csvImport: CsvImport): Promise<void>;

  /**
   * Find import by ID
   */
  findById(tenantId: string, importId: string): Promise<CsvImport | null>;

  /**
   * Find all imports for a tenant
   */
  findByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
    },
  ): Promise<CsvImport[]>;

  /**
   * Count total imports for a tenant
   */
  countByTenant(tenantId: string, status?: string): Promise<number>;

  /**
   * Delete import (soft delete)
   */
  delete(tenantId: string, importId: string): Promise<void>;

  /**
   * Update import status and progress
   */
  updateProgress(
    tenantId: string,
    importId: string,
    processed: number,
    failed: number,
    skipped: number,
  ): Promise<void>;
}
