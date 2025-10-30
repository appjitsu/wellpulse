/**
 * Get Organization Nominal Ranges Query and Handler
 *
 * Retrieves all org-level nominal range overrides for a tenant.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';
import { NominalRange } from '../../../domain/nominal-range/nominal-range.entity';

/**
 * Get Org Nominal Ranges Query
 */
export class GetOrgNominalRangesQuery {
  constructor(public readonly tenantId: string) {}
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
 * Get Org Nominal Ranges Query Result
 */
export interface GetOrgNominalRangesResult {
  ranges: NominalRangeDto[];
  total: number;
}

/**
 * Get Org Nominal Ranges Query Handler
 *
 * Returns all organization-level nominal range overrides.
 * These override global templates for all wells in the organization.
 */
@Injectable()
@QueryHandler(GetOrgNominalRangesQuery)
export class GetOrgNominalRangesHandler
  implements IQueryHandler<GetOrgNominalRangesQuery>
{
  constructor(
    @Inject('INominalRangeRepository')
    private readonly nominalRangeRepository: INominalRangeRepository,
  ) {}

  async execute(
    query: GetOrgNominalRangesQuery,
  ): Promise<GetOrgNominalRangesResult> {
    // Get all org-level ranges for this tenant
    const ranges = await this.nominalRangeRepository.findOrgRanges(
      query.tenantId,
    );

    return {
      ranges: ranges.map((range) => this.toDto(range)),
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
