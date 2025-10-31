/**
 * Acknowledge Alarm Command and Handler
 *
 * Implements alarm acknowledgment to track operator response to alarms.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IAlarmRepository } from '../../../../domain/repositories/alarm.repository.interface';

/**
 * Acknowledge Alarm Command
 */
export class AcknowledgeAlarmCommand {
  constructor(
    public readonly tenantId: string,
    public readonly alarmId: string,
    public readonly acknowledgedBy: string,
  ) {}
}

/**
 * Acknowledge Alarm Command Handler
 *
 * Business Rules:
 * - Alarm must exist and be in ACTIVE state
 * - Cannot acknowledge already acknowledged alarms
 * - Cannot acknowledge cleared alarms
 * - Records who acknowledged the alarm and when
 * - Critical alarms must be acknowledged before they can be cleared
 */
@Injectable()
@CommandHandler(AcknowledgeAlarmCommand)
export class AcknowledgeAlarmHandler
  implements ICommandHandler<AcknowledgeAlarmCommand, void>
{
  constructor(
    @Inject('IAlarmRepository')
    private readonly alarmRepository: IAlarmRepository,
  ) {}

  async execute(command: AcknowledgeAlarmCommand): Promise<void> {
    // 1. Load existing alarm
    const alarm = await this.alarmRepository.findById(
      command.tenantId,
      command.alarmId,
    );

    if (!alarm) {
      throw new NotFoundException('Alarm not found');
    }

    // 2. Acknowledge alarm through domain entity method (validates state transitions)
    try {
      alarm.acknowledge(command.acknowledgedBy);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    // 3. Persist changes
    await this.alarmRepository.save(alarm);
  }
}
