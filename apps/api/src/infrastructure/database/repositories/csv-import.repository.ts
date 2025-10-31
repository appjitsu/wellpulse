/**
 * CSV Import Repository Implementation
 *
 * Implements CSV import data access layer with:
 * - Tenant-isolated import tracking
 * - Progress monitoring
 * - Error logging support
 * - Status-based filtering
 *
 * Architecture:
 * - All imports stored in tenant database (tenant-isolated)
 * - JSON storage for column mappings
 * - Optimized indexes for status and time-based queries
 */

import { Injectable } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { CsvImportRepository } from '../../../domain/repositories/csv-import.repository.interface';
import { CsvImport } from '../../../domain/csv/csv-import.entity';
import { ImportStatus } from '../../../domain/csv/value-objects/import-status.vo';
import { ColumnMapping } from '../../../domain/csv/value-objects/column-mapping.vo';
import { TenantDatabaseService } from '../tenant-database.service';
import * as tenantSchema from '../schema/tenant';

@Injectable()
export class CsvImportRepositoryImpl implements CsvImportRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  async save(csvImport: CsvImport): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(csvImport.tenantId);

    const row = this.toRow(csvImport);

    // Upsert: insert or update if exists
    await db
      .insert(tenantSchema.csvImports)
      .values(row)
      .onConflictDoUpdate({
        target: tenantSchema.csvImports.id,
        set: {
          status: row.status,
          rowsProcessed: row.rowsProcessed,
          rowsFailed: row.rowsFailed,
          rowsSkipped: row.rowsSkipped,
          errorSummary: row.errorSummary,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        },
      });
  }

  async findById(
    tenantId: string,
    importId: string,
  ): Promise<CsvImport | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.csvImports)
      .where(
        and(
          eq(tenantSchema.csvImports.id, importId),
          eq(tenantSchema.csvImports.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.toDomain(rows[0]);
  }

  async findByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: string;
    },
  ): Promise<CsvImport[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Build where conditions
    const conditions = [eq(tenantSchema.csvImports.tenantId, tenantId)];
    if (options?.status) {
      conditions.push(
        eq(
          tenantSchema.csvImports.status,
          options.status as 'queued' | 'processing' | 'completed' | 'failed',
        ),
      );
    }

    const queryBuilder = db
      .select()
      .from(tenantSchema.csvImports)
      .where(and(...conditions))
      .orderBy(desc(tenantSchema.csvImports.createdAt))
      .$dynamic();

    // Apply pagination
    const rows = await queryBuilder
      .limit(options?.limit ?? 1000)
      .offset(options?.offset ?? 0);

    return rows.map((row) => this.toDomain(row));
  }

  async countByTenant(tenantId: string, status?: string): Promise<number> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    // Build where conditions
    const conditions = [eq(tenantSchema.csvImports.tenantId, tenantId)];
    if (status) {
      conditions.push(
        eq(
          tenantSchema.csvImports.status,
          status as 'queued' | 'processing' | 'completed' | 'failed',
        ),
      );
    }

    const result = await db
      .select({ count: tenantSchema.csvImports.id })
      .from(tenantSchema.csvImports)
      .where(and(...conditions));

    return result.length;
  }

  async delete(tenantId: string, importId: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(tenantSchema.csvImports)
      .where(
        and(
          eq(tenantSchema.csvImports.id, importId),
          eq(tenantSchema.csvImports.tenantId, tenantId),
        ),
      );
  }

  async updateProgress(
    tenantId: string,
    importId: string,
    processed: number,
    failed: number,
    skipped: number,
  ): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .update(tenantSchema.csvImports)
      .set({
        rowsProcessed: processed,
        rowsFailed: failed,
        rowsSkipped: skipped,
      })
      .where(
        and(
          eq(tenantSchema.csvImports.id, importId),
          eq(tenantSchema.csvImports.tenantId, tenantId),
        ),
      );
  }

  // ============================================================================
  // Mappers (Domain ↔ Database)
  // ============================================================================

  /**
   * Convert database row to domain entity
   */
  private toDomain(row: tenantSchema.CsvImportRecord): CsvImport {
    const columnMapping = ColumnMapping.fromPersistence(
      row.columnMapping as {
        mappings: Array<{
          csvColumn: string;
          standardField: string;
          confidence: number;
        }>;
        detectedFormat?: string;
      },
    );

    // Map status string to ImportStatus value object
    let status: ImportStatus;
    switch (row.status) {
      case 'queued':
        status = ImportStatus.queued();
        break;
      case 'processing':
        status = ImportStatus.processing();
        break;
      case 'completed':
        status = ImportStatus.completed();
        break;
      case 'failed':
        status = ImportStatus.failed();
        break;
      default:
        status = ImportStatus.queued();
    }

    return CsvImport.fromPersistence({
      id: row.id,
      tenantId: row.tenantId,
      fileName: row.fileName,
      fileSizeBytes: row.fileSizeBytes,
      status,
      totalRows: row.totalRows,
      rowsProcessed: row.rowsProcessed,
      rowsFailed: row.rowsFailed,
      rowsSkipped: row.rowsSkipped,
      columnMapping,
      conflictStrategy: row.conflictStrategy,
      errorSummary: row.errorSummary ?? undefined,
      createdAt: row.createdAt,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      createdBy: row.createdBy,
    });
  }

  /**
   * Convert domain entity to database row
   */
  private toRow(csvImport: CsvImport): tenantSchema.NewCsvImportRecord {
    const props = csvImport.toPersistence();

    return {
      id: props.id,
      tenantId: props.tenantId,
      fileName: props.fileName,
      fileSizeBytes: props.fileSizeBytes,
      status: props.status.value as
        | 'queued'
        | 'processing'
        | 'completed'
        | 'failed',
      totalRows: props.totalRows,
      rowsProcessed: props.rowsProcessed,
      rowsFailed: props.rowsFailed,
      rowsSkipped: props.rowsSkipped,
      columnMapping: props.columnMapping.toJSON(),
      conflictStrategy: props.conflictStrategy,
      errorSummary: props.errorSummary ?? null,
      createdBy: props.createdBy,
      createdAt: props.createdAt,
      startedAt: props.startedAt ?? null,
      completedAt: props.completedAt ?? null,
    };
  }
}
