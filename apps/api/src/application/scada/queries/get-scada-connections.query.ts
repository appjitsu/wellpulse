/**
 * Get SCADA Connections Query and Handler
 *
 * Retrieves all SCADA connections for a tenant, optionally filtered by status or well ID.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IScadaConnectionRepository } from '../../../domain/repositories/scada-connection.repository.interface';
import { ScadaConnection } from '../../../domain/scada/scada-connection.entity';

/**
 * Get SCADA Connections Query
 */
export class GetScadaConnectionsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId?: string,
    public readonly onlyEnabled?: boolean,
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
  isHealthy: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Get SCADA Connections Query Result
 */
export interface GetScadaConnectionsResult {
  connections: ScadaConnectionDto[];
  count: number;
}

/**
 * Get SCADA Connections Query Handler
 *
 * Returns all SCADA connections for a tenant with optional filtering.
 * Used for connection management UI and well detail pages.
 */
@Injectable()
@QueryHandler(GetScadaConnectionsQuery)
export class GetScadaConnectionsHandler
  implements IQueryHandler<GetScadaConnectionsQuery>
{
  constructor(
    @Inject('IScadaConnectionRepository')
    private readonly scadaConnectionRepository: IScadaConnectionRepository,
  ) {}

  async execute(
    query: GetScadaConnectionsQuery,
  ): Promise<GetScadaConnectionsResult> {
    let connections: ScadaConnection[];

    // Get connections based on filters
    if (query.wellId) {
      const connection = await this.scadaConnectionRepository.findByWellId(
        query.tenantId,
        query.wellId,
      );
      connections = connection ? [connection] : [];
    } else if (query.onlyEnabled) {
      connections = await this.scadaConnectionRepository.findEnabled(
        query.tenantId,
      );
    } else {
      connections = await this.scadaConnectionRepository.findAll(
        query.tenantId,
      );
    }

    // Convert to DTOs
    const dtos = connections.map((connection) => this.toDto(connection));

    return {
      connections: dtos,
      count: dtos.length,
    };
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
      isHealthy: connection.isHealthy(60000), // 60 second staleness threshold
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      createdBy: connection.createdBy,
      updatedBy: connection.updatedBy,
    };
  }
}
