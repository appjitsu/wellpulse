/**
 * Delete Well Nominal Range Command and Handler
 *
 * Deletes a well-specific nominal range, reverting back to org-level or global default.
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';

/**
 * Delete Well Nominal Range Command
 */
export class DeleteWellNominalRangeCommand {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly rangeId: string,
    public readonly userId: string,
  ) {}
}

/**
 * Delete Well Nominal Range Command Handler
 *
 * Business Rules:
 * - Deletes well-specific override, causing well to fall back to org-level or global range
 * - Only Admin and Manager roles can delete well ranges (enforced at controller level)
 */
@Injectable()
@CommandHandler(DeleteWellNominalRangeCommand)
export class DeleteWellNominalRangeHandler
  implements ICommandHandler<DeleteWellNominalRangeCommand, void>
{
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
  ) {}

  async execute(command: DeleteWellNominalRangeCommand): Promise<void> {
    // Get all well ranges to verify this range exists
    const wellRanges = await this.nominalRangeRepository.findWellRanges(
      command.tenantId,
      command.wellId,
    );

    const rangeToDelete = wellRanges.find(
      (range) => range.id === command.rangeId,
    );

    if (!rangeToDelete) {
      throw new NotFoundException(
        `Well-specific nominal range with ID ${command.rangeId} not found for well ${command.wellId}`,
      );
    }

    // Delete the well-specific range
    await this.nominalRangeRepository.deleteWellRange(
      command.tenantId,
      command.wellId,
      command.rangeId,
    );
  }
}
