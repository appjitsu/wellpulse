/**
 * Activate User Command
 *
 * Activates a suspended user account.
 * Admin-only operation.
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';

export class ActivateUserCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly performedBy: string, // ID of admin performing the action
  ) {}
}

@CommandHandler(ActivateUserCommand)
export class ActivateUserHandler
  implements ICommandHandler<ActivateUserCommand>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: ActivateUserCommand): Promise<void> {
    const user = await this.userRepository.findById(
      command.tenantId,
      command.userId,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.activate();

    await this.userRepository.update(command.tenantId, user);
  }
}
