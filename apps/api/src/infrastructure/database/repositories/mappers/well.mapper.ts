/**
 * Well Mapper
 *
 * Converts between domain entities (Well) and database records.
 * Follows hexagonal architecture pattern where domain entities are reconstituted
 * from persistence layer.
 *
 * Handles conversion of value objects (ApiNumber, Location) to primitives for storage.
 */

import { Well, WellStatus } from '../../../../domain/wells/well.entity';
import { Well as DbWell } from '../../schema/tenant/wells.schema';

export class WellMapper {
  /**
   * Convert database record to Well domain entity
   * Uses Well.reconstitute() to restore entity from persistence
   */
  static toDomain(record: DbWell): Well {
    return Well.reconstitute({
      id: record.id,
      name: record.name,
      apiNumber: record.apiNumber,
      latitude: parseFloat(record.latitude),
      longitude: parseFloat(record.longitude),
      status: record.status as WellStatus,
      lease: record.lease ?? null,
      field: record.field ?? null,
      operator: record.operator ?? null,
      spudDate: record.spudDate ?? null,
      completionDate: record.completionDate ?? null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdBy: record.createdBy ?? null,
      updatedBy: record.updatedBy ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /**
   * Convert Well domain entity to database record format
   * Extracts primitive values for database persistence
   */
  static toPersistence(well: Well): Omit<DbWell, 'deletedAt' | 'deletedBy'> {
    return {
      id: well.id,
      name: well.name,
      apiNumber: well.apiNumber, // Value object extracted via getter
      latitude: well.latitude.toString(), // Convert to string for decimal storage
      longitude: well.longitude.toString(), // Convert to string for decimal storage
      status: well.status,
      lease: well.lease,
      field: well.field,
      operator: well.operator,
      spudDate: well.spudDate,
      completionDate: well.completionDate,
      metadata: well.metadata,
      createdBy: well.createdBy,
      updatedBy: well.updatedBy,
      createdAt: well.createdAt,
      updatedAt: well.updatedAt,
    };
  }
}
