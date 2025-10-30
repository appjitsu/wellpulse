/**
 * Update Organization Nominal Ranges Command and Handler
 *
 * Updates or creates multiple org-level nominal ranges for a tenant.
 * Org-level ranges override global templates for all wells in the organization.
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
 * Update Org Nominal Ranges Command
 */
export class UpdateOrgNominalRangesCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly ranges: Array<{
      fieldName: string;
      wellType?: string | null;
      minValue?: number | null;
      maxValue?: number | null;
      unit: string;
      severity: NominalRangeSeverity;
    }>,
  ) {}
}

/**
 * Update Org Nominal Ranges Command Handler
 *
 * Business Rules:
 * - Creates or updates org-level overrides for global templates
 * - Validates that at least one value (min or max) is provided
 * - Only Admin and Manager roles can update org ranges (enforced at controller level)
 */
@Injectable()
@CommandHandler(UpdateOrgNominalRangesCommand)
export class UpdateOrgNominalRangesHandler
  implements ICommandHandler<UpdateOrgNominalRangesCommand, void>
{
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
  ) {}

  async execute(command: UpdateOrgNominalRangesCommand): Promise<void> {
    for (const rangeData of command.ranges) {
      // Validate that at least one value is provided
      if (
        rangeData.minValue === null &&
        rangeData.minValue === undefined &&
        rangeData.maxValue === null &&
        rangeData.maxValue === undefined
      ) {
        throw new Error(
          `At least one of minValue or maxValue must be provided for ${rangeData.fieldName}`,
        );
      }

      // Check if org-level range already exists for this field + wellType
      const existing = await this.nominalRangeRepository.findOrgRangeByField(
        command.tenantId,
        rangeData.fieldName,
        rangeData.wellType,
      );

      if (existing) {
        // Update existing range
        const updated = existing.updateRange({
          minValue: rangeData.minValue,
          maxValue: rangeData.maxValue,
          severity: rangeData.severity,
          updatedBy: command.userId,
        });

        await this.nominalRangeRepository.saveOrgRange(updated);
      } else {
        // Create new org-level range
        const newRange = NominalRange.createOrgLevel({
          id: randomUUID(),
          tenantId: command.tenantId,
          fieldName: rangeData.fieldName,
          wellType: rangeData.wellType,
          minValue: rangeData.minValue,
          maxValue: rangeData.maxValue,
          unit: rangeData.unit,
          severity: rangeData.severity,
          updatedBy: command.userId,
        });

        await this.nominalRangeRepository.saveOrgRange(newRange);
      }
    }
  }
}
