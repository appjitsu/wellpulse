/**
 * Get Well Status Distribution Query and Handler
 *
 * Retrieves count of wells by status (ACTIVE, INACTIVE, PLUGGED).
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { WellStatusDto, WellStatusItemDto } from '../dto';

/**
 * Get Well Status Query
 */
export class GetWellStatusQuery {
  constructor(public readonly tenantId: string) {}
}

/**
 * Get Well Status Query Handler
 */
@Injectable()
@QueryHandler(GetWellStatusQuery)
export class GetWellStatusHandler implements IQueryHandler<GetWellStatusQuery> {
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(query: GetWellStatusQuery): Promise<WellStatusDto> {
    const { tenantId } = query;

    // Get counts for each status in parallel
    const [activeCount, inactiveCount, pluggedCount, totalWells] =
      await Promise.all([
        this.wellRepository.count(tenantId, { status: 'ACTIVE' }),
        this.wellRepository.count(tenantId, { status: 'INACTIVE' }),
        this.wellRepository.count(tenantId, { status: 'PLUGGED' }),
        this.wellRepository.count(tenantId),
      ]);

    // Build status distribution
    const statusDistribution: WellStatusItemDto[] = [];

    if (activeCount > 0) {
      statusDistribution.push({
        status: 'ACTIVE',
        count: activeCount,
        percentage:
          totalWells > 0
            ? Math.round((activeCount / totalWells) * 100 * 10) / 10
            : 0,
      });
    }

    if (inactiveCount > 0) {
      statusDistribution.push({
        status: 'INACTIVE',
        count: inactiveCount,
        percentage:
          totalWells > 0
            ? Math.round((inactiveCount / totalWells) * 100 * 10) / 10
            : 0,
      });
    }

    if (pluggedCount > 0) {
      statusDistribution.push({
        status: 'PLUGGED',
        count: pluggedCount,
        percentage:
          totalWells > 0
            ? Math.round((pluggedCount / totalWells) * 100 * 10) / 10
            : 0,
      });
    }

    return {
      statusDistribution,
      totalWells,
    };
  }
}
