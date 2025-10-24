/**
 * Presentation Guards
 *
 * Exports all custom guards for use in controllers and global application.
 *
 * Usage:
 * import { JwtAuthGuard, RolesGuard } from '@/presentation/guards';
 *
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('ADMIN')
 * @Get('admin-only')
 * async adminRoute() { ... }
 */

export { JwtAuthGuard } from './jwt-auth.guard';
export { RolesGuard } from './roles.guard';
