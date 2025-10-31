/**
 * Delete SCADA Connection Command and Handler
 *
 * Implements SCADA connection deletion.
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IScadaConnectionRepository } from '../../../../domain/repositories/scada-connection.repository.interface';

/**
 * Delete SCADA Connection Command
 */
export class DeleteScadaConnectionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly connectionId: string,
  ) {}
}

/**
 * Delete SCADA Connection Command Handler
 *
 * Business Rules:
 * - Connection must exist before deletion
 * - Deletes connection and cascades to related tag mappings
 * - Historical readings are preserved for audit trail
 * - Only Admin and Manager roles can delete connections (enforced at controller level)
 */
@Injectable()
@CommandHandler(DeleteScadaConnectionCommand)
export class DeleteScadaConnectionHandler
  implements ICommandHandler<DeleteScadaConnectionCommand, void>
{
  constructor(
    @Inject('IScadaConnectionRepository')
    private readonly scadaConnectionRepository: IScadaConnectionRepository,
  ) {}

  async execute(command: DeleteScadaConnectionCommand): Promise<void> {
    // 1. Verify connection exists
    const connection = await this.scadaConnectionRepository.findById(
      command.tenantId,
      command.connectionId,
    );

    if (!connection) {
      throw new NotFoundException('SCADA connection not found');
    }

    // 2. Delete connection (repository handles cascading deletes)
    await this.scadaConnectionRepository.delete(
      command.tenantId,
      command.connectionId,
    );
  }
}
