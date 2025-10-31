/**
 * Create CSV Import Command and Handler
 *
 * Creates a new CSV import record after file upload.
 * The file should already be uploaded to storage before creating the import.
 */

import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CsvImportRepository } from '../../../domain/repositories/csv-import.repository.interface';
import { CsvImport } from '../../../domain/csv/csv-import.entity';
import { ImportStatus } from '../../../domain/csv/value-objects/import-status.vo';
import {
  ColumnMapping,
  type ColumnMappingProps,
} from '../../../domain/csv/value-objects/column-mapping.vo';

/**
 * Create CSV Import Command
 */
export class CreateCsvImportCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly data: {
      fileName: string;
      fileSizeBytes: number;
      totalRows: number;
      columnMapping: ColumnMappingProps;
      conflictStrategy: 'skip' | 'overwrite' | 'merge';
    },
    public readonly databaseName?: string,
  ) {}
}

/**
 * Create CSV Import Command Handler
 *
 * Business Rules:
 * - Creates import in 'queued' status
 * - Validates column mappings
 * - Only authenticated users can create imports
 */
@Injectable()
@CommandHandler(CreateCsvImportCommand)
export class CreateCsvImportHandler
  implements ICommandHandler<CreateCsvImportCommand, string>
{
  constructor(
    @Inject('CsvImportRepository')
    private readonly csvImportRepository: CsvImportRepository,
  ) {}

  async execute(command: CreateCsvImportCommand): Promise<string> {
    // 1. Create column mapping value object
    const columnMapping = ColumnMapping.fromPersistence(
      command.data.columnMapping,
    );

    // 2. Create domain entity (starts in 'queued' status)
    const csvImport = CsvImport.create({
      tenantId: command.tenantId,
      fileName: command.data.fileName,
      fileSizeBytes: command.data.fileSizeBytes,
      status: ImportStatus.queued(),
      totalRows: command.data.totalRows,
      rowsProcessed: 0,
      rowsFailed: 0,
      rowsSkipped: 0,
      columnMapping,
      conflictStrategy: command.data.conflictStrategy,
      createdBy: command.userId,
    });

    // 3. Save to database
    await this.csvImportRepository.save(csvImport);

    return csvImport.id;
  }
}
