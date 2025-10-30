import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SyncController } from './sync.controller';
import { SyncService } from '../../application/sync/sync.service';
import { WellRepository } from '../../infrastructure/database/repositories/well.repository';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { FieldDataModule } from '../field-data/field-data.module';

const Repositories = [
  {
    provide: 'IWellRepository',
    useClass: WellRepository,
  },
  {
    provide: 'IUserRepository',
    useClass: UserRepository,
  },
];

@Module({
  imports: [CqrsModule, DatabaseModule, FieldDataModule],
  controllers: [SyncController],
  providers: [SyncService, ...Repositories],
  exports: [SyncService],
})
export class SyncModule {}
