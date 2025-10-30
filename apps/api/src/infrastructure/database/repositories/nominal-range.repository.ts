import { Injectable } from '@nestjs/common';
import { eq, and, isNull, or, sql } from 'drizzle-orm';
import { INominalRangeRepository } from '../../../domain/repositories/nominal-range.repository.interface';
import { NominalRange } from '../../../domain/nominal-range/nominal-range.entity';
import { TenantDatabaseService } from '../tenant-database.service';
import { masterDb } from '../master/client';
import * as masterSchema from '../master/schema';
import * as tenantSchema from '../schema/tenant';

/**
 * Nominal Range Repository Implementation
 *
 * Implements three-tier cascade resolution:
 * 1. Well-specific ranges (tenant DB) - Highest priority
 * 2. Organization-level ranges (tenant DB) - Medium priority
 * 3. Global templates (master DB) - Lowest priority (fallback)
 *
 * Architecture:
 * - Uses masterDb for global templates (shared across all tenants)
 * - Uses TenantDatabaseService for org/well ranges (tenant-specific)
 * - Implements cascade resolution logic in getEffectiveRangesForWell()
 */
@Injectable()
export class NominalRangeRepository implements INominalRangeRepository {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  // ============================================================================
  // Global Templates (Master DB)
  // ============================================================================

  async findGlobalTemplates(): Promise<NominalRange[]> {
    const rows = await masterDb
      .select()
      .from(masterSchema.nominalRangeTemplates)
      .where(eq(masterSchema.nominalRangeTemplates.isActive, true));

    return rows.map((row) => this.globalTemplateToDomain(row));
  }

  async findGlobalTemplatesByField(
    fieldName: string,
    wellType?: string | null,
  ): Promise<NominalRange[]> {
    const rows = await masterDb
      .select()
      .from(masterSchema.nominalRangeTemplates)
      .where(
        and(
          eq(masterSchema.nominalRangeTemplates.fieldName, fieldName),
          eq(masterSchema.nominalRangeTemplates.isActive, true),
          wellType
            ? or(
                eq(masterSchema.nominalRangeTemplates.wellType, wellType),
                isNull(masterSchema.nominalRangeTemplates.wellType),
              )
            : sql`true`,
        ),
      );

    return rows.map((row) => this.globalTemplateToDomain(row));
  }

  // ============================================================================
  // Organization-Level Ranges (Tenant DB)
  // ============================================================================

  async findOrgRanges(tenantId: string): Promise<NominalRange[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.orgNominalRanges)
      .where(eq(tenantSchema.orgNominalRanges.tenantId, tenantId));

