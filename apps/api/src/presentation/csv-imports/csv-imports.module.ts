/**
 * CSV Imports Module
 *
 * Wires together the CSV import presentation layer.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bull';
import { CsvImportsController } from './csv-imports.controller';
import {
  CreateCsvImportHandler,
  ProcessCsvImportHandler,
  UpdateImportProgressHandler,
} from '../../application/csv-imports';
import {
  GetCsvImportHandler,
  GetCsvImportsHandler,
} from '../../application/csv-imports';
import { CsvImportRepositoryImpl } from '../../infrastructure/database/repositories/csv-import.repository';
import { TenantDatabaseService } from '../../infrastructure/database/tenant-database.service';
import { CsvImportProcessor } from '../../infrastructure/jobs/csv-import.processor';
import { CsvParserService } from '../../infrastructure/services/csv-parser.service';
import { ColumnMappingDetectorService } from '../../infrastructure/services/column-mapping-detector.service';
import { ProductionDataValidatorService } from '../../infrastructure/services/production-data-validator.service';
import { AzureBlobStorageService } from '../../infrastructure/services/azure-blob-storage.service';

const commandHandlers = [
  CreateCsvImportHandler,
  ProcessCsvImportHandler,
  UpdateImportProgressHandler,
];

const queryHandlers = [GetCsvImportHandler, GetCsvImportsHandler];

@Module({
  imports: [
    CqrsModule,
    // Import BullModule to inject the csv-import queue (registered globally in app.module.ts)
    BullModule.registerQueue({ name: 'csv-import' }),
  ],
  controllers: [CsvImportsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    {
      provide: 'CsvImportRepository',
      useClass: CsvImportRepositoryImpl,
    },
    {
      provide: 'FileStorageService',
      useClass: AzureBlobStorageService,
    },
    TenantDatabaseService,
    // Background job processor
    CsvImportProcessor,
    // CSV processing services
    CsvParserService,
    ColumnMappingDetectorService,
    ProductionDataValidatorService,
  ],
  exports: [],
})
export class CsvImportsModule {}
