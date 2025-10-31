/**
 * Get CSV Import Query and Handler
 *
 * Retrieves a single CSV import by ID with full details.
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CsvImportRepository } from '../../../domain/repositories/csv-import.repository.interface';
import { CsvImport } from '../../../domain/csv/csv-import.entity';
import type { ColumnMappingProps } from '../../../domain/csv/value-objects/column-mapping.vo';

/**
 * Get CSV Import Query
 */
export class GetCsvImportQuery {
  constructor(
    public readonly tenantId: string,
    public readonly importId: string,
    public readonly databaseName?: string,
  ) {}
}

/**
 * CSV Import DTO for response
 */
export interface CsvImportDto {
  id: string;
  tenantId: string;
  fileName: string;
  fileSizeBytes: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  rowsProcessed: number;
  rowsFailed: number;
  rowsSkipped: number;
  columnMapping: ColumnMappingProps;
  conflictStrategy: 'skip' | 'overwrite' | 'merge';
  errorSummary: string | null;
  progress: number; // 0-100
  estimatedSecondsRemaining: number | null;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Get CSV Import Query Handler
 */
@Injectable()
@QueryHandler(GetCsvImportQuery)
export class GetCsvImportHandler implements IQueryHandler<GetCsvImportQuery> {
  constructor(
    @Inject('CsvImportRepository')
    private readonly csvImportRepository: CsvImportRepository,
  ) {}

  async execute(query: GetCsvImportQuery): Promise<CsvImportDto> {
    const csvImport = await this.csvImportRepository.findById(
      query.tenantId,
      query.importId,
    );

    if (!csvImport) {
      throw new NotFoundException(
        `CSV import ${query.importId} not found for tenant ${query.tenantId}`,
      );
    }

    return this.toDto(csvImport);
  }

  /**
   * Convert domain entity to DTO (plain object for presentation layer)
   */
  private toDto(csvImport: CsvImport): CsvImportDto {
    return {
      id: csvImport.id,
      tenantId: csvImport.tenantId,
      fileName: csvImport.fileName,
      fileSizeBytes: csvImport.fileSizeBytes,
      status: csvImport.status.value,
      totalRows: csvImport.totalRows,
      rowsProcessed: csvImport.rowsProcessed,
      rowsFailed: csvImport.rowsFailed,
      rowsSkipped: csvImport.rowsSkipped,
      columnMapping: csvImport.columnMapping.toJSON(),
      conflictStrategy: csvImport.conflictStrategy,
      errorSummary: csvImport.errorSummary ?? null,
      progress: csvImport.getProgress(),
      estimatedSecondsRemaining: csvImport.getEstimatedSecondsRemaining(),
      createdBy: csvImport.createdBy,
      createdAt: csvImport.createdAt.toISOString(),
      startedAt: csvImport.startedAt ? csvImport.startedAt.toISOString() : null,
      completedAt: csvImport.completedAt
        ? csvImport.completedAt.toISOString()
        : null,
    };
  }
}
