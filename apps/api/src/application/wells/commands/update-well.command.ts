/**
 * Update Well Command and Handler
 *
 * Implements well update with partial updates support.
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';

/**
 * Update Well Command
 */
export class UpdateWellCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly wellId: string,
    public readonly data: {
      name?: string;
      latitude?: number;
      longitude?: number;
      lease?: string;
      field?: string;
      operator?: string;
      spudDate?: string;
      completionDate?: string;
      metadata?: Record<string, any>;
    },
    public readonly databaseName?: string,
  ) {}
}

/**
 * Update Well Command Handler
 *
 * Business Rules:
 * - Well must exist
 * - API number cannot be changed (immutable identifier)
 * - Updates through domain entity methods ensure business rules
 * - Only Admin and Manager roles can update wells (enforced at controller level)
 */
@Injectable()
@CommandHandler(UpdateWellCommand)
export class UpdateWellHandler implements ICommandHandler<UpdateWellCommand> {
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(command: UpdateWellCommand): Promise<void> {
    // 1. Load existing well
    const well = await this.wellRepository.findById(
      command.tenantId,
      command.wellId,
      command.databaseName,
    );

    if (!well) {
      throw new NotFoundException('Well not found');
    }

    // 2. Apply updates through domain entity methods (enforces business rules)
    if (command.data.name !== undefined) {
      well.updateName(command.data.name, command.userId);
    }

    if (
      command.data.latitude !== undefined &&
      command.data.longitude !== undefined
    ) {
      well.updateLocation(
        command.data.latitude,
        command.data.longitude,
        command.userId,
      );
    }

    if (command.data.lease !== undefined) {
      well.updateLease(command.data.lease, command.userId);
    }

    if (command.data.field !== undefined) {
      well.updateField(command.data.field, command.userId);
    }

    if (command.data.operator !== undefined) {
      well.updateOperator(command.data.operator, command.userId);
    }

    if (command.data.spudDate !== undefined) {
      well.updateSpudDate(new Date(command.data.spudDate), command.userId);
    }

    if (command.data.completionDate !== undefined) {
      well.updateCompletionDate(
        new Date(command.data.completionDate),
        command.userId,
      );
    }

    if (command.data.metadata !== undefined) {
      well.updateMetadata(command.data.metadata, command.userId);
    }

    // 3. Persist changes
    await this.wellRepository.update(
      command.tenantId,
      well,
      command.databaseName,
    );
  }
}
