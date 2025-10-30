/**
 * Azure AD Role Mapping Configuration
 *
 * Maps Azure AD groups and app roles to WellPulse roles.
 * Configurable via environment variables for flexibility.
 *
 * WellPulse Roles:
 * - ADMIN: Full access to tenant data and settings
 * - MANAGER: Can view and edit well data, limited admin features
 * - OPERATOR: Can view and enter field data (default)
 *
 * Azure AD Integration:
 * - Groups: Security groups or M365 groups (identified by Object ID)
 * - App Roles: Custom roles defined in Azure AD App Registration
 *
 * Configuration:
 * Set environment variables to map Azure AD groups to WellPulse roles:
 * - AZURE_AD_ADMIN_GROUPS: Comma-separated list of group IDs for ADMIN role
 * - AZURE_AD_MANAGER_GROUPS: Comma-separated list of group IDs for MANAGER role
 *
 * Example:
 * AZURE_AD_ADMIN_GROUPS=a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6,b2c3d4e5-f6g7-h8i9-j0k1-l2m3n4o5p6q7
 * AZURE_AD_MANAGER_GROUPS=c3d4e5f6-g7h8-i9j0-k1l2-m3n4o5p6q7r8
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RoleMappingConfig {
  adminGroups: string[];
  managerGroups: string[];
  adminRoles: string[];
  managerRoles: string[];
}

@Injectable()
export class AzureAdRoleMapping {
  private readonly config: RoleMappingConfig;

  constructor(private readonly configService: ConfigService) {
    // Load role mapping configuration from environment variables
    this.config = {
      adminGroups: this.parseGroupIds(
        this.configService.get<string>('AZURE_AD_ADMIN_GROUPS', ''),
      ),
      managerGroups: this.parseGroupIds(
        this.configService.get<string>('AZURE_AD_MANAGER_GROUPS', ''),
      ),
      adminRoles: this.parseGroupIds(
        this.configService.get<string>('AZURE_AD_ADMIN_ROLES', ''),
      ),
      managerRoles: this.parseGroupIds(
        this.configService.get<string>('AZURE_AD_MANAGER_ROLES', ''),
      ),
    };
  }

  /**
   * Map Azure AD groups and roles to WellPulse role
   *
   * Priority (highest to lowest):
   * 1. Admin groups/roles → ADMIN
   * 2. Manager groups/roles → MANAGER
   * 3. Default → OPERATOR
   *
   * @param azureGroups - Azure AD group IDs from token
   * @param azureRoles - Azure AD app role names from token
   * @returns WellPulse role (ADMIN | MANAGER | OPERATOR)
   */
  mapRole(azureGroups: string[], azureRoles: string[]): string {
    // Check for admin access
    if (
      this.hasAnyGroup(azureGroups, this.config.adminGroups) ||
      this.hasAnyRole(azureRoles, this.config.adminRoles)
    ) {
      return 'ADMIN';
    }

    // Check for manager access
    if (
      this.hasAnyGroup(azureGroups, this.config.managerGroups) ||
      this.hasAnyRole(azureRoles, this.config.managerRoles)
    ) {
      return 'MANAGER';
    }

    // Default to operator
    return 'OPERATOR';
  }

  /**
   * Check if user has any of the specified groups
   */
  private hasAnyGroup(userGroups: string[], allowedGroups: string[]): boolean {
    if (allowedGroups.length === 0) {
      return false;
    }

    return userGroups.some((group) => allowedGroups.includes(group));
  }

  /**
   * Check if user has any of the specified roles
   */
  private hasAnyRole(userRoles: string[], allowedRoles: string[]): boolean {
    if (allowedRoles.length === 0) {
      return false;
    }

    return userRoles.some((role) => allowedRoles.includes(role));
  }

  /**
   * Parse comma-separated group/role IDs from environment variable
   */
  private parseGroupIds(value: string): string[] {
    if (!value || value.trim() === '') {
      return [];
    }

    return value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  }

  /**
   * Get current role mapping configuration (for debugging/admin UI)
   */
  getConfig(): RoleMappingConfig {
    return { ...this.config };
  }
}
