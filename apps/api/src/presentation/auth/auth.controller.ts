/**
 * Auth Controller
 *
 * REST API endpoints for authentication and user management.
 * All endpoints are public (no authentication required).
 *
 * Endpoints:
 * - POST /auth/register - Register new user
 * - POST /auth/verify-email - Verify email address
 * - POST /auth/login - Login (sets httpOnly refresh token cookie)
 * - POST /auth/logout - Logout (clears refresh token cookie)
 * - POST /auth/refresh - Refresh access token (reads from cookie)
 * - POST /auth/forgot-password - Request password reset
 * - POST /auth/reset-password - Reset password with token
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Public } from '../decorators/public.decorator';
import { TenantId } from '../decorators/tenant-id.decorator';
import {
  TenantContext,
  TenantContextDto,
} from '../../infrastructure/decorators/tenant-context.decorator';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterUserCommand } from '../../application/auth/commands/register-user.command';
import { VerifyEmailCommand } from '../../application/auth/commands/verify-email.command';
import { LoginCommand } from '../../application/auth/commands/login.command';
import { RefreshTokenCommand } from '../../application/auth/commands/refresh-token.command';
import { ForgotPasswordCommand } from '../../application/auth/commands/forgot-password.command';
import { ResetPasswordCommand } from '../../application/auth/commands/reset-password.command';

@Controller('auth')
export class AuthController {
  // Cookie configuration
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
  private readonly COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor(private readonly commandBus: CommandBus) {}

  /**
   * Register new user
   * POST /auth/register
   *
   * First user in tenant automatically becomes ADMIN and is auto-verified.
   * Subsequent users start as OPERATOR and receive email verification code.
   *
   * Rate limit: 3 requests per hour per IP
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @TenantContext() tenant: TenantContextDto | undefined,
    @Body() dto: RegisterDto,
  ): Promise<{
    message: string;
    userId: string;
    requiresVerification: boolean;
  }> {
    if (!tenant) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const command = new RegisterUserCommand(
      tenant.id,
      dto.email,
      dto.password,
      dto.name,
      tenant.databaseName,
    );

    const result = await this.commandBus.execute<
      RegisterUserCommand,
      { userId: string; requiresVerification: boolean }
    >(command);

    return {
      message: result.requiresVerification
        ? 'Registration successful. Please check your email for verification code.'
        : 'Registration successful. You can now log in.',
      userId: result.userId,
      requiresVerification: result.requiresVerification,
    };
  }

  /**
   * Verify email address
   * POST /auth/verify-email
   *
   * Activates user account after successful verification.
   *
   * Rate limit: 10 requests per 15 minutes per IP
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @TenantId() tenantId: string | undefined,
    @Body() dto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const command = new VerifyEmailCommand(tenantId, dto.email, dto.code);

    await this.commandBus.execute(command);

    return {
      message: 'Email verified successfully. You can now log in.',
    };
  }

  /**
   * Login
   * POST /auth/login
   *
   * Authenticates user and returns access token.
   * Sets refresh token as httpOnly cookie.
   *
   * Rate limit: 5 requests per 15 minutes per IP (brute force protection)
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @TenantContext() tenant: TenantContextDto | undefined,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    message: string;
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  }> {
    if (!tenant) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const command = new LoginCommand(
      tenant.id,
      dto.email,
      dto.password,
      tenant.databaseName,
    );

    const result = await this.commandBus.execute<
      LoginCommand,
      {
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          email: string;
          name: string;
          role: string;
        };
      }
    >(command);

    // Set refresh token as httpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      message: 'Login successful',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * Logout
   * POST /auth/logout
   *
   * Clears refresh token cookie.
   *
   * No rate limit (safe operation)
   */
  @Public()
  @SkipThrottle() // Skip rate limiting for logout
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { message: string } {
    // Clear refresh token cookie
    this.clearRefreshTokenCookie(res);

    return {
      message: 'Logout successful',
    };
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   *
   * Reads refresh token from httpOnly cookie and generates new access token.
   * Rotates refresh token for security.
   *
   * Rate limit: 10 requests per 15 minutes per IP
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @TenantId() tenantId: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string; accessToken: string }> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    // Get refresh token from cookie
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[this.REFRESH_TOKEN_COOKIE];

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token not found');
    }

    const command = new RefreshTokenCommand(tenantId, refreshToken);

    const result = await this.commandBus.execute<
      RefreshTokenCommand,
      { accessToken: string; refreshToken: string }
    >(command);

    // Set new refresh token as httpOnly cookie (token rotation)
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
    };
  }

  /**
   * Forgot password
   * POST /auth/forgot-password
   *
   * Generates password reset token and sends reset email.
   * Always returns success for security (doesn't reveal if email exists).
   *
   * Rate limit: 3 requests per hour per IP (prevent abuse)
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @TenantId() tenantId: string | undefined,
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const command = new ForgotPasswordCommand(tenantId, dto.email);

    await this.commandBus.execute(command);

    return {
      message:
        'If an account exists with this email, a password reset link has been sent.',
    };
  }

  /**
   * Reset password
   * POST /auth/reset-password
   *
   * Resets user password using reset token from email.
   *
   * Rate limit: 10 requests per 15 minutes per IP
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @TenantId() tenantId: string | undefined,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const command = new ResetPasswordCommand(
      tenantId,
      dto.token,
      dto.newPassword,
    );

    await this.commandBus.execute(command);

    return {
      message: 'Password reset successfully. You can now log in.',
    };
  }

  /**
   * Set refresh token as httpOnly cookie
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(this.REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.COOKIE_MAX_AGE,
    });
  }

  /**
   * Clear refresh token cookie
   */
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }
}
