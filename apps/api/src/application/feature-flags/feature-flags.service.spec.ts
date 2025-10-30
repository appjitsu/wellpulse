/**
 * Feature Flags Service Tests
 *
 * Tests tier-based feature access control and tenant-specific overrides.
 * CRITICAL for subscription-based feature gating and progressive rollout.
 *
 * Test Coverage:
 * - Feature evaluation order (tenant override → tier check → default)
 * - Tier-based feature availability
 * - Tenant-specific feature flag overrides
 * - Unknown feature handling
 * - Tenant not found handling
 * - Batch feature checking
 * - Feature metadata retrieval
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { ITenantRepository } from '../../domain/repositories/tenant.repository.interface';
import { Tenant } from '../../domain/tenants/tenant.entity';
import { SubscriptionTier } from '../../domain/tenants/value-objects/subscription-tier.vo';
import { TenantStatus } from '../../domain/tenants/value-objects/tenant-status.vo';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let tenantRepository: jest.Mocked<ITenantRepository>;

  // Helper function to create a mock tenant
  const createMockTenant = (
    id: string,
    tier: string,
    featureFlags: Record<string, boolean> = {},
  ): Tenant => {
    return Tenant.fromPersistence({
      id,
      slug: 'test-slug',
      subdomain: 'test',
      tenantId: 'TEST-123456',
      secretKeyHash: 'mock-secret-hash',
      name: 'Test Tenant',
      databaseConfig: {
        url: 'postgresql://test:test@localhost:5432/test_db',
        type: 'POSTGRESQL',
        maxConnections: 10,
        sslEnabled: false,
      } as any,
      subscriptionTier: SubscriptionTier.fromString(tier),
      status: TenantStatus.fromString('ACTIVE'),
      maxWells: 100,
      maxUsers: 50,
      storageQuotaGb: 10,
      contactEmail: 'admin@test.com',
      featureFlags,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(async () => {
    const mockTenantRepository = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: 'ITenantRepository',
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    tenantRepository = module.get('ITenantRepository');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('isFeatureEnabled()', () => {
    describe('Unknown Feature Handling', () => {
      it('should return false for unknown feature key', async () => {
        const tenant = createMockTenant('tenant-1', 'ENTERPRISE');
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled(
          'tenant-1',
          'unknownFeature',
        );

        expect(result).toBe(false);
      });

      it('should log warning for unknown feature', async () => {
        const tenant = createMockTenant('tenant-1', 'ENTERPRISE');
        tenantRepository.findById.mockResolvedValue(tenant);
        const loggerSpy = jest.spyOn(service['logger'], 'warn');

        await service.isFeatureEnabled('tenant-1', 'unknownFeature');

        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Feature not found in registry: unknownFeature',
          ),
        );
      });
    });

    describe('Tenant Not Found Handling', () => {
      it('should return false when tenant not found', async () => {
        tenantRepository.findById.mockResolvedValue(null);

        const result = await service.isFeatureEnabled(
          'non-existent',
          'advancedML',
        );

        expect(result).toBe(false);
      });

      it('should log warning when tenant not found', async () => {
        tenantRepository.findById.mockResolvedValue(null);
        const loggerSpy = jest.spyOn(service['logger'], 'warn');

        await service.isFeatureEnabled('non-existent', 'advancedML');

        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Tenant not found'),
        );
      });
    });

    describe('Tier-Based Feature Access', () => {
      it('should allow PROFESSIONAL tier to access advancedML', async () => {
        const tenant = createMockTenant('tenant-1', 'PROFESSIONAL');
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

        expect(result).toBe(true); // defaultEnabled: true, tier matches
      });

      it('should deny STARTER tier from accessing advancedML', async () => {
        const tenant = createMockTenant('tenant-1', 'STARTER');
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

        expect(result).toBe(false); // Tier too low
      });

      it('should allow ENTERPRISE tier to access PROFESSIONAL tier features', async () => {
        const tenant = createMockTenant('tenant-1', 'ENTERPRISE');
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

        expect(result).toBe(true); // Higher tier has access
      });

      it('should allow ENTERPRISE_PLUS tier to access all features', async () => {
        const tenant = createMockTenant('tenant-1', 'ENTERPRISE_PLUS');
        tenantRepository.findById.mockResolvedValue(tenant);

        const mlEnabled = await service.isFeatureEnabled(
          'tenant-1',
          'advancedML',
        );
        const etlEnabled = await service.isFeatureEnabled(
          'tenant-1',
          'etlSync',
        );

        expect(mlEnabled).toBe(true);
        expect(etlEnabled).toBe(true); // ENTERPRISE_PLUS feature
      });

      it('should deny ENTERPRISE tier from accessing ENTERPRISE_PLUS features', async () => {
        const tenant = createMockTenant('tenant-1', 'ENTERPRISE');
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'etlSync');

        expect(result).toBe(false); // Requires ENTERPRISE_PLUS
      });
    });

    describe('Features Without Tier Requirements', () => {
      it('should allow all tiers to access features with no minimum tier', async () => {
        const starterTenant = createMockTenant('tenant-1', 'STARTER');
        tenantRepository.findById.mockResolvedValue(starterTenant);

        // aiAssistant has minimumTier: null
        const result = await service.isFeatureEnabled(
          'tenant-1',
          'aiAssistant',
        );

        // defaultEnabled: false for beta features, but no tier restriction
        expect(result).toBe(false); // Disabled by default, but accessible
      });
    });

    describe('Tenant-Specific Overrides', () => {
      it('should use tenant override when feature is explicitly enabled', async () => {
        const tenant = createMockTenant('tenant-1', 'STARTER', {
          advancedML: true, // Override: enable for STARTER tier
        });
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

        expect(result).toBe(true); // Override takes precedence
      });

      it('should use tenant override when feature is explicitly disabled', async () => {
        const tenant = createMockTenant('tenant-1', 'ENTERPRISE_PLUS', {
          advancedML: false, // Override: disable for ENTERPRISE_PLUS
        });
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

        expect(result).toBe(false); // Override takes precedence
      });

      it('should fall back to tier check when no override exists', async () => {
        const tenant = createMockTenant('tenant-1', 'PROFESSIONAL', {
          someOtherFeature: true, // Override for different feature
        });
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

        expect(result).toBe(true); // Tier check succeeds
      });

      it('should handle empty feature flags object', async () => {
        const tenant = createMockTenant('tenant-1', 'PROFESSIONAL', {});
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

        expect(result).toBe(true); // Falls through to tier check
      });
    });

    describe('Default Enabled State', () => {
      it('should return defaultEnabled when tier requirement met and no override', async () => {
        const tenant = createMockTenant('tenant-1', 'ENTERPRISE');
        tenantRepository.findById.mockResolvedValue(tenant);

        // productionForecasting: defaultEnabled: false
        const result = await service.isFeatureEnabled(
          'tenant-1',
          'productionForecasting',
        );

        expect(result).toBe(false); // Tier OK, but default disabled (beta feature)
      });

      it('should return defaultEnabled for features available to tenant tier', async () => {
        const tenant = createMockTenant('tenant-1', 'PROFESSIONAL');
        tenantRepository.findById.mockResolvedValue(tenant);

        // anomalyDetection: defaultEnabled: true
        const result = await service.isFeatureEnabled(
          'tenant-1',
          'anomalyDetection',
        );

        expect(result).toBe(true);
      });
    });

    describe('Beta Features', () => {
      it('should respect beta feature default (disabled) when no override', async () => {
        const tenant = createMockTenant('tenant-1', 'STARTER');
        tenantRepository.findById.mockResolvedValue(tenant);

        // aiAssistant is beta, defaultEnabled: false, no tier requirement
        const result = await service.isFeatureEnabled(
          'tenant-1',
          'aiAssistant',
        );

        expect(result).toBe(false); // Opt-in only
      });

      it('should allow beta feature when tenant explicitly enables it', async () => {
        const tenant = createMockTenant('tenant-1', 'STARTER', {
          aiAssistant: true, // Opt-in to beta
        });
        tenantRepository.findById.mockResolvedValue(tenant);

        const result = await service.isFeatureEnabled(
          'tenant-1',
          'aiAssistant',
        );

        expect(result).toBe(true); // Override enables beta feature
      });
    });
  });

  describe('areFeaturesEnabled()', () => {
    it('should check multiple features at once', async () => {
      const tenant = createMockTenant('tenant-1', 'PROFESSIONAL');
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.areFeaturesEnabled('tenant-1', [
        'advancedML',
        'anomalyDetection',
        'customIntegrations',
      ]);

      expect(result).toEqual({
        advancedML: true, // PROFESSIONAL tier
        anomalyDetection: true, // PROFESSIONAL tier
        customIntegrations: false, // Requires ENTERPRISE
      });
    });

    it('should return empty object for empty feature list', async () => {
      const tenant = createMockTenant('tenant-1', 'PROFESSIONAL');
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.areFeaturesEnabled('tenant-1', []);

      expect(result).toEqual({});
    });

    it('should handle mix of known and unknown features', async () => {
      const tenant = createMockTenant('tenant-1', 'PROFESSIONAL');
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.areFeaturesEnabled('tenant-1', [
        'advancedML',
        'unknownFeature',
      ]);

      expect(result).toEqual({
        advancedML: true,
        unknownFeature: false, // Unknown feature returns false
      });
    });
  });

  describe('getAllFeatureFlags()', () => {
    it('should return all feature flags for tenant', async () => {
      const tenant = createMockTenant('tenant-1', 'ENTERPRISE');
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.getAllFeatureFlags('tenant-1');

      // Should have all features from FEATURE_REGISTRY
      expect(result).toHaveProperty('advancedML');
      expect(result).toHaveProperty('anomalyDetection');
      expect(result).toHaveProperty('customIntegrations');
      expect(result).toHaveProperty('etlSync');
      expect(result).toHaveProperty('aiAssistant');

      // Verify some specific values based on ENTERPRISE tier
      expect(result.advancedML).toBe(true); // PROFESSIONAL feature
      expect(result.customIntegrations).toBe(true); // ENTERPRISE feature
      expect(result.etlSync).toBe(false); // ENTERPRISE_PLUS required
    });

    it('should respect tenant overrides in all flags response', async () => {
      const tenant = createMockTenant('tenant-1', 'STARTER', {
        advancedML: true, // Override: enable for STARTER
        aiAssistant: true, // Override: enable beta feature
      });
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.getAllFeatureFlags('tenant-1');

      expect(result.advancedML).toBe(true); // Override
      expect(result.aiAssistant).toBe(true); // Override
      expect(result.customIntegrations).toBe(false); // Tier restriction
    });
  });

  describe('getAllFeatures()', () => {
    it('should return all features with metadata', () => {
      const result = service.getAllFeatures();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check that features have proper structure
      const feature = result.find((f) => f.key === 'advancedML');
      expect(feature).toBeDefined();
      expect(feature).toHaveProperty('key');
      expect(feature).toHaveProperty('name');
      expect(feature).toHaveProperty('description');
      expect(feature).toHaveProperty('minimumTier');
      expect(feature).toHaveProperty('isBeta');
      expect(feature).toHaveProperty('defaultEnabled');
    });

    it('should return features with correct metadata', () => {
      const result = service.getAllFeatures();

      const advancedML = result.find((f) => f.key === 'advancedML');
      expect(advancedML?.name).toBe('Advanced ML & Predictive Analytics');
      expect(advancedML?.minimumTier).toBe('PROFESSIONAL');
      expect(advancedML?.isBeta).toBe(false);
      expect(advancedML?.defaultEnabled).toBe(true);
    });
  });

  describe('getFeaturesForTier()', () => {
    it('should return all features for STARTER tier', () => {
      const starterTier = SubscriptionTier.fromString('STARTER');
      const result = service.getFeaturesForTier(starterTier);

      // Should only include features with no tier requirement or STARTER
      const featureKeys = result.map((f) => f.key);

      // Beta features with no tier requirement
      expect(featureKeys).toContain('aiAssistant');
      expect(featureKeys).toContain('mobileAppV2');

      // Should NOT include PROFESSIONAL+ features
      expect(featureKeys).not.toContain('advancedML');
      expect(featureKeys).not.toContain('customIntegrations');
    });

    it('should return features for PROFESSIONAL tier', () => {
      const professionalTier = SubscriptionTier.fromString('PROFESSIONAL');
      const result = service.getFeaturesForTier(professionalTier);

      const featureKeys = result.map((f) => f.key);

      // Should include STARTER and PROFESSIONAL features
      expect(featureKeys).toContain('advancedML'); // PROFESSIONAL
      expect(featureKeys).toContain('anomalyDetection'); // PROFESSIONAL

      // Should NOT include ENTERPRISE+ features
      expect(featureKeys).not.toContain('customIntegrations'); // ENTERPRISE
      expect(featureKeys).not.toContain('etlSync'); // ENTERPRISE_PLUS
    });

    it('should return features for ENTERPRISE tier', () => {
      const enterpriseTier = SubscriptionTier.fromString('ENTERPRISE');
      const result = service.getFeaturesForTier(enterpriseTier);

      const featureKeys = result.map((f) => f.key);

      // Should include PROFESSIONAL and ENTERPRISE features
      expect(featureKeys).toContain('advancedML'); // PROFESSIONAL
      expect(featureKeys).toContain('customIntegrations'); // ENTERPRISE

      // Should NOT include ENTERPRISE_PLUS features
      expect(featureKeys).not.toContain('etlSync'); // ENTERPRISE_PLUS
    });

    it('should return all features for ENTERPRISE_PLUS tier', () => {
      const enterprisePlusTier = SubscriptionTier.fromString('ENTERPRISE_PLUS');
      const result = service.getFeaturesForTier(enterprisePlusTier);

      const featureKeys = result.map((f) => f.key);

      // Should include all features
      expect(featureKeys).toContain('advancedML'); // PROFESSIONAL
      expect(featureKeys).toContain('customIntegrations'); // ENTERPRISE
      expect(featureKeys).toContain('etlSync'); // ENTERPRISE_PLUS
      expect(featureKeys).toContain('aiAssistant'); // No tier requirement
    });

    it('should include features with no tier requirement in all tiers', () => {
      const tiers = [
        'STARTER',
        'PROFESSIONAL',
        'ENTERPRISE',
        'ENTERPRISE_PLUS',
      ];

      tiers.forEach((tierString) => {
        const tier = SubscriptionTier.fromString(tierString);
        const result = service.getFeaturesForTier(tier);
        const featureKeys = result.map((f) => f.key);

        // Features with null minimumTier should be in all tiers
        expect(featureKeys).toContain('aiAssistant');
        expect(featureKeys).toContain('mobileAppV2');
      });
    });
  });

  describe('Evaluation Order Priority', () => {
    it('should prioritize tenant override over tier check', async () => {
      const tenant = createMockTenant('tenant-1', 'STARTER', {
        advancedML: true, // Override: enable even though tier too low
      });
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

      // Override takes precedence over tier restriction
      expect(result).toBe(true);
    });

    it('should prioritize tier check over default when no override', async () => {
      const tenant = createMockTenant('tenant-1', 'STARTER'); // No overrides
      tenantRepository.findById.mockResolvedValue(tenant);

      // advancedML requires PROFESSIONAL, defaultEnabled: true
      const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

      // Tier check blocks access despite defaultEnabled: true
      expect(result).toBe(false);
    });

    it('should use default when tier OK and no override', async () => {
      const tenant = createMockTenant('tenant-1', 'ENTERPRISE'); // No overrides
      tenantRepository.findById.mockResolvedValue(tenant);

      // productionForecasting requires ENTERPRISE, defaultEnabled: false (beta)
      const result = await service.isFeatureEnabled(
        'tenant-1',
        'productionForecasting',
      );

      // Tier OK, no override, falls through to default
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tenant with null featureFlags', async () => {
      const tenant = createMockTenant('tenant-1', 'PROFESSIONAL');
      Object.defineProperty(tenant, 'featureFlags', {
        get: () => null,
        configurable: true,
      });
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

      // Should fall through to tier check
      expect(result).toBe(true);
    });

    it('should handle tenant with undefined featureFlags', async () => {
      const tenant = createMockTenant('tenant-1', 'PROFESSIONAL');
      Object.defineProperty(tenant, 'featureFlags', {
        get: () => undefined,
        configurable: true,
      });
      tenantRepository.findById.mockResolvedValue(tenant);

      const result = await service.isFeatureEnabled('tenant-1', 'advancedML');

      // Should fall through to tier check
      expect(result).toBe(true);
    });
  });
});
