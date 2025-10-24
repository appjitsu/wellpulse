/**
 * Forgot Password Command and Handler
 *
 * Handles password reset request by generating a reset token
 * and sending password reset email.
 */

import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { EmailService } from '../../../infrastructure/services/email.service';

/**
 * Forgot Password Command
 */
export class ForgotPasswordCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
  ) {}
}

/**
 * Forgot Password Command Handler
 *
 * Business Rules:
 * - If user not found, return silently (security best practice - don't reveal if email exists)
 * - Generate password reset token with 1 hour expiry
 * - Send password reset email with token
 * - Token is UUID format, expires after 1 hour
 */
@Injectable()
@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler
  implements ICommandHandler<ForgotPasswordCommand, void>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<void> {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(
      command.tenantId,
      command.email,
    );

    // 2. If user not found, return silently (security best practice)
    if (!user) {
      return;
    }

    // 3. Generate password reset token
    const resetToken = user.generatePasswordResetToken();

    // 4. Update user in repository
    await this.userRepository.update(command.tenantId, user);

    // 5. Send password reset email
    await this.emailService.sendPasswordResetEmail(
      command.email,
      resetToken,
      command.tenantId,
    );
  }
}
