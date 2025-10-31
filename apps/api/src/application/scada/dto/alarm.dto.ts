/**
 * Alarm DTO
 *
 * Data Transfer Object for alarm responses.
 * Represents SCADA alarm conditions and their lifecycle.
 */

import {
  Alarm,
  AlarmSeverity,
  AlarmState,
  AlarmType,
} from '../../../domain/scada/alarm.entity';

export class AlarmDto {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly wellId: string;
  public readonly scadaConnectionId: string;
  public readonly tagName: string;
  public readonly alarmType: AlarmType;
  public readonly severity: AlarmSeverity;
  public readonly state: AlarmState;
  public readonly message: string;
  public readonly value?: number | string | boolean;
  public readonly threshold?: number;
  public readonly triggerCount: number;
  public readonly firstTriggeredAt: string;
  public readonly lastTriggeredAt: string;
  public readonly acknowledgedAt?: string;
  public readonly acknowledgedBy?: string;
  public readonly clearedAt?: string;
  public readonly metadata?: Record<string, unknown>;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  private constructor(props: {
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
    firstTriggeredAt: string;
    lastTriggeredAt: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    clearedAt?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.wellId = props.wellId;
    this.scadaConnectionId = props.scadaConnectionId;
    this.tagName = props.tagName;
    this.alarmType = props.alarmType;
    this.severity = props.severity;
    this.state = props.state;
    this.message = props.message;
    this.value = props.value;
    this.threshold = props.threshold;
    this.triggerCount = props.triggerCount;
    this.firstTriggeredAt = props.firstTriggeredAt;
    this.lastTriggeredAt = props.lastTriggeredAt;
    this.acknowledgedAt = props.acknowledgedAt;
    this.acknowledgedBy = props.acknowledgedBy;
    this.clearedAt = props.clearedAt;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create DTO from domain entity
   */
  static fromDomain(alarm: Alarm): AlarmDto {
    return new AlarmDto({
      id: alarm.id,
      tenantId: alarm.tenantId,
      wellId: alarm.wellId,
      scadaConnectionId: alarm.scadaConnectionId,
      tagName: alarm.tagName,
      alarmType: alarm.alarmType,
      severity: alarm.severity,
      state: alarm.state,
      message: alarm.message,
      value: alarm.value,
      threshold: alarm.threshold,
      triggerCount: alarm.triggerCount,
      firstTriggeredAt: alarm.firstTriggeredAt.toISOString(),
      lastTriggeredAt: alarm.lastTriggeredAt.toISOString(),
      acknowledgedAt: alarm.acknowledgedAt?.toISOString(),
      acknowledgedBy: alarm.acknowledgedBy,
      clearedAt: alarm.clearedAt?.toISOString(),
      metadata: alarm.metadata,
      createdAt: alarm.createdAt.toISOString(),
      updatedAt: alarm.updatedAt.toISOString(),
    });
  }
}
