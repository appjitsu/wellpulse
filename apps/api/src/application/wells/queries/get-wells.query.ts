/**
 * Get Wells Query and Handler
 *
 * Retrieves paginated list of wells with optional filters.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { Well, WellStatus } from '../../../domain/wells/well.entity';

/**
 * Get Wells Query
 */
export class GetWellsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters?: {
      status?: WellStatus;
      lease?: string;
      field?: string;
      operator?: string;
      search?: string;
      limit?: number;
      offset?: number;
      databaseName?: string;
    },
  ) {}
}

/**
 * Well DTO for response
 */
export interface WellDto {
  id: string;
  name: string;
  apiNumber: string;
  latitude: number;
  longitude: number;
  status: WellStatus;
  lease: string | null;
  field: string | null;
  operator: string | null;
  spudDate: string | null;
  completionDate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get Wells Query Result
 */
export interface GetWellsResult {
  wells: WellDto[];
  total: number;
}

/**
 * Get Wells Query Handler
 */
@Injectable()
@QueryHandler(GetWellsQuery)
export class GetWellsHandler implements IQueryHandler<GetWellsQuery> {
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(query: GetWellsQuery): Promise<GetWellsResult> {
    // 1. Get wells with filters
    const wells = await this.wellRepository.findAll(
      query.tenantId,
      query.filters,
    );

    // 2. Get total count (for pagination)
    const total = await this.wellRepository.count(query.tenantId, {
      status: query.filters?.status,
      lease: query.filters?.lease,
      field: query.filters?.field,
      operator: query.filters?.operator,
      search: query.filters?.search,
      databaseName: query.filters?.databaseName,
    });

    return {
      wells: wells.map((well) => this.toDto(well)),
      total,
    };
  }

  /**
   * Convert domain entity to DTO (plain object for presentation layer)
   */
  private toDto(well: Well): WellDto {
    return {
      id: well.id,
      name: well.name,
      apiNumber: well.apiNumber,
      latitude: well.latitude,
      longitude: well.longitude,
      status: well.status,
      lease: well.lease,
      field: well.field,
      operator: well.operator,
      spudDate: well.spudDate ? well.spudDate.toISOString() : null,
      completionDate: well.completionDate
        ? well.completionDate.toISOString()
        : null,
      metadata: well.metadata,
      createdAt: well.createdAt.toISOString(),
      updatedAt: well.updatedAt.toISOString(),
    };
  }
}
