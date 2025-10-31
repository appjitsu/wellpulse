/**
 * Create SCADA Connection Command and Handler
 *
 * Creates a new SCADA connection configuration for a well to enable
 * automated data collection from RTU/PLC via OPC-UA protocol.
 */

import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IScadaConnectionRepository } from '../../../domain/repositories/scada-connection.repository.interface';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import {
  ScadaConnection,
  CreateScadaConnectionProps,
} from '../../../domain/scada/scada-connection.entity';
import {
  OpcUaEndpoint,
  OpcUaSecurityMode,
  OpcUaSecurityPolicy,
} from '../../../domain/scada/value-objects/opc-ua-endpoint.vo';

/**
 * Create SCADA Connection Command
 */
export class CreateScadaConnectionCommand {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly opcUaUrl: string,
    public readonly securityMode: OpcUaSecurityMode,
    public readonly securityPolicy: OpcUaSecurityPolicy,
    public readonly username: string | undefined,
    public readonly password: string | undefined,
    public readonly pollIntervalSeconds: number | undefined,
    public readonly userId: string,
  ) {}
}

/**
 * SCADA Connection DTO for response
 */
export interface ScadaConnectionDto {
  id: string;
  tenantId: string;
  wellId: string;
  name: string;
  description?: string;
  opcUaUrl: string;
  securityMode: string;
  securityPolicy: string;
  hasCredentials: boolean;
  pollIntervalSeconds: number;
  status: string;
  lastConnectedAt?: string;
  lastErrorMessage?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Create SCADA Connection Command Handler
 *
 * Business Rules:
 * - Well must exist and belong to tenant
 * - Well cannot have an existing SCADA connection
 * - Connection name must be unique within tenant
 * - OPC-UA endpoint must be valid
 * - Poll interval must be 1-300 seconds
 * - Only Admin and Manager roles can create connections (enforced at controller level)
 */
@Injectable()
@CommandHandler(CreateScadaConnectionCommand)
export class CreateScadaConnectionHandler
  implements ICommandHandler<CreateScadaConnectionCommand, ScadaConnectionDto>
{
  constructor(
    @Inject('IScadaConnectionRepository')
    private readonly scadaConnectionRepository: IScadaConnectionRepository,
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(
    command: CreateScadaConnectionCommand,
  ): Promise<ScadaConnectionDto> {
    // 1. Validate well exists
    const well = await this.wellRepository.findById(
      command.tenantId,
      command.wellId,
    );

    if (!well) {
      throw new NotFoundException(`Well with ID ${command.wellId} not found`);
    }

    // 2. Check if well already has a SCADA connection
    const existingConnection =
      await this.scadaConnectionRepository.findByWellId(
        command.tenantId,
        command.wellId,
      );

    if (existingConnection) {
      throw new ConflictException(
        `Well ${command.wellId} already has a SCADA connection`,
      );
    }

    // 3. Check if connection name already exists
    const nameExists = await this.scadaConnectionRepository.existsByName(
      command.tenantId,
      command.name,
    );

    if (nameExists) {
      throw new ConflictException(
        `SCADA connection with name "${command.name}" already exists`,
      );
    }

    // 4. Create OPC-UA endpoint value object (validates configuration)
    let endpoint: OpcUaEndpoint;
    try {
      endpoint = OpcUaEndpoint.create({
        url: command.opcUaUrl,
        securityMode: command.securityMode,
        securityPolicy: command.securityPolicy,
        username: command.username,
        password: command.password,
      });
    } catch (error) {
      throw new BadRequestException(
        `Invalid OPC-UA endpoint configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // 5. Create SCADA connection entity (validates business rules)
    const props: CreateScadaConnectionProps = {
      tenantId: command.tenantId,
      wellId: command.wellId,
      name: command.name,
      description: command.description,
      endpoint,
      pollIntervalSeconds: command.pollIntervalSeconds,
      createdBy: command.userId,
    };

    let connection: ScadaConnection;
    try {
      connection = ScadaConnection.create(props);
    } catch (error) {
      throw new BadRequestException(
        `Invalid SCADA connection configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // 6. Save to repository
    await this.scadaConnectionRepository.save(connection);

    // 7. Return DTO
    return this.toDto(connection);
  }

  /**
   * Convert domain entity to DTO
   */
  private toDto(connection: ScadaConnection): ScadaConnectionDto {
    return {
      id: connection.id,
      tenantId: connection.tenantId,
      wellId: connection.wellId,
      name: connection.name,
      description: connection.description,
      opcUaUrl: connection.endpoint.url,
      securityMode: connection.endpoint.securityMode,
      securityPolicy: connection.endpoint.securityPolicy,
      hasCredentials: connection.endpoint.hasCredentials,
      pollIntervalSeconds: connection.pollIntervalSeconds,
      status: connection.status,
      lastConnectedAt: connection.lastConnectedAt?.toISOString(),
      lastErrorMessage: connection.lastErrorMessage,
      isEnabled: connection.isEnabled,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      createdBy: connection.createdBy,
      updatedBy: connection.updatedBy,
    };
  }
}
