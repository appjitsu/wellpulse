/**
 * Login Command and Handler
 *
 * Handles user authentication and JWT token generation.
 * Validates credentials, checks account status, and generates access/refresh tokens.
 */

import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { ITenantRepository } from '../../../domain/repositories/tenant.repository.interface';

/**
 * Login Command
 */
export class LoginCommand {
  constructor(
    public readonly tenantId: string,
    public readonly email: string,
    public readonly password: string,
    public readonly databaseName?: string,
    public readonly isMobileOrDesktop?: boolean, // Flag to indicate mobile/desktop app login
  ) {}
}

/**
 * Login Result
 */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  tenantSecret?: string; // Only returned for first-time mobile/desktop login (when lastLoginAt is null)
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
 * Login Command Handler
 *
 * Business Rules:
 * - User must exist in tenant
 * - User must not be suspended
 * - Password must match stored hash
 * - Email must be verified
 * - Access token expires in 15 minutes
 * - Refresh token expires in 7 days
 * - Last login timestamp updated on success
 */
@Injectable()
@CommandHandler(LoginCommand)
export class LoginHandler
  implements ICommandHandler<LoginCommand, LoginResult>
{
  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    @Inject('ITenantRepository')
    private readonly tenantRepository: ITenantRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(
      command.tenantId,
      command.email,
      command.databaseName,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Check if suspended
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }

    // 3. Verify password
    const isPasswordValid = await user.verifyPassword(command.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 4. Check email verification
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // 5. Generate tokens
    const accessToken = this.generateAccessToken(user.id, {
      email: user.email,
      role: user.role,
      tenantId: command.tenantId,
    });

    const refreshToken = this.generateRefreshToken(user.id);

    // 6. Check if this is first login (for mobile/desktop secret generation)
    const isFirstLogin = user.lastLoginAt === null;

    // 7. Update last login timestamp
    user.updateLastLogin();
    await this.userRepository.update(
      command.tenantId,
      user,
      command.databaseName,
    );

    // 8. Generate tenant secret ONLY for first-time mobile/desktop login
    let tenantSecret: string | undefined;
    if (command.isMobileOrDesktop && isFirstLogin) {
      // Retrieve tenant to rotate secret
      const tenant = await this.tenantRepository.findById(command.tenantId);
      if (tenant) {
        // For mobile/desktop apps, return the tenant secret on FIRST login only
        // This is the ONLY time the plaintext secret is sent to the client
        // The client must securely store it in iOS Keychain or Android EncryptedSharedPreferences
        //
        // Security: Secret rotation only happens on first login to prevent invalidating
        // existing mobile installations. If a user needs a new secret (lost device),
        // they should use a dedicated "rotate secret" endpoint.
        const { newSecret, tenant: updatedTenant } = tenant.rotateSecretKey();
        await this.tenantRepository.update(updatedTenant);
        tenantSecret = newSecret;
      }
    }

    // 9. Return result
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tenantSecret, // Only populated for mobile/desktop first-time login
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
