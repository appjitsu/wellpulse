/**
 * Tenant Domain Entity
 *
 * Represents an oil & gas operator organization in the WellPulse platform.
 * Each tenant gets their own subdomain and dedicated database.
 *
 * Business Rules:
 * - Slug must be URL-friendly (lowercase, hyphens only)
 * - Subdomain must be unique across all tenants
 * - Cannot delete tenant with active subscription
 * - Trial tenants must have trialEndsAt date
 * - Database URL must be encrypted before storage
 */

import { TenantStatus } from './value-objects/tenant-status.vo';
import { SubscriptionTier } from './value-objects/subscription-tier.vo';
import { DatabaseConfig } from './value-objects/database-config.vo';

export interface TenantProps {
  id: string;
  slug: string;
  subdomain: string;
  name: string;
  databaseConfig: DatabaseConfig;
  subscriptionTier: SubscriptionTier;
  status: TenantStatus;
  maxWells: number;
  maxUsers: number;
  storageQuotaGb: number;
  trialEndsAt?: Date;
  contactEmail: string;
  contactPhone?: string;
  billingEmail?: string;
  featureFlags?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  createdBy?: string;
}

export class Tenant {
  private constructor(private readonly props: TenantProps) {
    this.validate();
  }

  /**
   * Create a new tenant
   */
  static create(
    props: Omit<TenantProps, 'id' | 'createdAt' | 'updatedAt'>,
  ): Tenant {
    return new Tenant({
      ...props,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Reconstitute tenant from database
   */
  static fromPersistence(props: TenantProps): Tenant {
    return new Tenant(props);
  }

  /**
   * Validate tenant business rules
   */
  private validate(): void {
    // Slug validation
    if (!/^[a-z0-9-]+$/.test(this.props.slug)) {
      throw new Error(
        'Tenant slug must be lowercase alphanumeric with hyphens only',
      );
    }

    if (this.props.slug.length < 3 || this.props.slug.length > 50) {
      throw new Error('Tenant slug must be between 3 and 50 characters');
    }

    // Subdomain validation
    if (!/^[a-z0-9-]+$/.test(this.props.subdomain)) {
      throw new Error(
        'Tenant subdomain must be lowercase alphanumeric with hyphens only',
      );
    }

    if (this.props.subdomain.length < 2 || this.props.subdomain.length > 30) {
      throw new Error('Tenant subdomain must be between 2 and 30 characters');
    }

    // Name validation
    if (!this.props.name || this.props.name.trim().length === 0) {
      throw new Error('Tenant name is required');
    }

    if (this.props.name.length > 255) {
      throw new Error('Tenant name must not exceed 255 characters');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.props.contactEmail)) {
      throw new Error('Contact email must be valid');
    }

    if (this.props.billingEmail && !emailRegex.test(this.props.billingEmail)) {
      throw new Error('Billing email must be valid');
    }

    // Trial validation
    if (this.props.status.isTrial() && !this.props.trialEndsAt) {
      throw new Error('Trial tenants must have trialEndsAt date');
    }

    // Quota validation
    if (this.props.maxWells <= 0) {
      throw new Error('Max wells must be greater than 0');
    }

    if (this.props.maxUsers <= 0) {
      throw new Error('Max users must be greater than 0');
    }

    if (this.props.storageQuotaGb <= 0) {
      throw new Error('Storage quota must be greater than 0');
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get slug(): string {
    return this.props.slug;
  }

  get subdomain(): string {
    return this.props.subdomain;
  }

  get name(): string {
    return this.props.name;
  }

  get databaseConfig(): DatabaseConfig {
    return this.props.databaseConfig;
  }

  get subscriptionTier(): SubscriptionTier {
    return this.props.subscriptionTier;
  }

  get status(): TenantStatus {
    return this.props.status;
  }

  get maxWells(): number {
    return this.props.maxWells;
  }

  get maxUsers(): number {
    return this.props.maxUsers;
  }

  get storageQuotaGb(): number {
    return this.props.storageQuotaGb;
  }

  get trialEndsAt(): Date | undefined {
    return this.props.trialEndsAt;
  }

  get contactEmail(): string {
    return this.props.contactEmail;
  }

  get contactPhone(): string | undefined {
    return this.props.contactPhone;
  }

  get billingEmail(): string | undefined {
    return this.props.billingEmail;
  }

  get featureFlags(): Record<string, boolean> | undefined {
    return this.props.featureFlags;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  get createdBy(): string | undefined {
    return this.props.createdBy;
  }

  // Domain methods

  /**
   * Activate tenant (from trial or suspended)
   */
  activate(): void {
    if (this.props.status.isDeleted()) {
      throw new Error('Cannot activate deleted tenant');
    }

    this.props.status = TenantStatus.active();
    this.props.updatedAt = new Date();
  }

  /**
   * Suspend tenant (payment issue, violation)
   */
  suspend(reason: string): void {
    if (this.props.status.isDeleted()) {
      throw new Error('Cannot suspend deleted tenant');
    }

    if (this.props.status.isSuspended()) {
      throw new Error('Tenant is already suspended');
    }

    this.props.status = TenantStatus.suspended();
    this.props.metadata = {
      ...this.props.metadata,
      suspensionReason: reason,
      suspendedAt: new Date().toISOString(),
    };
    this.props.updatedAt = new Date();
  }

  /**
   * Soft delete tenant
   */
  delete(): void {
    if (this.props.status.isDeleted()) {
      throw new Error('Tenant is already deleted');
    }

    // Business rule: Cannot delete active subscription
    if (this.props.status.isActive() && this.props.subscriptionTier.isPaid()) {
      throw new Error('Cannot delete tenant with active paid subscription');
    }

    this.props.status = TenantStatus.deleted();
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }

  /**
   * Update tenant details
   */
  updateDetails(updates: {
    name?: string;
    contactEmail?: string;
    contactPhone?: string;
    billingEmail?: string;
  }): void {
    if (this.props.status.isDeleted()) {
      throw new Error('Cannot update deleted tenant');
    }

    if (updates.name) {
      if (updates.name.trim().length === 0) {
        throw new Error('Tenant name cannot be empty');
      }
      this.props.name = updates.name;
    }

    if (updates.contactEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.contactEmail)) {
        throw new Error('Contact email must be valid');
      }
      this.props.contactEmail = updates.contactEmail;
    }

    if (updates.contactPhone !== undefined) {
      this.props.contactPhone = updates.contactPhone;
    }

    if (updates.billingEmail !== undefined) {
      if (updates.billingEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.billingEmail)) {
          throw new Error('Billing email must be valid');
        }
      }
      this.props.billingEmail = updates.billingEmail;
    }

    this.props.updatedAt = new Date();
  }

  /**
   * Upgrade subscription tier
   */
  upgradeTier(newTier: SubscriptionTier): void {
    if (this.props.status.isDeleted()) {
      throw new Error('Cannot upgrade deleted tenant');
    }

    if (!newTier.isHigherThan(this.props.subscriptionTier)) {
      throw new Error('New tier must be higher than current tier');
    }

    this.props.subscriptionTier = newTier;
    this.props.updatedAt = new Date();

    // Adjust quotas based on tier
    this.adjustQuotasForTier(newTier);
  }

  /**
   * Downgrade subscription tier
   */
  downgradeTier(
    newTier: SubscriptionTier,
    currentUsage: { wells: number; users: number },
  ): void {
    if (this.props.status.isDeleted()) {
      throw new Error('Cannot downgrade deleted tenant');
    }

    if (!newTier.isLowerThan(this.props.subscriptionTier)) {
      throw new Error('New tier must be lower than current tier');
    }

    // Business rule: Cannot downgrade if current usage exceeds new tier limits
    const newLimits = newTier.getDefaultLimits();
    if (currentUsage.wells > newLimits.maxWells) {
      throw new Error(
        `Cannot downgrade: Current well count (${currentUsage.wells}) exceeds new tier limit (${newLimits.maxWells})`,
      );
    }

    if (currentUsage.users > newLimits.maxUsers) {
      throw new Error(
        `Cannot downgrade: Current user count (${currentUsage.users}) exceeds new tier limit (${newLimits.maxUsers})`,
      );
    }

    this.props.subscriptionTier = newTier;
    this.props.updatedAt = new Date();

    // Adjust quotas based on tier
    this.adjustQuotasForTier(newTier);
  }

  /**
   * Enable/disable feature flags
   */
  setFeatureFlag(feature: string, enabled: boolean): void {
    if (this.props.status.isDeleted()) {
      throw new Error('Cannot modify feature flags for deleted tenant');
    }

    this.props.featureFlags = {
      ...this.props.featureFlags,
      [feature]: enabled,
    };
    this.props.updatedAt = new Date();
  }

  /**
   * Check if feature is enabled
   */
  hasFeature(feature: string): boolean {
    return this.props.featureFlags?.[feature] ?? false;
  }

  /**
   * Check if trial has expired
   */
  isTrialExpired(): boolean {
    if (!this.props.status.isTrial() || !this.props.trialEndsAt) {
      return false;
    }

    return new Date() > this.props.trialEndsAt;
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): TenantProps {
    return { ...this.props };
  }

  /**
   * Adjust quotas based on subscription tier
   */
  private adjustQuotasForTier(tier: SubscriptionTier): void {
    const limits = tier.getDefaultLimits();
    this.props.maxWells = limits.maxWells;
    this.props.maxUsers = limits.maxUsers;
    this.props.storageQuotaGb = limits.storageQuotaGb;
  }
}
