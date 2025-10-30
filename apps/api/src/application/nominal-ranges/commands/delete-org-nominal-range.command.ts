/**
 * Delete Organization Nominal Range Command and Handler
 *
 * Deletes an org-level nominal range, reverting back to global default.
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';

/**
 * Delete Org Nominal Range Command
 */
export class DeleteOrgNominalRangeCommand {
  constructor(
    public readonly tenantId: string,
    public readonly rangeId: string,
    public readonly userId: string,
  ) {}
}

/**
 * Delete Org Nominal Range Command Handler
 *
 * Business Rules:
 * - Deletes org-level override, causing well to fall back to global template
 * - Only Admin role can delete org ranges (enforced at controller level)
 * - Does not delete well-specific overrides (they continue using the deleted org range until removed)
 */
@Injectable()
@CommandHandler(DeleteOrgNominalRangeCommand)
export class DeleteOrgNominalRangeHandler
  implements ICommandHandler<DeleteOrgNominalRangeCommand, void>
{
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
  ) {}

  async execute(command: DeleteOrgNominalRangeCommand): Promise<void> {
    // Get all org ranges to verify this range exists
    const orgRanges = await this.nominalRangeRepository.findOrgRanges(
      command.tenantId,
    );

    const rangeToDelete = orgRanges.find(
      (range) => range.id === command.rangeId,
    );

    if (!rangeToDelete) {
      throw new NotFoundException(
        `Organization nominal range with ID ${command.rangeId} not found`,
      );
    }

    // Delete the org-level range
    await this.nominalRangeRepository.deleteOrgRange(
      command.tenantId,
      command.rangeId,
    );
  }
}
