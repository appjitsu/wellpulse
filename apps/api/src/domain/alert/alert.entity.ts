/**
 * Alert Entity (Sprint 4 MVP)
 *
 * Domain entity representing system alerts for nominal range violations,
 * equipment failures, and operational issues.
 *
 * Alerts are immutable once created - acknowledgement adds metadata
 * without modifying the original alert data.
 */

export type AlertType =
  | 'nominal_range_violation'
  | 'well_down'
  | 'equipment_failure'
  | 'high_downtime'
  | 'system';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertProps {
  id: string;
  tenantId: string;
  wellId?: string | null;
  fieldEntryId?: string | null;
  alertType: AlertType;
  severity: AlertSeverity;
  fieldName?: string | null;
  actualValue?: number | null;
  expectedMin?: number | null;
  expectedMax?: number | null;
  message: string;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export class Alert {
  private constructor(private readonly props: AlertProps) {}

  // ============================================================================
  // Factory Methods
  // ============================================================================

  static createNominalRangeViolation(params: {
    id: string;
    tenantId: string;
    wellId: string;
    fieldEntryId: string;
    fieldName: string;
    actualValue: number;
    expectedMin: number | null;
    expectedMax: number | null;
    severity: AlertSeverity;
    message: string;
    metadata?: Record<string, any>;
    createdAt?: Date;
  }): Alert {
    if (!params.tenantId) {
      throw new Error('Tenant ID is required');
    }

    return new Alert({
      ...params,
      alertType: 'nominal_range_violation',
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static createWellDown(params: {
    id: string;
    tenantId: string;
    wellId: string;
    message: string;
    metadata?: Record<string, any>;
    createdAt?: Date;
  }): Alert {
    if (!params.tenantId) {
      throw new Error('Tenant ID is required');
    }

    return new Alert({
      ...params,
      alertType: 'well_down',
      severity: 'critical',
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static createEquipmentFailure(params: {
    id: string;
    tenantId: string;
    wellId: string;
    fieldEntryId?: string;
    message: string;
    severity: AlertSeverity;
    metadata?: Record<string, any>;
    createdAt?: Date;
  }): Alert {
    if (!params.tenantId) {
      throw new Error('Tenant ID is required');
    }

    return new Alert({
      ...params,
      alertType: 'equipment_failure',
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static createHighDowntime(params: {
    id: string;
    tenantId: string;
    wellId: string;
    fieldEntryId: string;
    message: string;
    metadata?: Record<string, any>;
    createdAt?: Date;
  }): Alert {
    if (!params.tenantId) {
      throw new Error('Tenant ID is required');
    }

    return new Alert({
      ...params,
      alertType: 'high_downtime',
      severity: 'warning',
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static createSystemAlert(params: {
    id: string;
    tenantId: string;
    message: string;
    severity: AlertSeverity;
    metadata?: Record<string, any>;
    createdAt?: Date;
  }): Alert {
    if (!params.tenantId) {
      throw new Error('Tenant ID is required');
    }

    return new Alert({
      ...params,
      alertType: 'system',
      createdAt: params.createdAt ?? new Date(),
    });
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Acknowledges the alert, marking it as reviewed by a user.
   * Returns a new Alert instance (immutability).
   */
  acknowledge(userId: string): Alert {
    if (this.isAcknowledged()) {
      throw new Error('Alert has already been acknowledged');
    }

    return new Alert({
      ...this.props,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
      metadata: {
        ...this.props.metadata,
        acknowledgedByUser: userId,
        acknowledgedAtTimestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Checks if the alert has been acknowledged.
   */
  isAcknowledged(): boolean {
    return (
      this.props.acknowledgedAt !== null &&
      this.props.acknowledgedAt !== undefined
    );
  }

  /**
   * Checks if the alert is critical severity.
   */
  isCritical(): boolean {
    return this.props.severity === 'critical';
  }

  /**
   * Checks if the alert requires immediate attention.
   */
  requiresImmediateAttention(): boolean {
    return (
      this.isCritical() &&
      !this.isAcknowledged() &&
      (this.props.alertType === 'nominal_range_violation' ||
        this.props.alertType === 'well_down' ||
        this.props.alertType === 'equipment_failure')
    );
  }

  /**
   * Gets a human-readable description of the alert age.
   */
  getAgeInMinutes(): number {
    const now = new Date();
    const created = this.props.createdAt;
    return Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
  }

  /**
   * Checks if the alert is stale (unacknowledged for > 24 hours).
   */
  isStale(): boolean {
    return !this.isAcknowledged() && this.getAgeInMinutes() > 1440; // 24 hours
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get wellId(): string | null | undefined {
    return this.props.wellId;
  }

  get fieldEntryId(): string | null | undefined {
    return this.props.fieldEntryId;
  }

  get alertType(): AlertType {
    return this.props.alertType;
  }

  get severity(): AlertSeverity {
    return this.props.severity;
  }

  get fieldName(): string | null | undefined {
    return this.props.fieldName;
  }

  get actualValue(): number | null | undefined {
    return this.props.actualValue;
  }

  get expectedMin(): number | null | undefined {
    return this.props.expectedMin;
  }

  get expectedMax(): number | null | undefined {
    return this.props.expectedMax;
  }

  get message(): string {
    return this.props.message;
  }

  get acknowledgedAt(): Date | null | undefined {
    return this.props.acknowledgedAt;
  }

  get acknowledgedBy(): string | null | undefined {
    return this.props.acknowledgedBy;
  }

  get metadata(): Record<string, any> | undefined {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  toJSON(): AlertProps {
    return { ...this.props };
  }
}
