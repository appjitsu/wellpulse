/**
 * Process CSV Import Command and Handler
 *
 * Background job command to process CSV import row by row.
 * Parses CSV, validates data, and imports field entries.
 */

import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CsvImportRepository } from '../../../domain/repositories/csv-import.repository.interface';
import type { CsvImportJob } from '../../../infrastructure/jobs/csv-import.processor';

/**
 * Process CSV Import Command
 *
 * This command is typically executed by a background job processor.
 */
export class ProcessCsvImportCommand {
  constructor(
    public readonly tenantId: string,
    public readonly importId: string,
    public readonly databaseName?: string,
  ) {}
}

/**
 * Process CSV Import Command Handler
 *
 * Business Rules:
 * - Import must be in 'queued' status to start processing
 * - Processes CSV row by row with progress updates
 * - Handles validation errors gracefully
 * - Transitions to 'completed' or 'failed' based on outcome
 *
 * Note: The actual CSV parsing and field entry creation logic
 * will be implemented in infrastructure services.
 */
@Injectable()
@CommandHandler(ProcessCsvImportCommand)
export class ProcessCsvImportHandler
  implements ICommandHandler<ProcessCsvImportCommand, void>
{
  private readonly logger = new Logger(ProcessCsvImportHandler.name);

  constructor(
    @Inject('CsvImportRepository')
    private readonly csvImportRepository: CsvImportRepository,
    @InjectQueue('csv-import')
    private readonly csvImportQueue: Queue<CsvImportJob>,
  ) {}

  async execute(command: ProcessCsvImportCommand): Promise<void> {
    // 1. Get import record
    const csvImport = await this.csvImportRepository.findById(
      command.tenantId,
      command.importId,
    );

    if (!csvImport) {
      throw new NotFoundException(
        `CSV import ${command.importId} not found for tenant ${command.tenantId}`,
      );
    }

    // 2. Add job to queue for background processing
    try {
      const job = await this.csvImportQueue.add(
        'process-csv-import',
        {
          tenantId: command.tenantId,
          importId: command.importId,
          filePath: csvImport.fileName, // Assuming fileName contains storage path
          databaseName: command.databaseName ?? '',
        },
        {
          attempts: 3, // Retry up to 3 times on failure
          backoff: {
            type: 'exponential',
            delay: 5000, // Start with 5 second delay
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 500, // Keep last 500 failed jobs
        },
      );

      this.logger.log(
        `Queued CSV import ${command.importId} for processing (job ${job.id})`,
      );
    } catch (error) {
      // Mark import as failed with error summary
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      csvImport.markFailed(errorMessage);
      await this.csvImportRepository.save(csvImport);
      throw error;
    }
  }
}
