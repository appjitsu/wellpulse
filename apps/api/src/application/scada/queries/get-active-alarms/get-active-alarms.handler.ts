/**
 * Get Active Alarms Query Handler
 *
 * Retrieves active and acknowledged alarms (excluding cleared alarms).
 */

import { Injectable, Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IAlarmRepository } from '../../../../domain/repositories/alarm.repository.interface';
import { AlarmDto } from '../../dto/alarm.dto';
import { GetActiveAlarmsQuery } from './get-active-alarms.query';

@Injectable()
@QueryHandler(GetActiveAlarmsQuery)
export class GetActiveAlarmsHandler
  implements IQueryHandler<GetActiveAlarmsQuery, AlarmDto[]>
{
  constructor(
    @Inject('IAlarmRepository')
    private readonly alarmRepository: IAlarmRepository,
  ) {}

  async execute(query: GetActiveAlarmsQuery): Promise<AlarmDto[]> {
    // Fetch active alarms (ACTIVE and ACKNOWLEDGED states, not CLEARED)
    const alarms = await this.alarmRepository.findActive(query.tenantId, {
      wellId: query.wellId,
      severity: query.severity,
    });

    // Convert to DTOs and sort by priority (critical first, then by trigger time)
    return alarms
      .sort((a, b) => {
        // First, sort by priority (lower priority number = more important)
        const priorityDiff = a.getPriority() - b.getPriority();
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        // If same priority, sort by most recent trigger time
        return b.lastTriggeredAt.getTime() - a.lastTriggeredAt.getTime();
      })
      .map((alarm) => AlarmDto.fromDomain(alarm));
  }
}
