/**
 * Public Decorator
 *
 * Marks a route as public (no JWT authentication required).
 * Used primarily for authentication endpoints (login, register, etc.)
 *
 * Usage:
 * @Public()
 * @Post('login')
 * async login(@Body() dto: LoginDto) {
 *   // Public endpoint - no auth required
 * }
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
