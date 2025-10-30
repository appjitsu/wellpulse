/**
 * Azure AD Strategy
 *
 * Passport strategy for validating Azure AD JWT access tokens.
 * Extracts JWT from Authorization header (Bearer token).
 *
 * Flow:
 * 1. Extract JWT from Authorization header
 * 2. Verify signature using Azure AD public keys
 * 3. Validate token claims (audience, issuer, expiration)
 * 4. Extract user information (email, name, object ID)
 * 5. Map Azure AD groups to WellPulse roles
 * 6. Return user object to attach to request
 *
 * Usage:
 * This strategy is applied via AzureAdAuthGuard on Azure AD endpoints.
 * The validated user is available in controllers via @CurrentUser() decorator.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import {
  BearerStrategy,
  IBearerStrategyOptionWithRequest,
  ITokenPayload,
} from 'passport-azure-ad';

/**
 * Azure AD Token Payload
 * Contains user information from Azure AD
 */
export interface AzureAdTokenPayload extends ITokenPayload {
  oid: string; // Object ID (unique user identifier)
  email?: string;
  preferred_username?: string;
  name?: string;
  groups?: string[]; // Azure AD group IDs
  roles?: string[]; // Azure AD app roles
}

/**
 * Authenticated Azure AD User
 * Attached to request after successful token validation
 */
export interface AzureAdAuthenticatedUser {
  azureObjectId: string;
  email: string;
  name: string;
  azureGroups: string[];
  azureRoles: string[];
}

@Injectable()
export class AzureAdStrategy extends PassportStrategy(
  BearerStrategy,
  'azure-ad',
) {
  constructor(private readonly configService: ConfigService) {
    const clientId = configService.get<string>('AZURE_AD_CLIENT_ID');
    const tenantId = configService.get<string>('AZURE_AD_TENANT_ID');

    if (!clientId || !tenantId) {
      throw new Error(
        'Azure AD configuration is missing (AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID)',
      );
    }

    const options: IBearerStrategyOptionWithRequest = {
      identityMetadata: `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
      clientID: clientId,
      validateIssuer: true,
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
      audience: clientId, // API expects tokens issued for this client ID
      loggingLevel:
        configService.get<string>('NODE_ENV') === 'production'
          ? 'error'
          : 'info',
      passReqToCallback: false,
    };

    super(options);
  }

  /**
   * Validate Azure AD token payload
   *
   * This method is called after token signature verification succeeds.
   * Return value is attached to request object as request.user
   *
   * @param payload - Decoded Azure AD token payload
   * @returns Authenticated Azure AD user object
   * @throws UnauthorizedException if payload is invalid
   */
  validate(payload: AzureAdTokenPayload): AzureAdAuthenticatedUser {
    // Validate required fields
    if (!payload.oid) {
      throw new UnauthorizedException(
        'Invalid Azure AD token: missing object ID',
      );
    }

    // Extract email (try multiple claim sources)
    const email =
      payload.email || payload.preferred_username || payload.upn || '';

    if (!email) {
      throw new UnauthorizedException('Invalid Azure AD token: missing email');
    }

    // Extract name
    const name = payload.name || email.split('@')[0];

    // Extract groups and roles
    const azureGroups = payload.groups || [];
    const azureRoles = payload.roles || [];

    // Return authenticated user object (attached to request as request.user)
    return {
      azureObjectId: payload.oid,
      email: email.toLowerCase().trim(),
      name,
      azureGroups,
      azureRoles,
    };
  }
}
