/**
 * Get Active Alarms Query
 *
 * Retrieves active and acknowledged alarms (excluding cleared alarms).
 */

import { AlarmSeverity } from '../../../../domain/scada/alarm.entity';

export class GetActiveAlarmsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId?: string,
    public readonly severity?: AlarmSeverity,
  ) {}
}
