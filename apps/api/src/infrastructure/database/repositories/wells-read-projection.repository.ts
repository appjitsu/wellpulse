/**
 * Wells Read Projection Repository
 *
 * Manages the denormalized wells_read_projection table.
 * Optimized for fast queries without joins.
 *
 * This is a WRITE-ONLY repository from the application layer perspective.
 * Reads come from query handlers that use this projection directly.
 */

import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { TenantDatabaseService } from '../tenant-database.service';
import { wellsReadProjection } from '../schema/tenant/wells-read-projection.schema';

export interface WellProjectionData {
  id: string;
  apiNumber: string;
  name: string;
  status: string;
  latitude: string;
  longitude: string;
  lease: string | null;
  field: string | null;
  operator: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
}

@Injectable()
export class WellsReadProjectionRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  /**
   * Create or update a well in the read projection
   */
  async upsert(tenantId: string, data: WellProjectionData): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Upsert (insert or update if exists)
    await db
      .insert(wellsReadProjection)
      .values({
        id: data.id,
        apiNumber: data.apiNumber,
        name: data.name,
        status: data.status,
        latitude: data.latitude,
        longitude: data.longitude,
        lease: data.lease,
        field: data.field,
        operator: data.operator,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        deletedAt: data.deletedAt,
        deletedBy: data.deletedBy,
      })
      .onConflictDoUpdate({
        target: wellsReadProjection.id,
        set: {
          name: data.name,
          status: data.status,
          latitude: data.latitude,
          longitude: data.longitude,
          lease: data.lease,
          field: data.field,
          operator: data.operator,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
        },
      });
  }

  /**
   * Soft delete a well from the read projection
   */
  async softDelete(
    tenantId: string,
    wellId: string,
    deletedBy: string,
  ): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .update(wellsReadProjection)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
      })
      .where(eq(wellsReadProjection.id, wellId));
  }

  /**
   * Permanently delete a well from the read projection
   * (Only used for data cleanup, not normal operations)
   */
  async hardDelete(tenantId: string, wellId: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(wellsReadProjection)
      .where(eq(wellsReadProjection.id, wellId));
  }

  /**
   * Rebuild the entire projection from source data
   * Useful for:
   * - Initial data migration
   * - Recovering from projection corruption
   * - Adding new fields to projection
   */
  async rebuild(tenantId: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // In a real implementation, this would:
    // 1. Delete all records from wells_read_projection
    // 2. Query all wells from the source table
    // 3. Transform and insert into projection
    // 4. Handle errors gracefully

    // For now, this is a placeholder
    // TODO: Implement full projection rebuild logic
    await db.delete(wellsReadProjection);

    // Then repopulate from source:
    // const wells = await db.select().from(wellsTable);
    // for (const well of wells) {
    //   await this.upsert(tenantId, transformToProjection(well));
    // }
  }
}
