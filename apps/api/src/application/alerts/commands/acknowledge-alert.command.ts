/**
 * Acknowledge Alert Command and Handler
 *
 * Marks an alert as acknowledged by a user, indicating it has been reviewed.
 * Alerts are immutable, so acknowledgement creates a new version with updated metadata.
 */

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IAlertRepository } from '../../../domain/repositories/alert.repository.interface';

/**
 * Acknowledge Alert Command
 */
export class AcknowledgeAlertCommand {
  constructor(
    public readonly tenantId: string,
    public readonly alertId: string,
    public readonly userId: string,
  ) {}
}

/**
 * Acknowledge Alert Command Handler
 *
 * Business Rules:
 * - Alert must exist and belong to the tenant
 * - Alert cannot be acknowledged twice
 * - Records the user who acknowledged and the timestamp
 * - All roles can acknowledge alerts (enforced at controller level)
 */
@Injectable()
@CommandHandler(AcknowledgeAlertCommand)
export class AcknowledgeAlertHandler
  implements ICommandHandler<AcknowledgeAlertCommand, void>
{
  constructor(
    @Inject('IAlertRepository')
    private readonly alertRepository: IAlertRepository,
  ) {}

  async execute(command: AcknowledgeAlertCommand): Promise<void> {
    // 1. Find the alert
    const alert = await this.alertRepository.findById(
      command.tenantId,
      command.alertId,
    );

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${command.alertId} not found`);
    }

    // 2. Acknowledge alert (domain entity throws error if already acknowledged)
    const acknowledgedAlert = alert.acknowledge(command.userId);

    // 3. Save the acknowledged alert
    await this.alertRepository.acknowledge(acknowledgedAlert);
  }
}
