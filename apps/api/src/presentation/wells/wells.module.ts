/**
 * Wells Module
 *
 * Wires up Wells domain with CQRS handlers and infrastructure.
 */

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WellsController } from './wells.controller';
import { WellRepository } from '../../infrastructure/database/repositories/well.repository';
import { TenantDatabaseService } from '../../infrastructure/database/tenant-database.service';

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

const Repositories = [
  WellRepository,
  {
    provide: 'IWellRepository',
    useExisting: WellRepository,
  },
];

@Module({
  imports: [CqrsModule],
  controllers: [WellsController],
  providers: [
    TenantDatabaseService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
  ],
  exports: [],
})
export class WellsModule {}
