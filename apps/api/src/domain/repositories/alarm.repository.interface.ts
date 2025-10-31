/**
 * Alarm Repository Interface
 *
 * Defines the contract for alarm persistence operations.
 * This interface lives in the domain layer and is implemented by the infrastructure layer.
 */

import { Alarm, AlarmSeverity, AlarmState } from '../scada/alarm.entity';

export interface AlarmFilters {
  wellId?: string;
  scadaConnectionId?: string;
  severity?: AlarmSeverity;
  state?: AlarmState;
  tagName?: string;
}

export interface IAlarmRepository {
  /**
   * Find alarm by ID
   */
  findById(tenantId: string, alarmId: string): Promise<Alarm | null>;

  /**
   * Find active alarms (not cleared)
   */
  findActive(tenantId: string, filters?: AlarmFilters): Promise<Alarm[]>;

  /**
   * Find alarms by state
   */
  findByState(
    tenantId: string,
    state: AlarmState,
    filters?: AlarmFilters,
  ): Promise<Alarm[]>;

  /**
   * Find all alarms with filters
   */
  findWithFilters(tenantId: string, filters: AlarmFilters): Promise<Alarm[]>;

  /**
   * Find existing alarm for same condition (for retriggering)
   */
  findExistingAlarm(
    tenantId: string,
    wellId: string,
    scadaConnectionId: string,
    tagName: string,
    alarmType: string,
  ): Promise<Alarm | null>;

  /**
   * Save (create or update) alarm
   */
  save(alarm: Alarm): Promise<void>;

  /**
   * Count active alarms by severity
   */
  countActiveBySeverity(
    tenantId: string,
    severity?: AlarmSeverity,
  ): Promise<number>;

  /**
   * Count active alarms for a specific well
   */
  countActiveForWell(tenantId: string, wellId: string): Promise<number>;

  /**
   * Delete alarm
   */
  delete(tenantId: string, alarmId: string): Promise<void>;
}
