import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { IFieldEntryRepository } from '../../../domain/repositories/field-entry.repository.interface';

/**
 * Get Well Type Breakdown Query
 *
 * Returns production breakdown by well type (horizontal, vertical, directional).
 *
 * TODO: Well type is not yet in schema. For now, returns empty array.
 * Future implementation:
 * 1. Add wellType enum to wells.schema.ts
 * 2. Generate and apply migration
 * 3. Update this query to group by well type
 */
export class GetWellTypeBreakdownQuery implements IQuery {
  constructor(public readonly tenantId: string) {}
}

export interface WellTypeBreakdownDto {
  type: string;
  wells: number;
  production: number;
  percentage: number;
}

@QueryHandler(GetWellTypeBreakdownQuery)
export class GetWellTypeBreakdownHandler
  implements IQueryHandler<GetWellTypeBreakdownQuery, WellTypeBreakdownDto[]>
{
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepo: IWellRepository,
    @Inject('IFieldEntryRepository')
    private readonly fieldEntryRepo: IFieldEntryRepository,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  execute(_query: GetWellTypeBreakdownQuery): Promise<WellTypeBreakdownDto[]> {
    // TODO: Implement once wellType field is added to schema
    // For now, return empty array with proper structure
    return Promise.resolve([]);

    /*
     * Future implementation (once wellType is added to schema):
     *
     * const { tenantId } = query;
     *
     * // Get all wells with their types
     * const wells = await this.wellRepo.findAll(tenantId);
     *
     * // Calculate last 30 days production by well type
     * const endDate = new Date();
     * const startDate = new Date();
     * startDate.setDate(startDate.getDate() - 30);
     *
     * const typeData = new Map<string, { wells: Set<string>, production: number }>();
     *
     * for (const well of wells) {
     *   const wellType = well.wellType || 'Unknown';
     *
     *   if (!typeData.has(wellType)) {
     *     typeData.set(wellType, { wells: new Set(), production: 0 });
     *   }
     *
     *   const data = typeData.get(wellType)!;
     *   data.wells.add(well.id);
     *
     *   // Get production for this well
     *   const summary = await this.fieldEntryRepo.getProductionSummary(
     *     tenantId,
     *     well.id,
     *     startDate,
     *     endDate,
     *   );
     *
     *   data.production += summary.totalOil;
     * }
     *
     * // Calculate totals and percentages
     * const totalProduction = Array.from(typeData.values())
     *   .reduce((sum, data) => sum + data.production, 0);
     *
     * return Array.from(typeData.entries()).map(([type, data]) => ({
     *   type,
     *   wells: data.wells.size,
     *   production: Math.round(data.production),
     *   percentage: totalProduction > 0
     *     ? Math.round((data.production / totalProduction) * 100)
     *     : 0,
     * }));
     */
  }
}
