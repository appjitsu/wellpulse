/**
 * Get SCADA Connection By ID Query Handler
 *
 * Retrieves a single SCADA connection by its ID.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IScadaConnectionRepository } from '../../../../domain/repositories/scada-connection.repository.interface';
import { ScadaConnectionDto } from '../../dto/scada-connection.dto';
import { GetScadaConnectionByIdQuery } from './get-scada-connection-by-id.query';

@Injectable()
@QueryHandler(GetScadaConnectionByIdQuery)
export class GetScadaConnectionByIdHandler
  implements
    IQueryHandler<GetScadaConnectionByIdQuery, ScadaConnectionDto | null>
{
  constructor(
    @Inject('IScadaConnectionRepository')
    private readonly scadaConnectionRepository: IScadaConnectionRepository,
  ) {}

  async execute(
    query: GetScadaConnectionByIdQuery,
  ): Promise<ScadaConnectionDto | null> {
    const connection = await this.scadaConnectionRepository.findById(
      query.tenantId,
      query.connectionId,
    );

    if (!connection) {
      return null;
    }

    return ScadaConnectionDto.fromDomain(connection);
  }
}
