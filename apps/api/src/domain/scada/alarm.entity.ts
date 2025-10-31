/**
 * Alarm Entity
 *
 * Represents an alarm condition from a SCADA system.
 * Alarms are triggered when readings exceed configured thresholds or equipment states change.
 *
 * Business Rules:
 * - Alarms must be associated with a tenant, well, and SCADA connection
 * - Alarms have a lifecycle: ACTIVE → ACKNOWLEDGED → CLEARED
 * - Critical alarms cannot be cleared until acknowledged
 * - Alarm priority determines display order (CRITICAL > HIGH > MEDIUM > LOW)
 * - Acknowledged alarms record who acknowledged them and when
 * - Cleared alarms record when the condition returned to normal
 * - Alarm count increments each time the same condition reoccurs
 */

export type AlarmSeverity = 'INFORMATIONAL' | 'WARNING' | 'CRITICAL';
export type AlarmState = 'ACTIVE' | 'ACKNOWLEDGED' | 'CLEARED';
export type AlarmType =
  | 'HIGH_VALUE'
  | 'LOW_VALUE'
  | 'HIGH_HIGH_VALUE' // More severe than HIGH
  | 'LOW_LOW_VALUE' // More severe than LOW
  | 'EQUIPMENT_FAULT'
  | 'COMMUNICATION_LOSS'
  | 'QUALITY_BAD'
  | 'STALE_DATA'
  | 'CUSTOM';

