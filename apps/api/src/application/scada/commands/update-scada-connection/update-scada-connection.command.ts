/**
 * Update SCADA Connection Command and Handler
 *
 * Implements SCADA connection update with partial updates support.
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IScadaConnectionRepository } from '../../../../domain/repositories/scada-connection.repository.interface';
import {
  OpcUaEndpoint,
  OpcUaEndpointProps,
} from '../../../../domain/scada/value-objects/opc-ua-endpoint.vo';

/**
 * Update SCADA Connection Command
 */
export class UpdateScadaConnectionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly connectionId: string,
    public readonly updatedBy: string,
    public readonly name?: string,
    public readonly description?: string,
    public readonly endpoint?: OpcUaEndpointProps,
    public readonly pollIntervalSeconds?: number,
    public readonly isEnabled?: boolean,
  ) {}
}

/**
 * Update SCADA Connection Command Handler
 *
 * Business Rules:
 * - Connection must exist
 * - Updates through domain entity methods ensure business rules
 * - Endpoint changes reset connection status to inactive
 * - Only Admin and Manager roles can update connections (enforced at controller level)
 */
@Injectable()
@CommandHandler(UpdateScadaConnectionCommand)
export class UpdateScadaConnectionHandler
  implements ICommandHandler<UpdateScadaConnectionCommand, string>
{
  constructor(
    @Inject('IScadaConnectionRepository')
    private readonly scadaConnectionRepository: IScadaConnectionRepository,
  ) {}

  async execute(command: UpdateScadaConnectionCommand): Promise<string> {
    // 1. Load existing connection
    const connection = await this.scadaConnectionRepository.findById(
      command.tenantId,
      command.connectionId,
    );

    if (!connection) {
      throw new NotFoundException('SCADA connection not found');
    }

    // 2. Build update props
    const updateProps: {
      name?: string;
      description?: string;
      endpoint?: OpcUaEndpoint;
      pollIntervalSeconds?: number;
      isEnabled?: boolean;
      updatedBy: string;
    } = {
      updatedBy: command.updatedBy,
    };

    if (command.name !== undefined) {
      updateProps.name = command.name;
    }

    if (command.description !== undefined) {
      updateProps.description = command.description;
    }

    if (command.endpoint !== undefined) {
      // Create OPC-UA endpoint value object (validates endpoint configuration)
      updateProps.endpoint = OpcUaEndpoint.create(command.endpoint);
    }

    if (command.pollIntervalSeconds !== undefined) {
      updateProps.pollIntervalSeconds = command.pollIntervalSeconds;
    }

    if (command.isEnabled !== undefined) {
      updateProps.isEnabled = command.isEnabled;
    }

    // 3. Apply updates through domain entity method (enforces business rules)
    connection.update(updateProps);

    // 4. Persist changes
    await this.scadaConnectionRepository.save(connection);

    return connection.id;
  }
}
