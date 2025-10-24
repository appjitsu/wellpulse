/**
 * Refresh Token Command and Handler
 *
 * Handles token refresh using refresh token.
 * Generates new access token and optionally rotates refresh token.
 */

import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';

/**
 * Refresh Token Command
 */
export class RefreshTokenCommand {
  constructor(
    public readonly tenantId: string,
    public readonly refreshToken: string,
  ) {}
}

/**
 * Refresh Token Result
 */
export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

/**
 * JWT Access Token Payload
 */
interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
}

/**
 * JWT Refresh Token Payload
 */
interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

/**
 * Refresh Token Command Handler
 *
 * Business Rules:
 * - Refresh token must be valid and not expired
 * - User must exist and be active
 * - User must not be suspended
 * - Generates new access token (15 minutes)
 * - Rotates refresh token for security (7 days)
 */
@Injectable()
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler
  implements ICommandHandler<RefreshTokenCommand, RefreshTokenResult>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    // 1. Verify and decode refresh token
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(
        command.refreshToken,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Validate token type
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // 3. Find user by ID from token
    const user = await this.userRepository.findById(
      command.tenantId,
      payload.sub,
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 4. Check if user is suspended
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }

    // 5. Check if user is active
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account not active');
    }

    // 6. Generate new access token
    const accessToken = this.generateAccessToken(user.id, {
      email: user.email,
      role: user.role,
      tenantId: command.tenantId,
    });

    // 7. Rotate refresh token (security best practice)
    const newRefreshToken = this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Generate access token (short-lived, 15 minutes)
   */
  private generateAccessToken(
    userId: string,
    data: { email: string; role: string; tenantId: string },
  ): string {
    const payload: AccessTokenPayload = {
      sub: userId,
      email: data.email,
      role: data.role,
      tenantId: data.tenantId,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '15m',
    });
  }

  /**
   * Generate refresh token (long-lived, 7 days)
   */
  private generateRefreshToken(userId: string): string {
    const payload: RefreshTokenPayload = {
      sub: userId,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
  }
}
