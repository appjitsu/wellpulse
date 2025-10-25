/**
 * Activate Well Command and Handler
 *
 * Changes well status to ACTIVE.
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';

/**
 * Activate Well Command
 */
export class ActivateWellCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly wellId: string,
    public readonly databaseName?: string,
  ) {}
}

/**
 * Activate Well Command Handler
 *
 * Business Rules:
 * - Well must exist
 * - Cannot activate plugged well (enforced by entity)
 * - Only Admin and Manager roles can activate wells (enforced at controller level)
 */
@Injectable()
@CommandHandler(ActivateWellCommand)
export class ActivateWellHandler
  implements ICommandHandler<ActivateWellCommand>
{
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(command: ActivateWellCommand): Promise<void> {
    // 1. Load well
    const well = await this.wellRepository.findById(
      command.tenantId,
      command.wellId,
      command.databaseName,
    );

    if (!well) {
      throw new NotFoundException('Well not found');
    }

    // 2. Activate (domain entity enforces business rules)
    well.activate(command.userId);

    // 3. Persist changes
    await this.wellRepository.update(
      command.tenantId,
      well,
      command.databaseName,
    );
  }
}
