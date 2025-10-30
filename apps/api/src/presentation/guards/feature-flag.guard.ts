/**
 * Feature Flag Guard
 *
 * Protects routes based on feature flag availability for the tenant.
 * Works in conjunction with @RequiresFeature() decorator.
 *
 * Flow:
 * 1. Extract feature key from route metadata (@RequiresFeature decorator)
 * 2. Get tenant ID from request (set by TenantResolverMiddleware)
 * 3. Check if feature is enabled via FeatureFlagsService
 * 4. Allow or deny access based on result
 *
 * Returns:
 * - true: Feature enabled, allow access
 * - false: Feature disabled, return 403 Forbidden
 *
 * Error Handling:
 * - Missing tenant context → 401 Unauthorized
 * - Feature not enabled → 403 Forbidden with descriptive message
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from '../decorators/requires-feature.decorator';
import { FeatureFlagsService } from '../../application/feature-flags/feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required feature from route metadata
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no feature required, allow access
    if (!requiredFeature) {
      return true;
    }

    // Get request and extract tenant context
    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant;

    // Ensure tenant context is available
    // (should be set by TenantResolverMiddleware)
    if (!tenant || !tenant.id) {
      this.logger.warn(
        `FeatureFlagGuard: Missing tenant context for feature "${requiredFeature}"`,
      );
      throw new UnauthorizedException(
        'Tenant context required. Ensure you are accessing via a valid tenant subdomain.',
      );
    }

    // Check if feature is enabled
    const isEnabled = await this.featureFlagsService.isFeatureEnabled(
      tenant.id,
      requiredFeature,
    );

    if (!isEnabled) {
      this.logger.warn(
        `Feature "${requiredFeature}" not enabled for tenant ${tenant.id} (${tenant.subdomain})`,
      );

      // Get feature details for error message
      const features = this.featureFlagsService.getAllFeatures();
      const feature = features.find((f) => f.key === requiredFeature);

      const featureName = feature?.name || requiredFeature;
      const minimumTier = feature?.minimumTier
        ? ` This feature requires ${feature.minimumTier} tier or higher.`
        : '';

      throw new ForbiddenException(
        `Access denied. The "${featureName}" feature is not enabled for your account.${minimumTier} Please contact support to upgrade your plan.`,
      );
    }

    // Feature is enabled, allow access
    return true;
  }
}
