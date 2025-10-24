/**
 * Verify Email Command and Handler
 *
 * Handles email verification using verification code.
 * Activates user account after successful verification.
 */

import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';

/**
 * Verify Email Command
 */
export class VerifyEmailCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly code: string,
  ) {}
}

/**
 * Verify Email Command Handler
 *
 * Business Rules:
 * - User must exist in tenant
 * - If already verified, silently succeeds
 * - Verification code must match exactly
 * - Verification code must not be expired
 * - After verification, user status becomes ACTIVE
 */
@Injectable()
@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler
  implements ICommandHandler<VerifyEmailCommand, void>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<void> {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(
      command.tenantId,
      command.email,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. If already verified, return silently
    if (user.emailVerified) {
      return;
    }

    // 3. Verify email with code (throws if invalid/expired)
    user.verifyEmail(command.code);

    // 4. Update user in repository
    await this.userRepository.update(command.tenantId, user);
  }
}
