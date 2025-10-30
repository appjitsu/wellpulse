/**
 * Get Effective Nominal Ranges Query and Handler
 *
 * Retrieves the effective nominal ranges for a specific well.
 * Implements cascade resolution: well-specific > org-level > global template.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';
import { NominalRange } from '../../../domain/nominal-range/nominal-range.entity';

/**
 * Get Effective Nominal Ranges Query
 */
export class GetEffectiveNominalRangesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly wellType: string | null,
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
 * Get Effective Nominal Ranges Query Result
 */
export interface GetEffectiveNominalRangesResult {
  ranges: NominalRangeDto[];
  wellId: string;
  wellType: string | null;
}

/**
 * Get Effective Nominal Ranges Query Handler
 *
 * Returns the effective ranges for a well, with cascade resolution already applied.
 * The repository handles the cascade logic (well-specific > org-level > global).
 */
@Injectable()
@QueryHandler(GetEffectiveNominalRangesQuery)
export class GetEffectiveNominalRangesHandler
  implements IQueryHandler<GetEffectiveNominalRangesQuery>
{
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
  ) {}

  async execute(
    query: GetEffectiveNominalRangesQuery,
  ): Promise<GetEffectiveNominalRangesResult> {
    // Get effective ranges with cascade resolution from repository
    const effectiveRangesMap =
      await this.nominalRangeRepository.getEffectiveRangesForWell(
        query.tenantId,
        query.wellId,
        query.wellType,
      );

    // Convert map to array of DTOs
    const ranges: NominalRangeDto[] = Array.from(
      effectiveRangesMap.values(),
    ).map((range) => this.toDto(range));

    return {
      ranges,
      wellId: query.wellId,
      wellType: query.wellType,
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
