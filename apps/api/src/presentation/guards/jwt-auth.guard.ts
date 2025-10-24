/**
 * JWT Auth Guard
 *
 * Global authentication guard that validates JWT tokens on all routes.
 * Supports @Public() decorator to bypass authentication on specific routes.
 *
 * How it works:
 * 1. Check if route is marked with @Public() decorator
 * 2. If public, skip JWT validation
 * 3. If protected, call passport JWT strategy to validate token
 * 4. Attach validated user to request object
 *
 * Usage:
 * Apply globally in main.ts or app.module.ts:
 * app.useGlobalGuards(new JwtAuthGuard(reflector));
 *
 * Mark routes as public:
 * @Public()
 * @Post('login')
 * async login() { ... }
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Determine if the route can be activated
   *
   * @param context - Execution context
   * @returns Boolean or Promise<boolean> indicating if request is allowed
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If route is public, skip JWT validation
    if (isPublic) {
      return true;
    }

    // Otherwise, validate JWT using passport strategy
    return super.canActivate(context);
  }

  /**
   * Handle the request after passport validation
   *
   * @param err - Error from passport (if any)
   * @param user - User object from JWT strategy validation
   * @param info - Additional info from passport
   * @returns Validated user object
   * @throws UnauthorizedException if validation fails
   */
  handleRequest<TUser = any>(err: unknown, user: any, info: any): TUser {
    // If there's an error or no user, deny access
    if (err || !user) {
      // Type guard for error messages
      const errorMessage =
        (info && typeof info === 'object' && 'message' in info
          ? (info as { message: string }).message
          : undefined) ||
        'Authentication required. Please provide a valid JWT token.';

      // If err is already an Error object, throw it; otherwise create UnauthorizedException
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException(errorMessage);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
