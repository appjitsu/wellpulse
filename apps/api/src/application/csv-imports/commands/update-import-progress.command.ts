/**
 * Update Import Progress Command and Handler
 *
 * Updates progress counters during CSV processing.
 * Called periodically by the background processor.
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CsvImportRepository } from '../../../domain/repositories/csv-import.repository.interface';

/**
 * Update Import Progress Command
 */
export class UpdateImportProgressCommand {
  constructor(
    public readonly tenantId: string,
    public readonly importId: string,
    public readonly progress: {
      rowsProcessed: number;
      rowsFailed: number;
      rowsSkipped: number;
    },
    public readonly databaseName?: string,
  ) {}
}

/**
 * Update Import Progress Command Handler
 *
 * Business Rules:
 * - Import must be in 'processing' status
 * - Progress counters are incremental (added to existing values)
 * - Used for real-time progress tracking in UI
 */
@Injectable()
@CommandHandler(UpdateImportProgressCommand)
export class UpdateImportProgressHandler
  implements ICommandHandler<UpdateImportProgressCommand, void>
{
  constructor(
    @Inject('CsvImportRepository')
    private readonly csvImportRepository: CsvImportRepository,
  ) {}

  async execute(command: UpdateImportProgressCommand): Promise<void> {
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

    // 2. Update progress through domain entity
    csvImport.updateProgress(
      command.progress.rowsProcessed,
      command.progress.rowsFailed,
      command.progress.rowsSkipped,
    );

    // 3. Save updated entity
    await this.csvImportRepository.save(csvImport);
  }
}
