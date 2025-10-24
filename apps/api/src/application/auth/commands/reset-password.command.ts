/**
 * Reset Password Command and Handler
 *
 * Handles password reset using reset token from forgot password flow.
 * Validates token and updates user password.
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';

/**
 * Reset Password Command
 */
export class ResetPasswordCommand {
  constructor(
    public readonly tenantId: string,
    public readonly token: string,
    public readonly newPassword: string,
  ) {}
}

/**
 * Reset Password Command Handler
 *
 * Business Rules:
 * - Token must be valid and not expired
 * - New password must meet strength requirements (validated in User entity)
 * - After reset, token is cleared
 * - Throws NotFoundException if token is invalid/expired
 */
@Injectable()
@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler
  implements ICommandHandler<ResetPasswordCommand, void>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    // 1. Find all users and locate the one with matching passwordResetToken
    const allUsers = await this.userRepository.findAll(command.tenantId);

    const user = allUsers.find((u) => u.passwordResetToken === command.token);

    // 2. If no user found, throw NotFoundException
    if (!user) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    // 3. Reset password (validates token expiry and password strength)
    try {
      await user.resetPassword(command.token, command.newPassword);
    } catch (error) {
      // Convert domain errors to NotFoundException for expired/invalid tokens
      if (
        error instanceof Error &&
        (error.message.includes('expired') || error.message.includes('Invalid'))
      ) {
        throw new NotFoundException('Invalid or expired reset token');
      }
      throw error;
    }

    // 4. Update user in repository
    await this.userRepository.update(command.tenantId, user);
  }
}
