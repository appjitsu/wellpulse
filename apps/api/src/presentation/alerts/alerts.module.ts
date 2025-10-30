/**
 * Alerts Module
 *
 * Presentation layer module for alerts REST API.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [CqrsModule],
  controllers: [AlertsController],
})
export class AlertsModule {}
