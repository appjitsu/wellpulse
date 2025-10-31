/**
 * CSV Import Processor
 *
 * Background job processor for CSV import tasks.
 * Handles CSV parsing, validation, and field entry creation.
 */

import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { CsvImportRepository } from '../../domain/repositories/csv-import.repository.interface';
import { IFileStorageService } from '../../domain/services/file-storage.service.interface';
import { CsvParserService } from '../services/csv-parser.service';
import { ColumnMappingDetectorService } from '../services/column-mapping-detector.service';
import { ProductionDataValidatorService } from '../services/production-data-validator.service';

export interface CsvImportJob {
  tenantId: string;
  importId: string;
  filePath: string; // Path in blob storage
  databaseName: string;
}

@Processor('csv-import')
@Injectable()
export class CsvImportProcessor {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    @Inject('CsvImportRepository')
    private readonly csvImportRepository: CsvImportRepository,
    @Inject('FileStorageService')
    private readonly fileStorage: IFileStorageService,
    private readonly csvParser: CsvParserService,
    private readonly mappingDetector: ColumnMappingDetectorService,
    private readonly dataValidator: ProductionDataValidatorService,
  ) {}

  /**
   * Process CSV import job
   */
  @Process('process-csv-import')
  async handleCsvImport(job: Job<CsvImportJob>): Promise<void> {
    const { tenantId, importId, filePath } = job.data;

    this.logger.log(
      `Processing CSV import ${importId} for tenant ${tenantId} (job ${job.id})`,
    );

    try {
      // 1. Get import record
      const csvImport = await this.csvImportRepository.findById(
        tenantId,
        importId,
      );

      if (!csvImport) {
        throw new Error(`Import ${importId} not found`);
      }

      // 2. Start processing
      csvImport.startProcessing();
      await this.csvImportRepository.save(csvImport);

      // 3. Download CSV file from storage
      await job.progress(10);
      this.logger.debug(`Downloading CSV file: ${filePath}`);
      const downloadResult = await this.fileStorage.downloadFile(filePath);
      const fileContent = downloadResult.buffer.toString('utf-8');

      // 4. Parse CSV
      await job.progress(20);
      this.logger.debug('Parsing CSV content...');
      const parseResult = await this.csvParser.parse(fileContent);

      if (parseResult.errors.length > 0) {
        this.logger.warn(`CSV parsing had ${parseResult.errors.length} errors`);
      }

      // 5. Validate and process rows
      await job.progress(30);
      const totalRows = parseResult.data.length;
      let processed = 0;
      let failed = 0;
      const skipped = 0;

      this.logger.log(`Processing ${totalRows} rows...`);

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];

        // Validate row
        const validationResult = this.dataValidator.validate(row, i + 1);

        if (!validationResult.valid) {
          failed++;
          this.logger.warn(
            `Row ${i + 1} validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`,
          );
          // TODO: Log error to csv_import_errors table
          continue;
        }

        // TODO: Create field entry from validated row
        // For now, just count as processed
        processed++;

        // Update progress every 100 rows
        if ((i + 1) % 100 === 0) {
          await this.csvImportRepository.updateProgress(
            tenantId,
            importId,
            processed,
            failed,
            skipped,
          );

          const progress = 30 + Math.floor(((i + 1) / totalRows) * 60);
          await job.progress(progress);
        }
      }

      // 6. Final progress update
      await this.csvImportRepository.updateProgress(
        tenantId,
        importId,
        processed,
        failed,
        skipped,
      );

      // 7. Mark as completed
      await job.progress(100);
      csvImport.markComplete();
      await this.csvImportRepository.save(csvImport);

      this.logger.log(
        `CSV import ${importId} completed: ${processed} processed, ${failed} failed, ${skipped} skipped`,
      );
    } catch (error) {
      this.logger.error(
        `CSV import ${importId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Mark import as failed
      const csvImport = await this.csvImportRepository.findById(
        tenantId,
        importId,
      );

      if (csvImport) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        csvImport.markFailed(errorMessage);
        await this.csvImportRepository.save(csvImport);
      }

      throw error; // Re-throw to mark job as failed
    }
  }
}
