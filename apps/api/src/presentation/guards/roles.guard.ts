/**
 * Roles Guard
 *
 * Enforces Role-Based Access Control (RBAC) by checking if the authenticated user
 * has the required role(s) specified by the @Roles decorator.
 *
 * Guard Behavior:
 * - If no roles are required (no @Roles decorator), allows access
 * - If roles are required, checks if user.role is in the required roles array
 * - Throws ForbiddenException if user doesn't have the required role
 * - Returns true if user is authorized
 *
 * Usage:
 * Apply globally in main.ts or use on specific routes:
 *
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN')
 * @Get('admin-only')
 * async adminRoute(@CurrentUser() user: AuthUser) {
 *   // Only ADMIN can access
 * }
 *
 * Note: This guard expects the user object to be set on the request by the JWT strategy.
 * Always use JwtAuthGuard before RolesGuard in the guards chain.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Extract user from request (set by JWT strategy)
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // Check if user exists and has one of the required roles
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
