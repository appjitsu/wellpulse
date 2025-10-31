/**
 * Get CSV Imports Query and Handler
 *
 * Retrieves paginated list of CSV imports with optional filters.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CsvImportRepository } from '../../../domain/repositories/csv-import.repository.interface';
import { CsvImport } from '../../../domain/csv/csv-import.entity';
import type { CsvImportDto } from './get-csv-import.query';

/**
 * Get CSV Imports Query
 */
export class GetCsvImportsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters?: {
      status?: 'queued' | 'processing' | 'completed' | 'failed';
      limit?: number;
      offset?: number;
      databaseName?: string;
    },
  ) {}
}

/**
 * Get CSV Imports Query Result
 */
export interface GetCsvImportsResult {
  imports: CsvImportDto[];
  total: number;
}

/**
 * Get CSV Imports Query Handler
 */
@Injectable()
@QueryHandler(GetCsvImportsQuery)
export class GetCsvImportsHandler implements IQueryHandler<GetCsvImportsQuery> {
  constructor(
    @Inject('CsvImportRepository')
    private readonly csvImportRepository: CsvImportRepository,
  ) {}

  async execute(query: GetCsvImportsQuery): Promise<GetCsvImportsResult> {
    // 1. Get imports with filters
    const imports = await this.csvImportRepository.findByTenant(
      query.tenantId,
      query.filters,
    );

    // 2. Get total count (for pagination)
    const total = await this.csvImportRepository.countByTenant(
      query.tenantId,
      query.filters?.status,
    );

    return {
      imports: imports.map((csvImport) => this.toDto(csvImport)),
      total,
    };
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
