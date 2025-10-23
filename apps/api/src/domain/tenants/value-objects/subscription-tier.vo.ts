/**
 * Subscription Tier Value Object
 *
 * Represents the pricing tier and feature set for a tenant.
 * Each tier has different quotas and capabilities.
 */

export type SubscriptionTierType =
  | 'STARTER'
  | 'PROFESSIONAL'
  | 'ENTERPRISE'
  | 'ENTERPRISE_PLUS';

interface TierLimits {
  maxWells: number;
  maxUsers: number;
  storageQuotaGb: number;
  basePriceUsd: number; // Monthly price in cents
}

export class SubscriptionTier {
  private constructor(private readonly value: SubscriptionTierType) {}

  // Factory methods
  static starter(): SubscriptionTier {
    return new SubscriptionTier('STARTER');
  }

  static professional(): SubscriptionTier {
    return new SubscriptionTier('PROFESSIONAL');
  }

  static enterprise(): SubscriptionTier {
    return new SubscriptionTier('ENTERPRISE');
  }

  static enterprisePlus(): SubscriptionTier {
    return new SubscriptionTier('ENTERPRISE_PLUS');
  }

  static fromString(value: string): SubscriptionTier {
    const normalized = value.toUpperCase() as SubscriptionTierType;

    if (
      !['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE_PLUS'].includes(
        normalized,
      )
    ) {
      throw new Error(`Invalid subscription tier: ${value}`);
    }

    return new SubscriptionTier(normalized);
  }

  // Tier predicates
  isStarter(): boolean {
    return this.value === 'STARTER';
  }

  isProfessional(): boolean {
    return this.value === 'PROFESSIONAL';
  }

  isEnterprise(): boolean {
    return this.value === 'ENTERPRISE';
  }

  isEnterprisePlus(): boolean {
    return this.value === 'ENTERPRISE_PLUS';
  }

  isPaid(): boolean {
    return !this.isStarter(); // All tiers except STARTER are paid
  }

  // Tier comparison
  isHigherThan(other: SubscriptionTier): boolean {
    const order: Record<SubscriptionTierType, number> = {
      STARTER: 1,
      PROFESSIONAL: 2,
      ENTERPRISE: 3,
      ENTERPRISE_PLUS: 4,
    };

    return order[this.value] > order[other.value];
  }

  isLowerThan(other: SubscriptionTier): boolean {
    const order: Record<SubscriptionTierType, number> = {
      STARTER: 1,
      PROFESSIONAL: 2,
      ENTERPRISE: 3,
      ENTERPRISE_PLUS: 4,
    };

    return order[this.value] < order[other.value];
  }

  // Get default limits for tier
  getDefaultLimits(): TierLimits {
    const limits: Record<SubscriptionTierType, TierLimits> = {
      STARTER: {
        maxWells: 50,
        maxUsers: 5,
        storageQuotaGb: 10,
        basePriceUsd: 9900, // $99/month
      },
      PROFESSIONAL: {
        maxWells: 200,
        maxUsers: 20,
        storageQuotaGb: 50,
        basePriceUsd: 29900, // $299/month
      },
      ENTERPRISE: {
        maxWells: 1000,
        maxUsers: 100,
        storageQuotaGb: 250,
        basePriceUsd: 99900, // $999/month
      },
      ENTERPRISE_PLUS: {
        maxWells: 10000,
        maxUsers: 500,
        storageQuotaGb: 1000,
        basePriceUsd: 199900, // $1,999/month
      },
    };

    return limits[this.value];
  }

  // Feature availability
  hasAdvancedML(): boolean {
    return (
      this.isProfessional() || this.isEnterprise() || this.isEnterprisePlus()
    );
  }

  hasCustomIntegrations(): boolean {
    return this.isEnterprise() || this.isEnterprisePlus();
  }

  hasETLSync(): boolean {
    return this.isEnterprisePlus();
  }

  hasMultiDatabase(): boolean {
    return this.isEnterprise() || this.isEnterprisePlus();
  }

  hasPrioritySupport(): boolean {
    return this.isEnterprise() || this.isEnterprisePlus();
  }

  // Value extraction
  toString(): string {
    return this.value;
  }

  equals(other: SubscriptionTier): boolean {
    return this.value === other.value;
  }
}
