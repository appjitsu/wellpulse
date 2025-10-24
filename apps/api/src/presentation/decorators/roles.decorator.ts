/**
 * Roles Decorator
 *
 * Marks a route as requiring specific user roles.
 * Used in conjunction with RolesGuard to enforce Role-Based Access Control (RBAC).
 *
 * Usage:
 * @Roles('ADMIN')
 * @Get('admin-only')
 * async adminRoute(@CurrentUser() user: AuthUser) {
 *   // Only accessible by ADMIN role
 * }
 *
 * @Roles('ADMIN', 'MANAGER')
 * @Get('managers')
 * async managerRoute(@CurrentUser() user: AuthUser) {
 *   // Accessible by both ADMIN and MANAGER roles
 * }
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
