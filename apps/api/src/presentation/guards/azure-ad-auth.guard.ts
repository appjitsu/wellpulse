/**
 * Azure AD Auth Guard
 *
 * NestJS guard that applies Azure AD Bearer token authentication strategy.
 * Uses the AzureAdStrategy to validate JWT tokens from Azure AD.
 *
 * Usage:
 * @UseGuards(AzureAdAuthGuard)
 * async protectedRoute(@CurrentUser() user: AzureAdAuthenticatedUser) { ... }
 *
 * The guard is applied to routes that require Azure AD authentication.
 * Most routes use the standard JwtAuthGuard for WellPulse-issued tokens.
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class AzureAdAuthGuard extends AuthGuard('azure-ad') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Determine if authentication is required for this route
   *
   * Allows routes marked with @Public() decorator to skip authentication.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Apply Azure AD authentication strategy
    return super.canActivate(context);
  }
}
