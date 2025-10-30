/**
 * Requires Feature Decorator
 *
 * Use this decorator to protect routes based on feature flags.
 * Combines with FeatureFlagGuard to check if tenant has access to a feature.
 *
 * Usage:
 * ```typescript
 * @Controller('ml')
 * export class MLController {
 *   @Get('predict')
 *   @RequiresFeature('advancedML')
 *   async predict() {
 *     // Only tenants with advancedML feature enabled can access
 *   }
 * }
 * ```
 *
 * Works with:
 * - Subscription tier-based features (auto-enabled for qualifying tiers)
 * - Tenant-level feature flag overrides
 * - Beta features (opt-in via tenant flags)
 */

import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'requiredFeature';

/**
 * Decorator to require a specific feature flag for route access
 *
 * @param featureKey - Feature key from FEATURE_REGISTRY in FeatureFlagsService
 */
export const RequiresFeature = (featureKey: string) =>
  SetMetadata(FEATURE_FLAG_KEY, featureKey);
