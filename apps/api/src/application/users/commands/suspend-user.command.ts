/**
 * Suspend User Command
 *
 * Suspends a user account, preventing login.
 * Admin-only operation.
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';

export class SuspendUserCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly performedBy: string, // ID of admin performing the action
  ) {}
}

@CommandHandler(SuspendUserCommand)
export class SuspendUserHandler implements ICommandHandler<SuspendUserCommand> {
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: SuspendUserCommand): Promise<void> {
    const user = await this.userRepository.findById(
      command.tenantId,
      command.userId,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent suspending the last admin
    if (user.role === 'ADMIN' && user.status === 'ACTIVE') {
      const activeAdminCount = await this.userRepository.count(
        command.tenantId,
        {
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      );

      if (activeAdminCount <= 1) {
        throw new BadRequestException('Cannot suspend the last active admin');
      }
    }

    user.suspend();

    await this.userRepository.update(command.tenantId, user);
  }
}
