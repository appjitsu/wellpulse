/**
 * Record SCADA Reading Command and Handler
 *
 * Implements recording of individual SCADA readings from RTU/PLC devices.
 */

import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IScadaReadingRepository } from '../../../../domain/repositories/scada-reading.repository.interface';
import {
  ScadaReading,
  ReadingQuality,
} from '../../../../domain/scada/scada-reading.entity';

/**
 * Record SCADA Reading Command
 */
export class RecordScadaReadingCommand {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly scadaConnectionId: string,
    public readonly tagName: string,
    public readonly value: number | string | boolean,
    public readonly quality?: ReadingQuality,
    public readonly timestamp?: Date,
    public readonly unit?: string,
    public readonly minValue?: number,
    public readonly maxValue?: number,
    public readonly metadata?: Record<string, unknown>,
  ) {}
}

/**
 * Record SCADA Reading Command Handler
 *
 * Business Rules:
 * - Readings are immutable (append-only time-series data)
 * - Auto-detects quality based on value and range
 * - Out-of-range values are flagged as OUT_OF_RANGE quality
 * - Used by SCADA polling service to record real-time data
 * - Supports batch processing for high-frequency data
 */
@Injectable()
@CommandHandler(RecordScadaReadingCommand)
export class RecordScadaReadingHandler
  implements ICommandHandler<RecordScadaReadingCommand, string>
{
  constructor(
    @Inject('IScadaReadingRepository')
    private readonly scadaReadingRepository: IScadaReadingRepository,
  ) {}

  async execute(command: RecordScadaReadingCommand): Promise<string> {
    // 1. Create domain entity (validates business rules and auto-detects quality)
    const reading = ScadaReading.create({
      tenantId: command.tenantId,
      wellId: command.wellId,
      scadaConnectionId: command.scadaConnectionId,
      tagName: command.tagName,
      value: command.value,
      quality: command.quality,
      timestamp: command.timestamp,
      unit: command.unit,
      minValue: command.minValue,
      maxValue: command.maxValue,
      metadata: command.metadata,
    });

    // 2. Save to time-series database (append-only)
    await this.scadaReadingRepository.create(reading);

    return reading.id;
  }
}
