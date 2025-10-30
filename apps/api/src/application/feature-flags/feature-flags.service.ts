/**
 * Feature Flags Service
 *
 * Manages feature flag evaluation for tenants based on:
 * 1. Subscription tier (tier-based defaults)
 * 2. Custom tenant-level feature flags (overrides)
 *
 * Features:
 * - Centralized feature registry with documentation
 * - Tier-based feature availability
 * - Tenant-level feature flag overrides
 * - Feature flag checking with fallbacks
 * - Progressive rollout capability
 *
 * Usage:
 * ```typescript
 * const hasML = await featureFlagsService.isFeatureEnabled(tenantId, 'advancedML');
 * const allFlags = await featureFlagsService.getAllFeatureFlags(tenantId);
 * ```
 *
 * Feature Flag Lifecycle:
 * 1. Define feature in FEATURE_REGISTRY with tier requirements
 * 2. Check feature in code using isFeatureEnabled()
 * 3. Override at tenant level via featureFlags column
 * 4. Remove feature flag once fully rolled out
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ITenantRepository } from '../../domain/repositories/tenant.repository.interface';
import { SubscriptionTier } from '../../domain/tenants/value-objects/subscription-tier.vo';

/**
 * Feature definition with metadata
 */
interface Feature {
  /** Unique feature identifier (kebab-case) */
  key: string;
  /** Human-readable feature name */
  name: string;
  /** Feature description for documentation */
  description: string;
  /** Minimum tier required (null = available to all) */
  minimumTier:
    | 'STARTER'
    | 'PROFESSIONAL'
    | 'ENTERPRISE'
    | 'ENTERPRISE_PLUS'
    | null;
  /** Whether feature is in beta (gradual rollout) */
  isBeta: boolean;
  /** Default enabled state (can be overridden per tenant) */
  defaultEnabled: boolean;
}

/**
 * Central feature registry
 * Add new features here with their tier requirements
 */
