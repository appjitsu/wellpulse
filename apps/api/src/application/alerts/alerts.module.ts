/**
 * Alerts Module
 *
 * Wires up Alerts domain with CQRS handlers and infrastructure.
 * Manages alert creation, acknowledgement, and notifications.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';

// Command Handlers
import { AcknowledgeAlertHandler } from './commands/acknowledge-alert.command';

// Query Handlers
import { GetAlertHistoryHandler } from './queries/get-alert-history.query';
import { GetAlertStatsHandler } from './queries/get-alert-stats.query';
import { GetRecentAlertsHandler } from './queries/get-recent-alerts.query';

// Services
import { AlertNotificationService } from './services/alert-notification.service';
import { EmailService } from '../../infrastructure/services/email.service';

const CommandHandlers = [AcknowledgeAlertHandler];

const QueryHandlers = [
  GetAlertHistoryHandler,
  GetAlertStatsHandler,
  GetRecentAlertsHandler,
];

const Services = [AlertNotificationService, EmailService];

/**
 * Alerts Module
 *
 * Note: This module only provides application layer components.
 * Infrastructure (repositories) and presentation (controllers) are wired up
 * in their respective modules in the infrastructure and presentation layers.
 */
@Module({
  imports: [CqrsModule, ConfigModule],
  providers: [...CommandHandlers, ...QueryHandlers, ...Services],
  exports: [AlertNotificationService], // Export service for use in other modules
})
export class AlertsModule {}
