/**
 * Create Tenant Request DTO
 *
 * Validation and transformation for tenant creation requests.
 */

import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class CreateTenantRequestDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  @IsString()
  name: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  subscriptionTier: string;

  @IsString()
  databaseType: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxWells?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  storageQuotaGb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  trialDays?: number;
}
