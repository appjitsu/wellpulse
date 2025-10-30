import { Injectable } from '@nestjs/common';
import { eq, and, gte, lte, isNull, desc, sql } from 'drizzle-orm';
import {
  IFieldEntryRepository,
  FieldEntryFilters,
} from '../../../domain/repositories/field-entry.repository.interface';
import {
  FieldEntry,
  EntryType,
} from '../../../domain/field-data/field-entry.entity';
import {
  ProductionData,
  InspectionData,
  MaintenanceData,
} from '../../../domain/field-data/value-objects';
import { TenantDatabaseService } from '../tenant-database.service';
import {
  fieldEntries,
  FieldEntryRow,
} from '../schema/tenant/field-entries.schema';

@Injectable()
export class FieldEntryRepository implements IFieldEntryRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  async save(tenantId: string, entry: FieldEntry): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const row = this.toRow(entry);

    await db.insert(fieldEntries).values(row);
  }

  async findById(tenantId: string, id: string): Promise<FieldEntry | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(fieldEntries)
      .where(and(eq(fieldEntries.id, id), isNull(fieldEntries.deletedAt)))
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findAll(
    tenantId: string,
    filters?: FieldEntryFilters,
    limit = 100,
    offset = 0,
  ): Promise<FieldEntry[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const conditions = this.buildWhereConditions(filters);

    const rows = await db
      .select()
      .from(fieldEntries)
      .where(and(...conditions))
      .orderBy(desc(fieldEntries.recordedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.toDomain(row));
  }

  async findByWellId(
    tenantId: string,
    wellId: string,
    limit = 100,
    offset = 0,
  ): Promise<FieldEntry[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(fieldEntries)
      .where(
        and(eq(fieldEntries.wellId, wellId), isNull(fieldEntries.deletedAt)),
      )
      .orderBy(desc(fieldEntries.recordedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => this.toDomain(row));
  }

  async findUnsynced(tenantId: string, limit = 1000): Promise<FieldEntry[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(fieldEntries)
      .where(and(isNull(fieldEntries.syncedAt), isNull(fieldEntries.deletedAt)))
      .orderBy(desc(fieldEntries.recordedAt))
      .limit(limit);

    return rows.map((row) => this.toDomain(row));
  }

  async update(tenantId: string, entry: FieldEntry): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const row = this.toRow(entry);

    await db
      .update(fieldEntries)
      .set({
        ...row,
        updatedAt: new Date(),
      })
      .where(eq(fieldEntries.id, entry.id));
  }

  async delete(tenantId: string, id: string, deletedBy: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .update(fieldEntries)
      .set({
        deletedAt: new Date(),
        deletedBy,
        updatedAt: new Date(),
      })
      .where(eq(fieldEntries.id, id));
  }

  async count(tenantId: string, filters?: FieldEntryFilters): Promise<number> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const conditions = this.buildWhereConditions(filters);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fieldEntries)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async getProductionSummary(
    tenantId: string,
    wellId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalOil: number;
    totalGas: number;
    totalWater: number;
    entryCount: number;
  }> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(fieldEntries)
      .where(
        and(
          eq(fieldEntries.wellId, wellId),
          eq(fieldEntries.entryType, 'PRODUCTION'),
          gte(fieldEntries.recordedAt, startDate),
          lte(fieldEntries.recordedAt, endDate),
          isNull(fieldEntries.deletedAt),
        ),
      );

    let totalOil = 0;
    let totalGas = 0;
    let totalWater = 0;

    for (const row of rows) {
      // JSONB data is loosely typed - validate at runtime
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = row.productionData as any;
      if (data && typeof data === 'object' && data !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalOil += (data.oilVolume as number) ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalGas += (data.gasVolume as number) ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalWater += (data.waterVolume as number) ?? 0;
      }
    }

    return {
      totalOil,
      totalGas,
      totalWater,
      entryCount: rows.length,
    };
  }

  private buildWhereConditions(filters?: FieldEntryFilters) {
    const conditions = [];

    if (filters?.wellId) {
      conditions.push(eq(fieldEntries.wellId, filters.wellId));
    }

    if (filters?.entryType) {
      conditions.push(eq(fieldEntries.entryType, filters.entryType));
    }

    if (filters?.createdBy) {
      conditions.push(eq(fieldEntries.createdBy, filters.createdBy));
    }

    if (filters?.startDate) {
      conditions.push(gte(fieldEntries.recordedAt, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(fieldEntries.recordedAt, filters.endDate));
    }

    if (filters?.isSynced === true) {
      conditions.push(sql`${fieldEntries.syncedAt} IS NOT NULL`);
    } else if (filters?.isSynced === false) {
      conditions.push(isNull(fieldEntries.syncedAt));
    }

    if (!filters?.includeDeleted) {
      conditions.push(isNull(fieldEntries.deletedAt));
    }

    // Always filter by tenantId for security
    conditions.push(
      eq(fieldEntries.tenantId, filters?.wellId?.split('-')[0] ?? ''),
    );

    return conditions;
  }

  private toDomain(row: FieldEntryRow): FieldEntry {
    // Reconstruct value objects from JSONB data
    // Note: JSONB data is loosely typed - value objects validate at runtime
    let productionData: ProductionData | undefined;
    let inspectionData: InspectionData | undefined;
    let maintenanceData: MaintenanceData | undefined;

    if (row.entryType === 'PRODUCTION' && row.productionData) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      productionData = ProductionData.create(row.productionData as any);
    }

    if (row.entryType === 'INSPECTION' && row.inspectionData) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      inspectionData = InspectionData.create(row.inspectionData as any);
    }

    if (row.entryType === 'MAINTENANCE' && row.maintenanceData) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      maintenanceData = MaintenanceData.create(row.maintenanceData as any);
    }

    return FieldEntry.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      wellId: row.wellId,
      entryType: row.entryType as EntryType,
      productionData,
      inspectionData,
      maintenanceData,
      recordedAt: row.recordedAt,
      syncedAt: row.syncedAt ?? undefined,
      createdBy: row.createdBy,
      deviceId: row.deviceId,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      photos: (row.photos as string[]) ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? undefined,
      deletedBy: row.deletedBy ?? undefined,
    });
  }

  private toRow(entry: FieldEntry): typeof fieldEntries.$inferInsert {
    // Extract value object data as plain objects for JSONB storage
    const productionData = entry.productionData
      ? {
          oilVolume: entry.productionData.oilVolume,
          gasVolume: entry.productionData.gasVolume,
          waterVolume: entry.productionData.waterVolume,
          runHours: entry.productionData.runHours,
          casingPressure: entry.productionData.casingPressure,
          tubingPressure: entry.productionData.tubingPressure,
          chokeSize: entry.productionData.chokeSize,
        }
      : null;

    const inspectionData = entry.inspectionData
      ? {
          inspectionType: entry.inspectionData.inspectionType,
          equipmentStatus: entry.inspectionData.equipmentStatus,
          leaksDetected: entry.inspectionData.leaksDetected,
          abnormalNoises: entry.inspectionData.abnormalNoises,
          visualDamage: entry.inspectionData.visualDamage,
          safetyHazards: entry.inspectionData.safetyHazards,
          gaugeReadings: entry.inspectionData.gaugeReadings,
          issuesFound: entry.inspectionData.issuesFound,
          correctiveActions: entry.inspectionData.correctiveActions,
        }
      : null;

    const maintenanceData = entry.maintenanceData
      ? {
          maintenanceType: entry.maintenanceData.maintenanceType,
          workStatus: entry.maintenanceData.workStatus,
          workPerformed: entry.maintenanceData.workPerformed,
          partsReplaced: entry.maintenanceData.partsReplaced,
          laborHours: entry.maintenanceData.laborHours,
          totalCost: entry.maintenanceData.totalCost,
          nextMaintenanceDue: entry.maintenanceData.nextMaintenanceDue,
          workOrderNumber: entry.maintenanceData.workOrderNumber,
          technicianName: entry.maintenanceData.technicianName,
          equipmentDowntime: entry.maintenanceData.equipmentDowntime,
        }
      : null;

    return {
      id: entry.id,
      tenantId: entry.tenantId,
      wellId: entry.wellId,
      entryType: entry.entryType,
      productionData,
      inspectionData,
      maintenanceData,
      recordedAt: entry.recordedAt,
      syncedAt: entry.syncedAt ?? null,
      createdBy: entry.createdBy,
      deviceId: entry.deviceId,
      latitude: entry.latitude ?? null,
      longitude: entry.longitude ?? null,
      photos: entry.photos.length > 0 ? entry.photos : null,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      deletedAt: entry.deletedAt ?? null,
      deletedBy: entry.deletedBy ?? null,
    };
  }
}
