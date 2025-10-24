/**
 * Well Repository Interface
 *
 * Domain layer contract for well persistence.
 * Implementation will be in infrastructure layer using Drizzle ORM.
 *
 * All operations are tenant-scoped for multi-tenancy isolation.
 */

import { Well, WellStatus } from '../wells/well.entity';

export interface IWellRepository {
  /**
   * Save a new well to the tenant database
   */
  save(tenantId: string, well: Well, databaseName?: string): Promise<void>;

  /**
   * Find well by ID within tenant
   */
  findById(
    tenantId: string,
    wellId: string,
    databaseName?: string,
  ): Promise<Well | null>;

  /**
   * Find well by API number within tenant
   */
  findByApiNumber(
    tenantId: string,
    apiNumber: string,
    databaseName?: string,
  ): Promise<Well | null>;

  /**
   * Find all wells in tenant with optional filters
   */
  findAll(
    tenantId: string,
    filters?: {
      status?: WellStatus;
      lease?: string;
      field?: string;
      operator?: string;
      search?: string; // Search by name or API number
      limit?: number;
      offset?: number;
      databaseName?: string;
    },
  ): Promise<Well[]>;

  /**
   * Count wells in tenant with optional filters
   */
  count(
    tenantId: string,
    filters?: {
      status?: WellStatus;
      lease?: string;
      field?: string;
      operator?: string;
      search?: string;
      databaseName?: string;
    },
  ): Promise<number>;

  /**
   * Update existing well
   */
  update(tenantId: string, well: Well, databaseName?: string): Promise<void>;

  /**
   * Soft delete well
   */
  delete(
    tenantId: string,
    wellId: string,
    deletedBy: string,
    databaseName?: string,
  ): Promise<void>;

  /**
   * Check if API number exists within tenant
   */
  existsByApiNumber(
    tenantId: string,
    apiNumber: string,
    excludeWellId?: string, // For update validation
    databaseName?: string,
  ): Promise<boolean>;
}