export interface AlarmProps {
  id: string;
  tenantId: string;
  wellId: string;
  scadaConnectionId: string;
  tagName: string;
  alarmType: AlarmType;
  severity: AlarmSeverity;
  state: AlarmState;
  message: string;
  value?: number | string | boolean;
  threshold?: number;
  triggerCount: number;
  firstTriggeredAt: Date;
  lastTriggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  clearedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAlarmProps {
  tenantId: string;
  wellId: string;
  scadaConnectionId: string;
  tagName: string;
  alarmType: AlarmType;
  severity: AlarmSeverity;
  message: string;
  value?: number | string | boolean;
  threshold?: number;
  metadata?: Record<string, unknown>;
}

export class Alarm {
  private constructor(
    private readonly _id: string,
    private readonly _tenantId: string,
    private readonly _wellId: string,
    private readonly _scadaConnectionId: string,
    private readonly _tagName: string,
    private readonly _alarmType: AlarmType,
    private readonly _severity: AlarmSeverity,
    private _state: AlarmState,
    private readonly _message: string,
    private _value: number | string | boolean | undefined,
    private readonly _threshold: number | undefined,
    private _triggerCount: number,
    private readonly _firstTriggeredAt: Date,
    private _lastTriggeredAt: Date,
    private _acknowledgedAt: Date | undefined,
    private _acknowledgedBy: string | undefined,
    private _clearedAt: Date | undefined,
    private _metadata: Record<string, unknown>,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  /**
   * Factory method: Create new alarm
   */
  static create(props: CreateAlarmProps): Alarm {
    this.validateCreateProps(props);

    const now = new Date();
    const id = `alarm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Alarm(
      id,
      props.tenantId,
      props.wellId,
      props.scadaConnectionId,
      props.tagName,
      props.alarmType,
      props.severity,
      'ACTIVE', // New alarms start in ACTIVE state
      props.message,
      props.value,
      props.threshold,
      1, // First trigger
      now,
      now,
      undefined, // Not acknowledged
      undefined,
      undefined, // Not cleared
      props.metadata ?? {},
      now,
      now,
    );
  }

  /**
   * Factory method: Reconstruct from persistence
   */
  static fromPrimitives(props: AlarmProps): Alarm {
    return new Alarm(
      props.id,
      props.tenantId,
      props.wellId,
      props.scadaConnectionId,
      props.tagName,
      props.alarmType,
      props.severity,
      props.state,
      props.message,
      props.value,
      props.threshold,
      props.triggerCount,
      props.firstTriggeredAt,
      props.lastTriggeredAt,
      props.acknowledgedAt,
      props.acknowledgedBy,
      props.clearedAt,
      props.metadata ?? {},
      props.createdAt,
      props.updatedAt,
    );
  }

  private static validateCreateProps(props: CreateAlarmProps): void {
    if (!props.tenantId) {
      throw new Error('Tenant ID is required');
    }

    if (!props.wellId) {
      throw new Error('Well ID is required');
    }

    if (!props.scadaConnectionId) {
      throw new Error('SCADA connection ID is required');
    }

    if (!props.tagName) {
      throw new Error('Tag name is required');
    }

    if (!props.message || props.message.trim().length === 0) {
      throw new Error('Alarm message is required');
    }

    if (props.message.length > 500) {
      throw new Error('Alarm message must be 500 characters or less');
    }
  }

  /**
   * Acknowledge alarm
   */
  acknowledge(userId: string): void {
    if (this._state === 'ACKNOWLEDGED') {
      throw new Error('Alarm is already acknowledged');
    }

    if (this._state === 'CLEARED') {
      throw new Error('Cannot acknowledge a cleared alarm');
    }

    this._state = 'ACKNOWLEDGED';
    this._acknowledgedAt = new Date();
    this._acknowledgedBy = userId;
    this._updatedAt = new Date();
  }

  /**
   * Clear alarm (condition returned to normal)
   */
  clear(): void {
    if (this._state === 'CLEARED') {
      throw new Error('Alarm is already cleared');
    }

    // Critical alarms must be acknowledged before clearing
    if (this._severity === 'CRITICAL' && this._state === 'ACTIVE') {
      throw new Error('Critical alarms must be acknowledged before clearing');
    }

    this._state = 'CLEARED';
    this._clearedAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Re-trigger alarm (same condition occurred again)
   */
  retrigger(value?: number | string | boolean): void {
    if (this._state === 'CLEARED') {
      // If previously cleared, return to ACTIVE state
      this._state = 'ACTIVE';
      this._clearedAt = undefined;
    }

    // If was acknowledged, return to ACTIVE (requires re-acknowledgment)
    if (this._state === 'ACKNOWLEDGED') {
      this._state = 'ACTIVE';
      // Keep acknowledgment history but require new acknowledgment
    }

    this._triggerCount += 1;
    this._lastTriggeredAt = new Date();
    this._value = value ?? this._value;
    this._updatedAt = new Date();
  }

  /**
   * Add metadata to alarm
   */
  addMetadata(key: string, value: unknown): void {
    this._metadata[key] = value;
    this._updatedAt = new Date();
  }

  /**
   * Check if alarm is active
   */
  isActive(): boolean {
    return this._state === 'ACTIVE';
  }

  /**
   * Check if alarm is acknowledged
   */
  isAcknowledged(): boolean {
    return this._state === 'ACKNOWLEDGED';
  }

  /**
   * Check if alarm is cleared
   */
  isCleared(): boolean {
    return this._state === 'CLEARED';
  }

  /**
   * Check if alarm requires attention (active and not acknowledged)
   */
  requiresAttention(): boolean {
    return this._state === 'ACTIVE';
  }

  /**
   * Get alarm priority for sorting (0 = highest priority)
   */
  getPriority(): number {
    // Higher severity = higher priority
    const severityPriority = {
      CRITICAL: 0,
      WARNING: 1,
      INFORMATIONAL: 2,
    };

    // Active alarms have higher priority than acknowledged
    const statePriority = {
      ACTIVE: 0,
      ACKNOWLEDGED: 1,
      CLEARED: 2,
    };

    // Combine severity and state for overall priority
    return severityPriority[this._severity] * 10 + statePriority[this._state];
  }

  /**
   * Get alarm age in milliseconds
   */
  getAge(): number {
    return Date.now() - this._firstTriggeredAt.getTime();
  }

  /**
   * Get time since last trigger in milliseconds
   */
  getTimeSinceLastTrigger(): number {
    return Date.now() - this._lastTriggeredAt.getTime();
  }

  /**
   * Get time to acknowledgment in milliseconds (if acknowledged)
   */
  getTimeToAcknowledgment(): number | null {
    if (!this._acknowledgedAt) {
      return null;
    }
    return this._acknowledgedAt.getTime() - this._firstTriggeredAt.getTime();
  }

  /**
   * Get alarm duration in milliseconds (if cleared)
   */
  getDuration(): number | null {
    if (!this._clearedAt) {
      // Still active - calculate duration from first trigger to now
      return Date.now() - this._firstTriggeredAt.getTime();
    }
    return this._clearedAt.getTime() - this._firstTriggeredAt.getTime();
  }

  /**
   * Format alarm for display
   */
  formatMessage(): string {
    const parts: string[] = [this._message];

    if (this._value !== undefined) {
      parts.push(`Value: ${this._value}`);
    }

    if (this._threshold !== undefined) {
      parts.push(`Threshold: ${this._threshold}`);
    }

    if (this._triggerCount > 1) {
      parts.push(`(Occurred ${this._triggerCount} times)`);
    }

    return parts.join(' | ');
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get tenantId(): string {
    return this._tenantId;
  }

  get wellId(): string {
    return this._wellId;
  }

  get scadaConnectionId(): string {
    return this._scadaConnectionId;
  }

  get tagName(): string {
    return this._tagName;
  }

  get alarmType(): AlarmType {
    return this._alarmType;
  }

  get severity(): AlarmSeverity {
    return this._severity;
  }

  get state(): AlarmState {
    return this._state;
  }

  get message(): string {
    return this._message;
  }

  get value(): number | string | boolean | undefined {
    return this._value;
  }

  get threshold(): number | undefined {
    return this._threshold;
  }

  get triggerCount(): number {
    return this._triggerCount;
  }

  get firstTriggeredAt(): Date {
    return this._firstTriggeredAt;
  }

  get lastTriggeredAt(): Date {
    return this._lastTriggeredAt;
  }

  get acknowledgedAt(): Date | undefined {
    return this._acknowledgedAt;
  }

  get acknowledgedBy(): string | undefined {
    return this._acknowledgedBy;
  }

  get clearedAt(): Date | undefined {
    return this._clearedAt;
  }

  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Extract primitive values for persistence layer
   */
  toPrimitives(): AlarmProps {
    return {
      id: this._id,
      tenantId: this._tenantId,
      wellId: this._wellId,
      scadaConnectionId: this._scadaConnectionId,
      tagName: this._tagName,
      alarmType: this._alarmType,
      severity: this._severity,
      state: this._state,
      message: this._message,
      value: this._value,
      threshold: this._threshold,
      triggerCount: this._triggerCount,
      firstTriggeredAt: this._firstTriggeredAt,
      lastTriggeredAt: this._lastTriggeredAt,
      acknowledgedAt: this._acknowledgedAt,
      acknowledgedBy: this._acknowledgedBy,
      clearedAt: this._clearedAt,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
