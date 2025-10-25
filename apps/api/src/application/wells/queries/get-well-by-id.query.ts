/**
 * Get Well By ID Query and Handler
 *
 * Retrieves a single well by its ID.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { Well, WellStatus } from '../../../domain/wells/well.entity';

/**
 * Get Well By ID Query
 */
export class GetWellByIdQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly databaseName?: string,
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
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get Well By ID Query Handler
 */
@Injectable()
@QueryHandler(GetWellByIdQuery)
export class GetWellByIdHandler implements IQueryHandler<GetWellByIdQuery> {
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(query: GetWellByIdQuery): Promise<WellDto | null> {
    const well = await this.wellRepository.findById(
      query.tenantId,
      query.wellId,
      query.databaseName,
    );

    if (!well) {
      return null;
    }

    return this.toDto(well);
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
      createdBy: well.createdBy,
      updatedBy: well.updatedBy,
      createdAt: well.createdAt.toISOString(),
      updatedAt: well.updatedAt.toISOString(),
    };
  }
}
