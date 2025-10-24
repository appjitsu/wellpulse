import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersController } from './users.controller';
import { GetUsersHandler } from '../../application/users/queries/get-users.query';
import { UpdateUserRoleHandler } from '../../application/users/commands/update-user-role.command';
import { SuspendUserHandler } from '../../application/users/commands/suspend-user.command';
import { ActivateUserHandler } from '../../application/users/commands/activate-user.command';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { TenantDatabaseService } from '../../infrastructure/database/tenant-database.service';

const CommandHandlers = [
  UpdateUserRoleHandler,
  SuspendUserHandler,
  ActivateUserHandler,
];

const QueryHandlers = [GetUsersHandler];

const Repositories = [
  UserRepository,
  {
    provide: 'IUserRepository',
    useExisting: UserRepository,
  },
];

@Module({
  imports: [CqrsModule],
  controllers: [UsersController],
  providers: [
    TenantDatabaseService,
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
  ],
  exports: [],
})
export class UsersModule {}