    return rows.map((row) => this.orgRangeToDomain(row, tenantId));
  }

  async findOrgRangeByField(
    tenantId: string,
    fieldName: string,
    wellType?: string | null,
  ): Promise<NominalRange | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.orgNominalRanges)
      .where(
        and(
          eq(tenantSchema.orgNominalRanges.tenantId, tenantId),
          eq(tenantSchema.orgNominalRanges.fieldName, fieldName),
          wellType
            ? or(
                eq(tenantSchema.orgNominalRanges.wellType, wellType),
                isNull(tenantSchema.orgNominalRanges.wellType),
              )
            : sql`true`,
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.orgRangeToDomain(rows[0], tenantId);
  }

  async saveOrgRange(range: NominalRange): Promise<NominalRange> {
    if (!range.tenantId) {
      throw new Error('Tenant ID is required for org-level nominal ranges');
    }

    const db = await this.tenantDb.getTenantDatabase(range.tenantId);

    const row = {
      id: range.id,
      tenantId: range.tenantId,
      fieldName: range.fieldName,
      wellType: range.wellType ?? null,
      minValue: range.minValue?.toString() ?? null,
      maxValue: range.maxValue?.toString() ?? null,
      unit: range.unit,
      severity: range.severity,
      updatedBy: range.updatedBy ?? null,
      createdAt: range.createdAt,
      updatedAt: new Date(),
    };

    // Upsert: insert if doesn't exist, update if exists
    await db
      .insert(tenantSchema.orgNominalRanges)
      .values(row)
      .onConflictDoUpdate({
        target: tenantSchema.orgNominalRanges.id,
        set: {
          minValue: row.minValue,
          maxValue: row.maxValue,
          severity: row.severity,
          updatedBy: row.updatedBy,
          updatedAt: row.updatedAt,
        },
      });

    return range;
  }

  async deleteOrgRange(tenantId: string, rangeId: string): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(tenantSchema.orgNominalRanges)
      .where(
        and(
          eq(tenantSchema.orgNominalRanges.id, rangeId),
          eq(tenantSchema.orgNominalRanges.tenantId, tenantId),
        ),
      );
  }

  // ============================================================================
  // Well-Specific Ranges (Tenant DB)
  // ============================================================================

  async findWellRanges(
    tenantId: string,
    wellId: string,
  ): Promise<NominalRange[]> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.wellNominalRanges)
      .where(eq(tenantSchema.wellNominalRanges.wellId, wellId));

    return rows.map((row) => this.wellRangeToDomain(row, tenantId));
  }

  async findWellRangeByField(
    tenantId: string,
    wellId: string,
    fieldName: string,
  ): Promise<NominalRange | null> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    const rows = await db
      .select()
      .from(tenantSchema.wellNominalRanges)
      .where(
        and(
          eq(tenantSchema.wellNominalRanges.wellId, wellId),
          eq(tenantSchema.wellNominalRanges.fieldName, fieldName),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    return this.wellRangeToDomain(rows[0], tenantId);
  }

  async saveWellRange(range: NominalRange): Promise<NominalRange> {
    if (!range.tenantId) {
      throw new Error('Tenant ID is required for well-specific nominal ranges');
    }
    if (!range.wellId) {
      throw new Error('Well ID is required for well-specific nominal ranges');
    }

    const db = await this.tenantDb.getTenantDatabase(range.tenantId);

    const row = {
      id: range.id,
      wellId: range.wellId,
      fieldName: range.fieldName,
      minValue: range.minValue?.toString() ?? null,
      maxValue: range.maxValue?.toString() ?? null,
      unit: range.unit,
      severity: range.severity,
      reason: range.reason ?? null,
      updatedBy: range.updatedBy ?? null,
      createdAt: range.createdAt,
      updatedAt: new Date(),
    };

    // Upsert: insert if doesn't exist, update if exists
    await db
      .insert(tenantSchema.wellNominalRanges)
      .values(row)
      .onConflictDoUpdate({
        target: tenantSchema.wellNominalRanges.id,
        set: {
          minValue: row.minValue,
          maxValue: row.maxValue,
          severity: row.severity,
          reason: row.reason,
          updatedBy: row.updatedBy,
          updatedAt: row.updatedAt,
        },
      });

    return range;
  }

  async deleteWellRange(
    tenantId: string,
    wellId: string,
    rangeId: string,
  ): Promise<void> {
    const db = await this.tenantDb.getTenantDatabase(tenantId);

    await db
      .delete(tenantSchema.wellNominalRanges)
      .where(
        and(
          eq(tenantSchema.wellNominalRanges.id, rangeId),
          eq(tenantSchema.wellNominalRanges.wellId, wellId),
        ),
      );
  }

  // ============================================================================
  // Cascade Resolution (Combining all scopes)
  // ============================================================================

  /**
   * Implements cascade resolution: well-specific > org-level > global template.
   *
   * Algorithm:
   * 1. Query all three sources (global templates, org ranges, well ranges)
   * 2. For each field name, pick the most specific range:
   *    - Well-specific (if exists) - highest priority
   *    - Org-level (if exists) - medium priority
   *    - Global template (fallback) - lowest priority
   * 3. Filter by wellType compatibility (null wellType = applies to all)
   *
   * Performance: 3 database queries (1 master, 2 tenant), but results are typically cached
   */
  async getEffectiveRangesForWell(
    tenantId: string,
    wellId: string,
    wellType: string | null,
  ): Promise<Map<string, NominalRange>> {
    // Query all three sources in parallel
    const [globalTemplates, orgRanges, wellRanges] = await Promise.all([
      this.findGlobalTemplates(),
      this.findOrgRanges(tenantId),
      this.findWellRanges(tenantId, wellId),
    ]);

    // Build map of field name -> effective range
    const effectiveRanges = new Map<string, NominalRange>();

    // Step 1: Add global templates (lowest priority)
    for (const template of globalTemplates) {
      if (template.appliesToWellType(wellType)) {
        effectiveRanges.set(template.fieldName, template);
      }
    }

    // Step 2: Override with org-level ranges (medium priority)
    for (const orgRange of orgRanges) {
      if (orgRange.appliesToWellType(wellType)) {
        const existing = effectiveRanges.get(orgRange.fieldName);
        if (!existing || orgRange.isMoreSpecificThan(existing)) {
          effectiveRanges.set(orgRange.fieldName, orgRange);
        }
      }
    }

    // Step 3: Override with well-specific ranges (highest priority)
    for (const wellRange of wellRanges) {
      const existing = effectiveRanges.get(wellRange.fieldName);
      if (!existing || wellRange.isMoreSpecificThan(existing)) {
        effectiveRanges.set(wellRange.fieldName, wellRange);
      }
    }

    return effectiveRanges;
  }

  async getEffectiveRangeForField(
    tenantId: string,
    wellId: string,
    wellType: string | null,
    fieldName: string,
  ): Promise<NominalRange | null> {
    // Check well-specific range first (highest priority)
    const wellRange = await this.findWellRangeByField(
      tenantId,
      wellId,
      fieldName,
    );
    if (wellRange) {
      return wellRange;
    }

    // Check org-level range (medium priority)
    const orgRange = await this.findOrgRangeByField(
      tenantId,
      fieldName,
      wellType,
    );
    if (orgRange) {
      return orgRange;
    }

    // Fallback to global template (lowest priority)
    const globalTemplates = await this.findGlobalTemplatesByField(
      fieldName,
      wellType,
    );

    // Prefer well-type-specific template over generic (null wellType) template
    const specificTemplate = globalTemplates.find(
      (t) => t.wellType === wellType,
    );
    if (specificTemplate) {
      return specificTemplate;
    }

    // Return generic template (null wellType)
    const genericTemplate = globalTemplates.find((t) => t.wellType === null);
    return genericTemplate ?? null;
  }

  // ============================================================================
  // Mappers (Database Rows -> Domain Entities)
  // ============================================================================

  private globalTemplateToDomain(
    row: typeof masterSchema.nominalRangeTemplates.$inferSelect,
  ): NominalRange {
    return NominalRange.createGlobalTemplate({
      id: row.id,
      fieldName: row.fieldName,
      wellType: row.wellType,
      minValue: row.minValue ? parseFloat(row.minValue) : null,
      maxValue: row.maxValue ? parseFloat(row.maxValue) : null,
      unit: row.unit,
      severity: row.severity as 'info' | 'warning' | 'critical',
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private orgRangeToDomain(
    row: typeof tenantSchema.orgNominalRanges.$inferSelect,
    tenantId: string,
  ): NominalRange {
    return NominalRange.createOrgLevel({
      id: row.id,
      tenantId,
      fieldName: row.fieldName,
      wellType: row.wellType,
      minValue: row.minValue ? parseFloat(row.minValue) : null,
      maxValue: row.maxValue ? parseFloat(row.maxValue) : null,
      unit: row.unit,
      severity: row.severity as 'info' | 'warning' | 'critical',
      updatedBy: row.updatedBy ?? '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private wellRangeToDomain(
    row: typeof tenantSchema.wellNominalRanges.$inferSelect,
    tenantId: string,
  ): NominalRange {
    return NominalRange.createWellSpecific({
      id: row.id,
      tenantId,
      wellId: row.wellId,
      fieldName: row.fieldName,
      minValue: row.minValue ? parseFloat(row.minValue) : null,
      maxValue: row.maxValue ? parseFloat(row.maxValue) : null,
      unit: row.unit,
      severity: row.severity as 'info' | 'warning' | 'critical',
      reason: row.reason ?? undefined,
      updatedBy: row.updatedBy ?? '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
