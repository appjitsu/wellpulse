/**
 * JWT Blacklist Guard
 *
 * Checks if JWT tokens have been blacklisted before allowing requests.
 * Works in conjunction with JwtAuthGuard for complete authentication.
 *
 * Flow:
 * 1. JwtAuthGuard validates JWT signature and expiration
 * 2. JwtBlacklistGuard checks if token has been revoked
 * 3. If either fails, request is rejected
 *
 * Use Cases:
 * - User logs out → token blacklisted
 * - Password changed → all user tokens blacklisted
 * - Account suspended → all user tokens blacklisted
 * - Security incident → bulk token revocation
 *
 * Usage:
 * ```typescript
 * @UseGuards(JwtAuthGuard, JwtBlacklistGuard)
 * @Get('profile')
 * async getProfile() { ... }
 * ```
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenBlacklistService } from '../../infrastructure/services/token-blacklist.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtBlacklistGuard implements CanActivate {
  private readonly logger = new Logger(JwtBlacklistGuard.name);

  constructor(
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Extract token from Authorization header
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      // If no token, let JwtAuthGuard handle it
      return true;
    }

    // Check if token is blacklisted
    const isBlacklisted =
      await this.tokenBlacklistService.isTokenBlacklisted(token);

    if (isBlacklisted) {
      this.logger.warn(
        `Blacklisted token attempted access: ${request.user?.id || 'unknown'}`,
      );
      throw new UnauthorizedException(
        'Token has been revoked. Please log in again.',
      );
    }

    return true;
  }

  /**
   * Extract JWT token from Authorization header
   *
   * @param request - Express request object
   * @returns JWT token or null
   */
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
