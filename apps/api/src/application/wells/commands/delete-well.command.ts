/**
 * Delete Well Command and Handler
 *
 * Implements soft delete for wells (audit trail required).
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';

/**
 * Delete Well Command
 */
export class DeleteWellCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly wellId: string,
    public readonly databaseName?: string,
  ) {}
}

/**
 * Delete Well Command Handler
 *
 * Business Rules:
 * - Soft delete only (sets deletedAt timestamp)
 * - Only Admin role can delete wells (enforced at controller level)
 * - Well must exist before deletion
 */
@Injectable()
@CommandHandler(DeleteWellCommand)
export class DeleteWellHandler implements ICommandHandler<DeleteWellCommand> {
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(command: DeleteWellCommand): Promise<void> {
    // 1. Verify well exists
    const well = await this.wellRepository.findById(
      command.tenantId,
      command.wellId,
      command.databaseName,
    );

    if (!well) {
      throw new NotFoundException('Well not found');
    }

    // 2. Soft delete (repository handles setting deletedAt timestamp)
    await this.wellRepository.delete(
      command.tenantId,
      command.wellId,
      command.userId,
      command.databaseName,
    );
  }
}
