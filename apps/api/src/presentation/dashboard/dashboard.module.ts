/**
 * Dashboard Module
 *
 * Provides dashboard analytics endpoints for the web application.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DashboardController } from './dashboard.controller';
import {
  GetDashboardMetricsHandler,
  GetWellStatusHandler,
  GetRecentActivityHandler,
  GetTopProducersHandler,
} from '../../application/dashboard/queries';
import { WellRepository } from '../../infrastructure/database/repositories/well.repository';
import { FieldEntryRepository } from '../../infrastructure/database/repositories/field-entry.repository';
import { AlertRepository } from '../../infrastructure/database/repositories/alert.repository';

const QueryHandlers = [
  GetDashboardMetricsHandler,
  GetWellStatusHandler,
  GetRecentActivityHandler,
  GetTopProducersHandler,
];

const Repositories = [
  WellRepository,
  FieldEntryRepository,
  AlertRepository,
  {
    provide: 'IWellRepository',
    useExisting: WellRepository,
  },
  {
    provide: 'IFieldEntryRepository',
    useExisting: FieldEntryRepository,
  },
  {
    provide: 'IAlertRepository',
    useExisting: AlertRepository,
  },
];

@Module({
  imports: [CqrsModule],
  controllers: [DashboardController],
  providers: [...QueryHandlers, ...Repositories],
})
export class DashboardModule {}
