/**
 * Get SCADA Readings Query Handler
 *
 * Retrieves time-series SCADA readings with optional filters.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IScadaReadingRepository } from '../../../../domain/repositories/scada-reading.repository.interface';
import { ScadaReadingDto } from '../../dto/scada-reading.dto';
import { GetScadaReadingsQuery } from './get-scada-readings.query';

@Injectable()
@QueryHandler(GetScadaReadingsQuery)
export class GetScadaReadingsHandler
  implements IQueryHandler<GetScadaReadingsQuery, ScadaReadingDto[]>
{
  constructor(
    @Inject('IScadaReadingRepository')
    private readonly scadaReadingRepository: IScadaReadingRepository,
  ) {}

  async execute(query: GetScadaReadingsQuery): Promise<ScadaReadingDto[]> {
    // Use the time-range query if wellId and time range are provided
    if (query.wellId && query.startTime && query.endTime) {
      const readings =
        await this.scadaReadingRepository.findByWellIdAndTimeRange(
          query.tenantId,
          query.wellId,
          query.startTime,
          query.endTime,
          query.limit,
        );

      return readings.map((reading) => ScadaReadingDto.fromDomain(reading));
    }

    // Otherwise, use the filter-based query
    const readings = await this.scadaReadingRepository.findWithFilters(
      query.tenantId,
      {
        wellId: query.wellId,
        scadaConnectionId: query.scadaConnectionId,
        tagName: query.tagName,
        startTime: query.startTime,
        endTime: query.endTime,
        limit: query.limit ?? 100, // Default limit to prevent huge result sets
        offset: query.offset ?? 0,
      },
    );

    return readings.map((reading) => ScadaReadingDto.fromDomain(reading));
  }
}
