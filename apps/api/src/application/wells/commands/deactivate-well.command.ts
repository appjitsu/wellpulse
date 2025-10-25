/**
 * Deactivate Well Command and Handler
 *
 * Changes well status to INACTIVE.
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';

/**
 * Deactivate Well Command
 */
export class DeactivateWellCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly wellId: string,
    public readonly databaseName?: string,
  ) {}
}

/**
 * Deactivate Well Command Handler
 *
 * Business Rules:
 * - Well must exist
 * - Only Admin and Manager roles can deactivate wells (enforced at controller level)
 */
@Injectable()
@CommandHandler(DeactivateWellCommand)
export class DeactivateWellHandler
  implements ICommandHandler<DeactivateWellCommand>
{
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(command: DeactivateWellCommand): Promise<void> {
    // 1. Load well
    const well = await this.wellRepository.findById(
      command.tenantId,
      command.wellId,
      command.databaseName,
    );

    if (!well) {
      throw new NotFoundException('Well not found');
    }

    // 2. Deactivate (domain entity method)
    well.deactivate(command.userId);

    // 3. Persist changes
    await this.wellRepository.update(
      command.tenantId,
      well,
      command.databaseName,
    );
  }
}