const FEATURE_REGISTRY: Record<string, Feature> = {
  // ML & Analytics Features
  advancedML: {
    key: 'advancedML',
    name: 'Advanced ML & Predictive Analytics',
    description:
      'Machine learning models for predictive maintenance and production optimization',
    minimumTier: 'PROFESSIONAL',
    isBeta: false,
    defaultEnabled: true,
  },
  anomalyDetection: {
    key: 'anomalyDetection',
    name: 'Anomaly Detection',
    description: 'Real-time anomaly detection on production and sensor data',
    minimumTier: 'PROFESSIONAL',
    isBeta: false,
    defaultEnabled: true,
  },
  productionForecasting: {
    key: 'productionForecasting',
    name: 'Production Forecasting',
    description: 'AI-powered production forecasting for well planning',
    minimumTier: 'ENTERPRISE',
    isBeta: true,
    defaultEnabled: false,
  },

  // Integration Features
  customIntegrations: {
    key: 'customIntegrations',
    name: 'Custom Integrations',
    description: 'API access for custom SCADA and ERP integrations',
    minimumTier: 'ENTERPRISE',
    isBeta: false,
    defaultEnabled: true,
  },
  etlSync: {
    key: 'etlSync',
    name: 'ETL Sync',
    description: 'Bidirectional ETL sync with external systems',
    minimumTier: 'ENTERPRISE_PLUS',
    isBeta: false,
    defaultEnabled: true,
  },
  sapIntegration: {
    key: 'sapIntegration',
    name: 'SAP Integration',
    description: 'Native SAP ERP integration',
    minimumTier: 'ENTERPRISE_PLUS',
    isBeta: true,
    defaultEnabled: false,
  },

  // Database Features
  multiDatabase: {
    key: 'multiDatabase',
    name: 'Multi-Database Support',
    description:
      'Support for SQL Server, MySQL, Oracle in addition to PostgreSQL',
    minimumTier: 'ENTERPRISE',
    isBeta: false,
    defaultEnabled: true,
  },
  onPremDatabase: {
    key: 'onPremDatabase',
    name: 'On-Premises Database',
    description: 'Host tenant database on-premises with VPN connectivity',
    minimumTier: 'ENTERPRISE',
    isBeta: false,
    defaultEnabled: true,
  },

  // Collaboration Features
  teamCollaboration: {
    key: 'teamCollaboration',
    name: 'Team Collaboration',
    description: 'Real-time comments, mentions, and notifications',
    minimumTier: 'PROFESSIONAL',
    isBeta: false,
    defaultEnabled: true,
  },
  advancedRBAC: {
    key: 'advancedRBAC',
    name: 'Advanced RBAC',
    description: 'Custom roles and granular permissions',
    minimumTier: 'ENTERPRISE',
    isBeta: false,
    defaultEnabled: true,
  },

  // Mobile Features
  offlineMode: {
    key: 'offlineMode',
    name: 'Offline Mode',
    description: 'Full offline capabilities for mobile and desktop apps',
    minimumTier: 'STARTER',
    isBeta: false,
    defaultEnabled: true,
  },
  photoAttachments: {
    key: 'photoAttachments',
    name: 'Photo Attachments',
    description: 'Attach photos to field entries',
    minimumTier: 'STARTER',
    isBeta: false,
    defaultEnabled: true,
  },

  // Compliance & Reporting
  escCompliance: {
    key: 'escCompliance',
    name: 'ESG Compliance',
    description: 'Automated ESG reporting and emissions tracking',
    minimumTier: 'PROFESSIONAL',
    isBeta: false,
    defaultEnabled: true,
  },
  customReports: {
    key: 'customReports',
    name: 'Custom Reports',
    description: 'Build custom reports with drag-and-drop interface',
    minimumTier: 'PROFESSIONAL',
    isBeta: false,
    defaultEnabled: true,
  },
  auditLogs: {
    key: 'auditLogs',
    name: 'Audit Logs',
    description: 'Comprehensive audit trail for compliance',
    minimumTier: 'PROFESSIONAL',
    isBeta: false,
    defaultEnabled: true,
  },

  // Support Features
  prioritySupport: {
    key: 'prioritySupport',
    name: 'Priority Support',
    description: '24/7 priority support with dedicated account manager',
    minimumTier: 'ENTERPRISE',
    isBeta: false,
    defaultEnabled: true,
  },
  slaGuarantee: {
    key: 'slaGuarantee',
    name: 'SLA Guarantee',
    description: '99.9% uptime SLA with financial guarantee',
    minimumTier: 'ENTERPRISE_PLUS',
    isBeta: false,
    defaultEnabled: true,
  },

  // Beta Features (available for early access testing)
  aiAssistant: {
    key: 'aiAssistant',
    name: 'AI Assistant',
    description: 'Natural language AI assistant for data queries',
    minimumTier: null, // Available to all tiers for beta testing
    isBeta: true,
    defaultEnabled: false, // Opt-in only
  },
  mobileAppV2: {
    key: 'mobileAppV2',
    name: 'Mobile App V2',
    description: 'Next-generation mobile app with improved UI',
    minimumTier: null,
    isBeta: true,
    defaultEnabled: false,
  },
};

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    @Inject('ITenantRepository')
    private readonly tenantRepository: ITenantRepository,
  ) {}

  /**
   * Check if a feature is enabled for a tenant
   *
   * Evaluation order:
   * 1. Check tenant-specific feature flag override
   * 2. Check subscription tier eligibility
   * 3. Fall back to feature default
   *
   * @param tenantId - Tenant ID
   * @param featureKey - Feature key from FEATURE_REGISTRY
   * @returns True if feature is enabled
   */
  async isFeatureEnabled(
    tenantId: string,
    featureKey: string,
  ): Promise<boolean> {
    // Get feature definition
    const feature = FEATURE_REGISTRY[featureKey];

    if (!feature) {
      this.logger.warn(`Feature not found in registry: ${featureKey}`);
      return false;
    }

    // Get tenant
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      this.logger.warn(`Tenant not found: ${tenantId}`);
      return false;
    }

    // 1. Check tenant-specific override
    const tenantFlags = tenant.featureFlags;
    if (tenantFlags && featureKey in tenantFlags) {
      return tenantFlags[featureKey];
    }

    // 2. Check tier eligibility
    if (feature.minimumTier) {
      const minimumTier = SubscriptionTier.fromString(feature.minimumTier);
      const tenantTier = tenant.subscriptionTier;

      // If tenant tier is lower than minimum, feature is disabled
      if (tenantTier.isLowerThan(minimumTier)) {
        return false;
      }
    }

    // 3. Fall back to default
    return feature.defaultEnabled;
  }

  /**
   * Check if multiple features are enabled
   *
   * @param tenantId - Tenant ID
   * @param featureKeys - Array of feature keys
   * @returns Map of feature keys to enabled state
   */
  async areFeaturesEnabled(
    tenantId: string,
    featureKeys: string[],
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      featureKeys.map(async (key) => {
        results[key] = await this.isFeatureEnabled(tenantId, key);
      }),
    );

    return results;
  }

  /**
   * Get all feature flags for a tenant
   *
   * Returns all features with their enabled state based on:
   * - Subscription tier
   * - Tenant-specific overrides
   *
   * @param tenantId - Tenant ID
   * @returns Object with all feature flags and their state
   */
  async getAllFeatureFlags(tenantId: string): Promise<Record<string, boolean>> {
    const featureKeys = Object.keys(FEATURE_REGISTRY);
    return this.areFeaturesEnabled(tenantId, featureKeys);
  }

  /**
   * Get all features with metadata
   *
   * @returns All features from registry
   */
  getAllFeatures(): Feature[] {
    return Object.values(FEATURE_REGISTRY);
  }

  /**
   * Get features available for a subscription tier
   *
   * @param tier - Subscription tier
   * @returns Features available at this tier or higher
   */
  getFeaturesForTier(tier: SubscriptionTier): Feature[] {
    return Object.values(FEATURE_REGISTRY).filter((feature) => {
      // Features with no minimum tier are available to all
      if (!feature.minimumTier) {
        return true;
      }

      const minimumTier = SubscriptionTier.fromString(feature.minimumTier);
      return !tier.isLowerThan(minimumTier);
    });
  }

  /**
   * Get beta features
   *
   * @returns All features marked as beta
   */
  getBetaFeatures(): Feature[] {
    return Object.values(FEATURE_REGISTRY).filter((f) => f.isBeta);
  }

  /**
   * Enable a feature for a specific tenant (override)
   *
   * This allows enabling features for testing or early access,
   * even if the tenant's tier doesn't normally include it.
   *
   * @param tenantId - Tenant ID
   * @param featureKey - Feature key
   */
  async enableFeatureForTenant(
    tenantId: string,
    featureKey: string,
  ): Promise<void> {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const feature = FEATURE_REGISTRY[featureKey];
    if (!feature) {
      throw new Error(`Feature not found: ${featureKey}`);
    }

    // Update tenant feature flags
    const currentFlags = tenant.featureFlags || {};
    const updatedFlags = {
      ...currentFlags,
      [featureKey]: true,
    };

    // Update tenant (note: this would need a method on Tenant entity)
    // For now, we log a warning that this needs to be implemented
    this.logger.warn(
      `enableFeatureForTenant called but Tenant entity needs updateFeatureFlags method: ${tenantId}, ${featureKey}`,
    );

    // TODO: Implement Tenant.updateFeatureFlags() method
    // tenant.updateFeatureFlags(updatedFlags);
    // await this.tenantRepository.update(tenant);
  }

  /**
   * Disable a feature for a specific tenant (override)
   *
   * @param tenantId - Tenant ID
   * @param featureKey - Feature key
   */
  async disableFeatureForTenant(
    tenantId: string,
    featureKey: string,
  ): Promise<void> {
    const tenant = await this.tenantRepository.findById(tenantId);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const feature = FEATURE_REGISTRY[featureKey];
    if (!feature) {
      throw new Error(`Feature not found: ${featureKey}`);
    }

    // Update tenant feature flags
    const currentFlags = tenant.featureFlags || {};
    const updatedFlags = {
      ...currentFlags,
      [featureKey]: false,
    };

    // TODO: Implement Tenant.updateFeatureFlags() method
    this.logger.warn(
      `disableFeatureForTenant called but Tenant entity needs updateFeatureFlags method: ${tenantId}, ${featureKey}`,
    );

    // tenant.updateFeatureFlags(updatedFlags);
    // await this.tenantRepository.update(tenant);
  }
}
