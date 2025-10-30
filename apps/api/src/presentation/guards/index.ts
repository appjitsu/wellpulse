/**
 * Presentation Guards
 *
 * Exports all custom guards for use in controllers and global application.
 *
 * Usage:
 * import { JwtAuthGuard, RolesGuard, FeatureFlagGuard } from '@/presentation/guards';
 *
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN')
 * @Get('admin-only')
 * async adminRoute() { ... }
 *
 * @UseGuards(JwtAuthGuard, FeatureFlagGuard)
 * @RequiresFeature('advancedML')
 * @Get('ml-prediction')
 * async mlRoute() { ... }
 */

export { JwtAuthGuard } from './jwt-auth.guard';
export { RolesGuard } from './roles.guard';
export { FeatureFlagGuard } from './feature-flag.guard';
