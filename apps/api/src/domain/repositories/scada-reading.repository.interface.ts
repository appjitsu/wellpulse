/**
 * SCADA Reading Repository Interface
 *
 * Defines the contract for SCADA reading persistence operations.
 * This interface lives in the domain layer and is implemented by the infrastructure layer.
 */

import { ScadaReading } from '../scada/scada-reading.entity';

export interface ScadaReadingFilters {
  wellId?: string;
  scadaConnectionId?: string;
  tagName?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface IScadaReadingRepository {
  /**
   * Create new SCADA reading (append-only time-series data)
   */
  create(reading: ScadaReading): Promise<void>;

  /**
   * Create multiple SCADA readings in batch (for performance)
   */
  createBatch(readings: ScadaReading[]): Promise<void>;

  /**
   * Find SCADA reading by ID
   */
  findById(tenantId: string, readingId: string): Promise<ScadaReading | null>;

  /**
   * Find SCADA readings with filters
   */
  findWithFilters(
    tenantId: string,
    filters: ScadaReadingFilters,
  ): Promise<ScadaReading[]>;

  /**
   * Find latest reading for a specific tag
   */
  findLatestByTag(
    tenantId: string,
    scadaConnectionId: string,
    tagName: string,
  ): Promise<ScadaReading | null>;

  /**
   * Find readings for a specific well in time range
   */
  findByWellIdAndTimeRange(
    tenantId: string,
    wellId: string,
    startTime: Date,
    endTime: Date,
    limit?: number,
  ): Promise<ScadaReading[]>;

  /**
   * Count readings for a specific connection
   */
  countByConnectionId(
    tenantId: string,
    scadaConnectionId: string,
  ): Promise<number>;

  /**
   * Delete old readings (retention policy - e.g., keep only last 90 days)
   */
  deleteOlderThan(cutoffDate: Date): Promise<number>;
}
