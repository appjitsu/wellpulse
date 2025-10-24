/**
 * Current User Decorator
 *
 * Extracts authenticated user from request context.
 * User is attached to request by JWT strategy after successful validation.
 *
 * Usage in controllers:
 * @Get('profile')
 * async getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return { userId: user.userId, email: user.email };
 * }
 *
 * Or extract specific property:
 * @Post('wells')
 * async createWell(@CurrentUser('userId') userId: string) {
 *   // Use userId directly
 * }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../infrastructure/auth/strategies/jwt.strategy';

/**
 * CurrentUser Decorator
 *
 * @param data - Optional property name to extract from user object
 * @param ctx - Execution context
 * @returns Full user object or specific property
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    // If no specific property requested, return full user object
    if (!data) {
      return user;
    }

    // Return specific property
    return user?.[data];
  },
);
