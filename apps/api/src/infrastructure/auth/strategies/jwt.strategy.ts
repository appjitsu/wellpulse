/**
 * JWT Strategy
 *
 * Passport strategy for validating JWT access tokens.
 * Extracts JWT from Authorization header (Bearer token).
 *
 * Flow:
 * 1. Extract JWT from Authorization header
 * 2. Verify signature using JWT_SECRET
 * 3. Validate payload structure
 * 4. Return user object to attach to request
 *
 * Usage:
 * This strategy is automatically applied via JwtAuthGuard.
 * The validated user is available in controllers via @CurrentUser() decorator.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy, ExtractJwt } from 'passport-jwt';

/**
 * JWT Payload Structure
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  tenantId: string;
  iat?: number; // Issued at
  exp?: number; // Expiration
}

/**
 * Authenticated User Object
 * Attached to request after successful JWT validation
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validate JWT payload
   *
   * This method is called after JWT signature verification succeeds.
   * Return value is attached to request object as request.user
   *
   * Note: Method signature must be async to satisfy PassportStrategy contract,
   * but no await is needed since validation is synchronous.
   *
   * @param payload - Decoded JWT payload
   * @returns Authenticated user object
   * @throws UnauthorizedException if payload is invalid
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    // Validate required fields
    if (!payload.sub || !payload.email || !payload.role || !payload.tenantId) {
      throw new UnauthorizedException('Invalid JWT payload structure');
    }

    // Return user object (attached to request as request.user)
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };
  }
}
