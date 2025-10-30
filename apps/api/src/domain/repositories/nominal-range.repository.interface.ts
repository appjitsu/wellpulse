import { NominalRange } from '../nominal-range/nominal-range.entity';

/**
 * Nominal Range Repository Interface
 *
 * Abstracts data access for nominal ranges across all three scopes:
 * - Global templates (master DB)
 * - Organization-level overrides (tenant DB)
 * - Well-specific overrides (tenant DB)
 */
export interface INominalRangeRepository {
  // ============================================================================
  // Global Templates (Master DB)
  // ============================================================================

  /**
   * Finds all active global nominal range templates.
   * These are the default ranges that apply to all tenants.
   */
  findGlobalTemplates(): Promise<NominalRange[]>;

  /**
   * Finds global templates for a specific field and optionally well type.
   */
  findGlobalTemplatesByField(
    fieldName: string,
    wellType?: string | null,
  ): Promise<NominalRange[]>;

  // ============================================================================
  // Organization-Level Ranges (Tenant DB)
  // ============================================================================

  /**
   * Finds all org-level nominal ranges for a tenant.
   */
  findOrgRanges(tenantId: string): Promise<NominalRange[]>;

  /**
   * Finds org-level range for a specific field and well type.
   */
  findOrgRangeByField(
    tenantId: string,
    fieldName: string,
    wellType?: string | null,
  ): Promise<NominalRange | null>;

  /**
   * Creates or updates an org-level nominal range.
   */
  saveOrgRange(range: NominalRange): Promise<NominalRange>;

  /**
   * Deletes an org-level nominal range (revert to global default).
   */
  deleteOrgRange(tenantId: string, rangeId: string): Promise<void>;

  // ============================================================================
  // Well-Specific Ranges (Tenant DB)
  // ============================================================================

  /**
   * Finds all well-specific nominal ranges for a well.
   */
  findWellRanges(tenantId: string, wellId: string): Promise<NominalRange[]>;

  /**
   * Finds well-specific range for a specific field.
   */
  findWellRangeByField(
    tenantId: string,
    wellId: string,
    fieldName: string,
  ): Promise<NominalRange | null>;

  /**
   * Creates or updates a well-specific nominal range.
   */
  saveWellRange(range: NominalRange): Promise<NominalRange>;

  /**
   * Deletes a well-specific nominal range (revert to org or global default).
   */
  deleteWellRange(
    tenantId: string,
    wellId: string,
    rangeId: string,
  ): Promise<void>;

  // ============================================================================
  // Cascade Resolution (Combining all scopes)
  // ============================================================================

  /**
   * Gets the effective nominal ranges for a specific well.
   * Implements cascade: well-specific > org-level > global template.
   *
   * Returns a map of field names to their effective nominal ranges.
   */
  getEffectiveRangesForWell(
    tenantId: string,
    wellId: string,
    wellType: string | null,
  ): Promise<Map<string, NominalRange>>;

  /**
   * Gets the effective nominal range for a specific field on a specific well.
   */
  getEffectiveRangeForField(
    tenantId: string,
    wellId: string,
    wellType: string | null,
    fieldName: string,
  ): Promise<NominalRange | null>;
}
