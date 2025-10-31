/**
 * Get SCADA Connections Query Handler
 *
 * Retrieves all SCADA connections for a tenant, optionally filtered by well ID.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IScadaConnectionRepository } from '../../../../domain/repositories/scada-connection.repository.interface';
import { ScadaConnectionDto } from '../../dto/scada-connection.dto';
import { GetScadaConnectionsQuery } from './get-scada-connections.query';

@Injectable()
@QueryHandler(GetScadaConnectionsQuery)
export class GetScadaConnectionsHandler
  implements IQueryHandler<GetScadaConnectionsQuery, ScadaConnectionDto[]>
{
  constructor(
    @Inject('IScadaConnectionRepository')
    private readonly scadaConnectionRepository: IScadaConnectionRepository,
  ) {}

  async execute(
    query: GetScadaConnectionsQuery,
  ): Promise<ScadaConnectionDto[]> {
    // If wellId is provided, fetch the specific connection for that well
    if (query.wellId) {
      const connection = await this.scadaConnectionRepository.findByWellId(
        query.tenantId,
        query.wellId,
      );

      return connection ? [ScadaConnectionDto.fromDomain(connection)] : [];
    }

    // If onlyEnabled is true, fetch only enabled connections
    if (query.onlyEnabled) {
      const connections = await this.scadaConnectionRepository.findEnabled(
        query.tenantId,
      );

      return connections.map((connection) =>
        ScadaConnectionDto.fromDomain(connection),
      );
    }

    // Otherwise, fetch all connections for the tenant
    const connections = await this.scadaConnectionRepository.findAll(
      query.tenantId,
    );

    return connections.map((connection) =>
      ScadaConnectionDto.fromDomain(connection),
    );
  }
}
