import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { FieldDataController } from './field-data.controller';
import { CreateFieldEntryHandler } from '../../application/field-data/commands/create-field-entry/create-field-entry.handler';
import { GetFieldEntriesHandler } from '../../application/field-data/queries/get-field-entries/get-field-entries.handler';
import { FieldEntryRepository } from '../../infrastructure/database/repositories/field-entry.repository';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { EmailService } from '../../infrastructure/services/email.service';

const CommandHandlers = [CreateFieldEntryHandler];

const QueryHandlers = [GetFieldEntriesHandler];

const Repositories = [
  {
    provide: 'IFieldEntryRepository',
    useClass: FieldEntryRepository,
  },
];

@Module({
  imports: [CqrsModule, DatabaseModule],
  controllers: [FieldDataController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
    EmailService,
  ],
  exports: [...Repositories],
})
export class FieldDataModule {}
