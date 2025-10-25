/**
 * Wells Module
 *
 * Wires up Wells domain with CQRS handlers and infrastructure.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WellsController } from './wells.controller';
import { WellRepository } from '../../infrastructure/database/repositories/well.repository';
import { WellsReadProjectionRepository } from '../../infrastructure/database/repositories/wells-read-projection.repository';

// Command Handlers
import { CreateWellHandler } from '../../application/wells/commands/create-well.command';
import { UpdateWellHandler } from '../../application/wells/commands/update-well.command';
import { DeleteWellHandler } from '../../application/wells/commands/delete-well.command';
import { ActivateWellHandler } from '../../application/wells/commands/activate-well.command';
import { DeactivateWellHandler } from '../../application/wells/commands/deactivate-well.command';

// Query Handlers
import { GetWellsHandler } from '../../application/wells/queries/get-wells.query';
import { GetWellByIdHandler } from '../../application/wells/queries/get-well-by-id.query';
import { GetWellByApiNumberHandler } from '../../application/wells/queries/get-well-by-api-number.query';

// Projection Event Handlers
import {
  WellCreatedProjectionHandler,
  WellUpdatedProjectionHandler,
  WellDeletedProjectionHandler,
} from '../../application/wells/projections/wells-projection-updater.handler';

const CommandHandlers = [
  CreateWellHandler,
  UpdateWellHandler,
  DeleteWellHandler,
  ActivateWellHandler,
  DeactivateWellHandler,
];

const QueryHandlers = [
  GetWellsHandler,
  GetWellByIdHandler,
  GetWellByApiNumberHandler,
];

const EventHandlers = [
  WellCreatedProjectionHandler,
  WellUpdatedProjectionHandler,
  WellDeletedProjectionHandler,
];

const Repositories = [
  WellRepository,
  WellsReadProjectionRepository,
  {
    provide: 'IWellRepository',
    useExisting: WellRepository,
  },
];

@Module({
  imports: [CqrsModule],
  controllers: [WellsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
    ...Repositories,
  ],
  exports: [],
})
export class WellsModule {}
