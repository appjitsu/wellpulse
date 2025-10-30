/**
 * Nominal Range Entity (Sprint 4 MVP)
 *
 * Domain entity representing acceptable value ranges for production metrics.
 * Implements the cascade resolution: well-specific > org-level > global template.
 */

export type NominalRangeSeverity = 'info' | 'warning' | 'critical';
export type NominalRangeScope = 'global' | 'org' | 'well';

export interface NominalRangeViolation {
  fieldName: string;
  actualValue: number;
  expectedMin: number | null;
  expectedMax: number | null;
  severity: NominalRangeSeverity;
  message: string;
}

export interface NominalRangeProps {
  id: string;
  fieldName: string;
  wellType?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  unit: string;
  severity: NominalRangeSeverity;
  scope: NominalRangeScope;
  description?: string | null;
  reason?: string | null; // For well-specific overrides
  tenantId?: string; // For org/well scoped ranges
  wellId?: string; // For well-specific ranges
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class NominalRange {
  private constructor(private readonly props: NominalRangeProps) {}

  // ============================================================================
  // Factory Methods
  // ============================================================================

  static createGlobalTemplate(params: {
    id: string;
    fieldName: string;
    wellType?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
    unit: string;
    severity: NominalRangeSeverity;
    description?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): NominalRange {
    return new NominalRange({
      ...params,
      scope: 'global',
      createdAt: params.createdAt ?? new Date(),
      updatedAt: params.updatedAt ?? new Date(),
    });
  }

  static createOrgLevel(params: {
    id: string;
    tenantId: string;
    fieldName: string;
    wellType?: string | null;
    minValue?: number | null;
    maxValue?: number | null;
    unit: string;
    severity: NominalRangeSeverity;
    updatedBy: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): NominalRange {
    if (!params.tenantId) {
      throw new Error('Tenant ID is required for org-level nominal ranges');
    }

    return new NominalRange({
      ...params,
      scope: 'org',
      createdAt: params.createdAt ?? new Date(),
      updatedAt: params.updatedAt ?? new Date(),
    });
  }

  static createWellSpecific(params: {
    id: string;
    tenantId: string;
    wellId: string;
    fieldName: string;
    minValue?: number | null;
    maxValue?: number | null;
    unit: string;
    severity: NominalRangeSeverity;
    reason?: string;
    updatedBy: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): NominalRange {
    if (!params.tenantId) {
      throw new Error('Tenant ID is required for well-specific nominal ranges');
    }
    if (!params.wellId) {
      throw new Error('Well ID is required for well-specific nominal ranges');
    }

    return new NominalRange({
      ...params,
      scope: 'well',
      createdAt: params.createdAt ?? new Date(),
      updatedAt: params.updatedAt ?? new Date(),
    });
  }

  // ============================================================================
  // Validation Logic
  // ============================================================================

  /**
   * Validates a field value against this nominal range.
   * Returns null if value is within range, violation object if out of range.
   */
  validate(value: number): NominalRangeViolation | null {
    const { minValue, maxValue, fieldName, severity, unit } = this.props;

    // Check minimum violation
    if (minValue !== null && minValue !== undefined && value < minValue) {
      return {
        fieldName,
        actualValue: value,
        expectedMin: minValue,
        expectedMax: maxValue ?? null,
        severity,
        message: `${fieldName} of ${value} ${unit} is below minimum of ${minValue} ${unit}`,
      };
    }

    // Check maximum violation
    if (maxValue !== null && maxValue !== undefined && value > maxValue) {
      return {
        fieldName,
        actualValue: value,
        expectedMin: minValue ?? null,
        expectedMax: maxValue,
        severity,
        message: `${fieldName} of ${value} ${unit} is above maximum of ${maxValue} ${unit}`,
      };
    }

    return null; // Value is within range
  }

  /**
   * Checks if this range is more specific than another range.
   * Used for cascade resolution priority.
   */
  isMoreSpecificThan(other: NominalRange): boolean {
    const scopePriority = { well: 3, org: 2, global: 1 };
    return scopePriority[this.props.scope] > scopePriority[other.props.scope];
  }

  /**
   * Checks if this range applies to a specific well type.
   */
  appliesToWellType(wellType: string | null): boolean {
    // Null wellType in range means it applies to all well types
    if (this.props.wellType === null || this.props.wellType === undefined) {
      return true;
    }

    // Exact match required
    return this.props.wellType === wellType;
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.props.id;
  }

  get fieldName(): string {
    return this.props.fieldName;
  }

  get wellType(): string | null | undefined {
    return this.props.wellType;
  }

  get minValue(): number | null | undefined {
    return this.props.minValue;
  }

  get maxValue(): number | null | undefined {
    return this.props.maxValue;
  }

  get unit(): string {
    return this.props.unit;
  }

  get severity(): NominalRangeSeverity {
    return this.props.severity;
  }

  get scope(): NominalRangeScope {
    return this.props.scope;
  }

  get description(): string | null | undefined {
    return this.props.description;
  }

  get reason(): string | null | undefined {
    return this.props.reason;
  }

  get tenantId(): string | undefined {
    return this.props.tenantId;
  }

  get wellId(): string | undefined {
    return this.props.wellId;
  }

  get updatedBy(): string | undefined {
    return this.props.updatedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ============================================================================
  // Update Methods
  // ============================================================================

  updateRange(params: {
    minValue?: number | null;
    maxValue?: number | null;
    severity?: NominalRangeSeverity;
    reason?: string;
    updatedBy: string;
  }): NominalRange {
    return new NominalRange({
      ...this.props,
      minValue: params.minValue ?? this.props.minValue,
      maxValue: params.maxValue ?? this.props.maxValue,
      severity: params.severity ?? this.props.severity,
      reason: params.reason ?? this.props.reason,
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    });
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  toJSON(): NominalRangeProps {
    return { ...this.props };
  }
}
