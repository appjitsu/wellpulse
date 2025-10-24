/**
 * Update User Role Command
 *
 * Changes a user's role (ADMIN, MANAGER, OPERATOR).
 * Admin-only operation.
 */

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { UserRole } from '../../../domain/users/user.entity';

export class UpdateUserRoleCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly newRole: UserRole,
    public readonly performedBy: string, // ID of admin performing the action
  ) {}
}

@CommandHandler(UpdateUserRoleCommand)
export class UpdateUserRoleHandler
  implements ICommandHandler<UpdateUserRoleCommand>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: UpdateUserRoleCommand): Promise<void> {
    // Get the user to update
    const user = await this.userRepository.findById(
      command.tenantId,
      command.userId,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent demoting the last admin
    if (user.role === 'ADMIN' && command.newRole !== 'ADMIN') {
      const adminCount = await this.userRepository.count(command.tenantId, {
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last admin. Promote another user to admin first.',
        );
      }
    }

    // Update role
    user.changeRole(command.newRole);

    await this.userRepository.update(command.tenantId, user);
  }
}
