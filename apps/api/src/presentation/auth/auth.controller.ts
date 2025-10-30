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
  Get,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { CommandBus } from '@nestjs/cqrs';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
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
import { AzureAdLoginDto } from './dto/azure-ad-login.dto';
import { RegisterUserCommand } from '../../application/auth/commands/register-user.command';
import { VerifyEmailCommand } from '../../application/auth/commands/verify-email.command';
import { LoginCommand } from '../../application/auth/commands/login.command';
import { RefreshTokenCommand } from '../../application/auth/commands/refresh-token.command';
import { ForgotPasswordCommand } from '../../application/auth/commands/forgot-password.command';
import { ResetPasswordCommand } from '../../application/auth/commands/reset-password.command';
import { LoginAzureAdCommand } from '../../application/auth/commands/login-azure-ad.command';
import { TokenBlacklistService } from '../../infrastructure/services/token-blacklist.service';

@Controller('auth')
export class AuthController {
  // Cookie configuration
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
  private readonly COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor(
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

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
   * Sets refresh token as httpOnly cookie (web apps only).
   *
   * For mobile/desktop apps (detected by X-Tenant-ID header presence):
   * - Returns tenantSecret on first login (must be securely stored in device keychain)
   * - Does NOT set httpOnly cookie (mobile/desktop use local storage for refresh token)
   *
   * Rate limit: 100 requests per 15 minutes per IP in dev (generous for testing)
   *             5 requests per 15 minutes per IP in prod (brute force protection)
   */
  @Public()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 5 : 100,
      ttl: 900000,
    },
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @TenantContext() tenant: TenantContextDto | undefined,
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    message: string;
    accessToken: string;
    refreshToken?: string; // Only for mobile/desktop (web uses httpOnly cookie)
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    tenantId?: string; // Returned for mobile/desktop apps
    tenantSecret?: string; // Returned ONCE for mobile/desktop first-time login
  }> {
    if (!tenant) {
      throw new UnauthorizedException('Tenant context is required');
    }

    // Detect mobile/desktop app by presence of X-Tenant-ID header
    const isMobileOrDesktop = !!req.headers['x-tenant-id'];

    const command = new LoginCommand(
      tenant.id,
      dto.email,
      dto.password,
      tenant.databaseName,
      isMobileOrDesktop,
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
        tenantSecret?: string;
      }
    >(command);

    // For web apps: Set refresh token as httpOnly cookie
    // For mobile/desktop: Return refresh token in response (stored in secure storage)
    if (!isMobileOrDesktop) {
      this.setRefreshTokenCookie(res, result.refreshToken);
    }

    return {
      message: 'Login successful',
      accessToken: result.accessToken,
      refreshToken: isMobileOrDesktop ? result.refreshToken : undefined,
      user: result.user,
      tenantId: isMobileOrDesktop ? tenant.subdomain : undefined, // Return subdomain as tenantId for display
      tenantSecret: result.tenantSecret, // Only populated for mobile/desktop first-time login
    };
  }

  /**
   * Logout
   * POST /auth/logout
   *
   * Blacklists access and refresh tokens, clears refresh token cookie.
   *
   * No rate limit (safe operation)
   */
  @Public()
  @SkipThrottle() // Skip rate limiting for logout
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    try {
      // Extract access token from Authorization header
      const accessToken = this.extractTokenFromHeader(req);

      // Extract refresh token from cookie or request body
      const refreshToken =
        req.cookies?.[this.REFRESH_TOKEN_COOKIE] || req.body?.refreshToken;

      // Get user ID from decoded token (if available)
      const userId = (req as any).user?.id || 'unknown';

      // Blacklist access token if present
      if (accessToken) {
        await this.tokenBlacklistService.blacklistToken(
          accessToken,
          userId,
          3600, // 1 hour TTL (access tokens typically expire in 15-60 mins)
        );
      }

      // Blacklist refresh token if present
      if (refreshToken) {
        await this.tokenBlacklistService.blacklistToken(
          refreshToken,
          userId,
          604800, // 7 days TTL (refresh tokens expire in 7 days)
        );
      }

      // Clear refresh token cookie
      this.clearRefreshTokenCookie(res);

      return {
        message: 'Logout successful',
      };
    } catch (error) {
      // Even if blacklisting fails, clear the cookie
      this.clearRefreshTokenCookie(res);

      return {
        message: 'Logout successful',
      };
    }
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
      // Secure must be true when SameSite=None (required by browsers)
      // localhost is treated as secure context, so this works in development
      secure: true,
      // Use 'lax' in development (same subdomain, different ports)
      // Use 'strict' in production for better security
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      // Don't set domain in development - cookies will be same-origin only
      // This means the cookie will only work for the exact origin that set it
      // In production, set domain for subdomain sharing
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN
          : undefined,
      path: '/',
      maxAge: this.COOKIE_MAX_AGE,
    });
  }

  /**
   * Clear refresh token cookie
   */
  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      domain:
        process.env.NODE_ENV === 'production'
          ? process.env.COOKIE_DOMAIN
          : undefined,
      path: '/',
    });
  }

  /**
   * Extract JWT token from Authorization header
   */
  private extractTokenFromHeader(req: Request): string | null {
    const authHeader = req.headers['authorization'] as string;

    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  /**
   * Azure AD Configuration
   * GET /auth/azure-ad/config
   *
   * Returns Azure AD configuration for frontend MSAL initialization.
   * Public endpoint - no authentication required.
   *
   * Rate limit: 10 requests per minute (default)
   */
  @Public()
  @Get('azure-ad/config')
  @HttpCode(HttpStatus.OK)
  getAzureAdConfig(): {
    clientId: string;
    tenantId: string;
    redirectUri: string;
  } {
    const clientId = this.configService.get<string>('AZURE_AD_CLIENT_ID');
    const tenantId = this.configService.get<string>('AZURE_AD_TENANT_ID');
    const redirectUri = this.configService.get<string>('AZURE_AD_REDIRECT_URI');

    if (!clientId || !tenantId) {
      throw new UnauthorizedException('Azure AD is not configured');
    }

    return {
      clientId,
      tenantId,
      redirectUri: redirectUri || 'https://wellpulse.io/auth/callback',
    };
  }

  /**
   * Login with Azure AD
   * POST /auth/azure-ad
   *
   * Authenticates user with Azure AD token and returns WellPulse JWT tokens.
   * Sets refresh token as httpOnly cookie (web apps only).
   *
   * Flow:
   * 1. Frontend obtains Azure AD token using MSAL library
   * 2. Frontend sends token to this endpoint
   * 3. Backend validates token, finds/creates user
   * 4. Backend returns WellPulse JWT tokens
   *
   * Rate limit: 100 requests per 15 minutes per IP in dev (generous for testing)
   *             10 requests per 15 minutes per IP in prod (prevent abuse)
   */
  @Public()
  @Throttle({
    default: {
      limit: process.env.NODE_ENV === 'production' ? 10 : 100,
      ttl: 900000,
    },
  })
  @Post('azure-ad')
  @HttpCode(HttpStatus.OK)
  async loginWithAzureAd(
    @TenantContext() tenant: TenantContextDto | undefined,
    @Body() dto: AzureAdLoginDto,
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

    const command = new LoginAzureAdCommand(
      tenant.id,
      dto.azureToken,
      tenant.databaseName,
    );

    const result = await this.commandBus.execute<
      LoginAzureAdCommand,
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
      message: 'Azure AD login successful',
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}
