/**
 * Production Module
 *
 * Wires up Production analytics with CQRS handlers and infrastructure.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductionController } from './production.controller';
import { WellRepository } from '../../infrastructure/database/repositories/well.repository';
import { FieldEntryRepository } from '../../infrastructure/database/repositories/field-entry.repository';

// Query Handlers
import { GetMonthlyTrendHandler } from '../../application/production/queries/get-monthly-trend.query';
import { GetWellTypeBreakdownHandler } from '../../application/production/queries/get-well-type-breakdown.query';

const QueryHandlers = [GetMonthlyTrendHandler, GetWellTypeBreakdownHandler];

const Repositories = [
  WellRepository,
  FieldEntryRepository,
  {
    provide: 'IWellRepository',
    useExisting: WellRepository,
  },
  {
    provide: 'IFieldEntryRepository',
    useExisting: FieldEntryRepository,
  },
];

@Module({
  imports: [CqrsModule],
  controllers: [ProductionController],
  providers: [...QueryHandlers, ...Repositories],
  exports: [],
})
export class ProductionModule {}
