/**
 * Get Well Nominal Ranges Query and Handler
 *
 * Retrieves all well-specific nominal range overrides for a specific well.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';
import { NominalRange } from '../../../domain/nominal-range/nominal-range.entity';

/**
 * Get Well Nominal Ranges Query
 */
export class GetWellNominalRangesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
  ) {}
}

/**
 * Nominal Range DTO for response
 */
export interface NominalRangeDto {
  id: string;
  fieldName: string;
  wellType: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  severity: 'info' | 'warning' | 'critical';
  scope: 'global' | 'org' | 'well';
  description?: string | null;
  reason?: string | null;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get Well Nominal Ranges Query Result
 */
export interface GetWellNominalRangesResult {
  ranges: NominalRangeDto[];
  wellId: string;
  total: number;
}

/**
 * Get Well Nominal Ranges Query Handler
 *
 * Returns all well-specific nominal range overrides for a single well.
 * These override org-level and global defaults for this specific well only.
 */
@Injectable()
@QueryHandler(GetWellNominalRangesQuery)
export class GetWellNominalRangesHandler
  implements IQueryHandler<GetWellNominalRangesQuery>
{
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
  ) {}

  async execute(
    query: GetWellNominalRangesQuery,
  ): Promise<GetWellNominalRangesResult> {
    // Get all well-specific ranges for this well
    const ranges = await this.nominalRangeRepository.findWellRanges(
      query.tenantId,
      query.wellId,
    );

    return {
      ranges: ranges.map((range) => this.toDto(range)),
      wellId: query.wellId,
      total: ranges.length,
    };
  }

  /**
   * Convert domain entity to DTO (plain object for presentation layer)
   */
  private toDto(range: NominalRange): NominalRangeDto {
    return {
      id: range.id,
      fieldName: range.fieldName,
      wellType: range.wellType ?? null,
      minValue: range.minValue ?? null,
      maxValue: range.maxValue ?? null,
      unit: range.unit,
      severity: range.severity,
      scope: range.scope,
      description: range.description ?? null,
      reason: range.reason ?? null,
      updatedBy: range.updatedBy,
      createdAt: range.createdAt.toISOString(),
      updatedAt: range.updatedAt.toISOString(),
    };
  }
}
