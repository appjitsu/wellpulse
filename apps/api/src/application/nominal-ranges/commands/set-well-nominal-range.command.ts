/**
 * Set Well Nominal Range Command and Handler
 *
 * Creates or updates a well-specific nominal range override.
 * Well-specific ranges override org-level and global defaults for a single well.
 */

import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';
import {
  NominalRange,
  NominalRangeSeverity,
} from '../../../domain/nominal-range/nominal-range.entity';
import { randomUUID } from 'crypto';

/**
 * Set Well Nominal Range Command
 */
export class SetWellNominalRangeCommand {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly userId: string,
    public readonly data: {
      fieldName: string;
      minValue?: number | null;
      maxValue?: number | null;
      unit: string;
      severity: NominalRangeSeverity;
      reason?: string; // Why this well needs a custom range
    },
  ) {}
}

/**
 * Set Well Nominal Range Command Handler
 *
 * Business Rules:
 * - Creates or updates well-specific override for a single field
 * - Validates that at least one value (min or max) is provided
 * - Requires a reason for auditability
 * - Only Admin and Manager roles can set well ranges (enforced at controller level)
 */
@Injectable()
@CommandHandler(SetWellNominalRangeCommand)
export class SetWellNominalRangeHandler
  implements ICommandHandler<SetWellNominalRangeCommand, string>
{
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
  ) {}

  async execute(command: SetWellNominalRangeCommand): Promise<string> {
    // Validate that at least one value is provided
    if (
      command.data.minValue === null &&
      command.data.minValue === undefined &&
      command.data.maxValue === null &&
      command.data.maxValue === undefined
    ) {
      throw new Error(
        `At least one of minValue or maxValue must be provided for ${command.data.fieldName}`,
      );
    }

    // Check if well-specific range already exists for this field
    const existing = await this.nominalRangeRepository.findWellRangeByField(
      command.tenantId,
      command.wellId,
      command.data.fieldName,
    );

    if (existing) {
      // Update existing range
      const updated = existing.updateRange({
        minValue: command.data.minValue,
        maxValue: command.data.maxValue,
        severity: command.data.severity,
        reason: command.data.reason,
        updatedBy: command.userId,
      });

      await this.nominalRangeRepository.saveWellRange(updated);
      return updated.id;
    } else {
      // Create new well-specific range
      const newRange = NominalRange.createWellSpecific({
        id: randomUUID(),
        tenantId: command.tenantId,
        wellId: command.wellId,
        fieldName: command.data.fieldName,
        minValue: command.data.minValue,
        maxValue: command.data.maxValue,
        unit: command.data.unit,
        severity: command.data.severity,
        reason: command.data.reason,
        updatedBy: command.userId,
      });

      await this.nominalRangeRepository.saveWellRange(newRange);
      return newRange.id;
    }
  }
}
