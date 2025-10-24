/**
 * Register User Command and Handler
 *
 * Implements user registration with email verification.
 * First user in tenant automatically becomes ADMIN and is auto-verified.
 */

import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/users/user.entity';
import { EmailService } from '../../../infrastructure/services/email.service';

/**
 * Register User Command
 */
export class RegisterUserCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly password: string,
    public readonly name: string,
    public readonly databaseName?: string,
  ) {}
}

/**
 * Register User Command Handler Result
 */
export interface RegisterUserResult {
  userId: string;
  requiresVerification: boolean;
}

/**
 * Register User Command Handler
 *
 * Business Rules:
 * - Email must be unique within tenant
 * - First user automatically becomes ADMIN and is auto-verified
 * - Subsequent users start as OPERATOR and require email verification
 * - Verification email sent only to non-first users
 */
@Injectable()
@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler
  implements ICommandHandler<RegisterUserCommand, RegisterUserResult>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    // 1. Check if email already exists
    const existingUser = await this.userRepository.findByEmail(
      command.tenantId,
      command.email,
      command.databaseName,
    );

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // 2. Check if this is the first user (auto-admin)
    const userCount = await this.userRepository.count(command.tenantId, {
      databaseName: command.databaseName,
    });
    const isFirstUser = userCount === 0;

    // 3. Create user entity
    const user = await User.create({
      email: command.email,
      password: command.password,
      name: command.name,
      role: isFirstUser ? 'ADMIN' : 'OPERATOR',
    });

    // 4. If first user, auto-verify and activate
    if (isFirstUser && user.emailVerificationCode) {
      user.verifyEmail(user.emailVerificationCode);
    }

    // 5. Save to repository
    await this.userRepository.save(
      command.tenantId,
      user,
      command.databaseName,
    );

    // 6. Send verification email (if not first user)
    if (!isFirstUser && user.emailVerificationCode) {
      await this.emailService.sendVerificationEmail(
        command.email,
        user.emailVerificationCode,
        command.tenantId,
      );
    }

    return {
      userId: user.id,
      requiresVerification: !isFirstUser,
    };
  }
}
