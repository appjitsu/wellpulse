/**
 * Azure AD Login DTO
 *
 * Request body for Azure AD SSO login.
 * Frontend obtains Azure AD token from MSAL library and sends it to this endpoint.
 */

import { IsString, IsNotEmpty } from 'class-validator';

export class AzureAdLoginDto {
  @IsString()
  @IsNotEmpty()
  azureToken: string; // Azure AD access token (JWT) from frontend
}
