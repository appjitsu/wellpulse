/**
 * Tenant Entity Tests
 *
 * Tests all business rules and lifecycle methods of the Tenant entity.
 */

import { Tenant } from './tenant.entity';
import { TenantStatus } from './value-objects/tenant-status.vo';
import { SubscriptionTier } from './value-objects/subscription-tier.vo';
import { DatabaseConfig } from './value-objects/database-config.vo';

describe('Tenant Entity', () => {
  const validProps = {
    slug: 'acme-oil-gas',
    subdomain: 'acme',
    name: 'ACME Oil & Gas',
    databaseConfig: DatabaseConfig.create({
      type: 'POSTGRESQL',
      url: 'postgresql://user:pass@localhost:5432/acme_wellpulse',
      name: 'acme_wellpulse',
      host: 'localhost',
      port: 5432,
    }),
    subscriptionTier: SubscriptionTier.professional(),
    status: TenantStatus.active(),
    maxWells: 200,
    maxUsers: 20,
    storageQuotaGb: 50,
    contactEmail: 'admin@acme.com',
    contactPhone: '+1-555-0123',
    billingEmail: 'billing@acme.com',
    featureFlags: {
      enableMlPredictions: true,
      enableOfflineSync: true,
    },
  };

  describe('create', () => {
    it('should create a valid tenant', () => {
      const tenant = Tenant.create(validProps);

      expect(tenant).toBeInstanceOf(Tenant);
      expect(tenant.slug).toBe('acme-oil-gas');
      expect(tenant.subdomain).toBe('acme');
      expect(tenant.name).toBe('ACME Oil & Gas');
      expect(tenant.id).toBeDefined();
      expect(tenant.createdAt).toBeInstanceOf(Date);
      expect(tenant.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique IDs for different tenants', () => {
      const tenant1 = Tenant.create(validProps);
      const tenant2 = Tenant.create({
        ...validProps,
        slug: 'demo',
        subdomain: 'demo',
      });

      expect(tenant1.id).not.toBe(tenant2.id);
    });

    it('should throw error for invalid slug (uppercase)', () => {
      expect(() => {
        Tenant.create({ ...validProps, slug: 'ACME-OIL-GAS' });
      }).toThrow(
        'Tenant slug must be lowercase alphanumeric with hyphens only',
      );
    });

    it('should throw error for invalid slug (special characters)', () => {
      expect(() => {
        Tenant.create({ ...validProps, slug: 'acme@oil&gas' });
      }).toThrow(
        'Tenant slug must be lowercase alphanumeric with hyphens only',
      );
    });

    it('should throw error for invalid subdomain (uppercase)', () => {
      expect(() => {
        Tenant.create({ ...validProps, subdomain: 'ACME' });
      }).toThrow(
        'Tenant subdomain must be lowercase alphanumeric with hyphens only',
      );
    });

    it('should throw error for trial tenant without trial end date', () => {
      expect(() => {
        Tenant.create({
          ...validProps,
          status: TenantStatus.trial(),
          trialEndsAt: undefined,
        });
      }).toThrow('Trial tenants must have trialEndsAt date');
    });

    it('should throw error for negative maxWells', () => {
      expect(() => {
        Tenant.create({ ...validProps, maxWells: -1 });
      }).toThrow('Max wells must be greater than 0');
    });

    it('should allow exceeding tier limits during creation', () => {
      // Note: Tier limit validation happens during upgrade/downgrade operations,
      // not during initial creation. This allows flexibility for custom enterprise deals.
      const starterLimits = SubscriptionTier.starter().getDefaultLimits();

      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(),
        maxWells: starterLimits.maxWells + 1,
      });

      expect(tenant).toBeInstanceOf(Tenant);
      expect(tenant.maxWells).toBe(starterLimits.maxWells + 1);
    });
  });

  describe('activate', () => {
    it('should activate a trial tenant', () => {
      const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const tenant = Tenant.create({
        ...validProps,
        status: TenantStatus.trial(),
        trialEndsAt: trialEndDate,
      });

      tenant.activate();

      expect(tenant.status.isActive()).toBe(true);
      // Note: trialEndsAt is retained for historical purposes even after activation
      expect(tenant.trialEndsAt).toEqual(trialEndDate);
    });

    it('should activate a suspended tenant', () => {
      const tenant = Tenant.create(validProps);
      tenant.suspend('Testing');

      expect(tenant.status.isSuspended()).toBe(true);

      tenant.activate();

      expect(tenant.status.isActive()).toBe(true);
    });

    it('should throw error when activating deleted tenant', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(), // Use free tier so it can be deleted
      });
      tenant.delete();

      expect(() => tenant.activate()).toThrow('Cannot activate deleted tenant');
    });
  });

  describe('suspend', () => {
    it('should suspend an active tenant', () => {
      const tenant = Tenant.create(validProps);

      tenant.suspend('Payment failed');

      expect(tenant.status.isSuspended()).toBe(true);
      expect(tenant.metadata?.suspensionReason).toBe('Payment failed');
      expect(tenant.metadata?.suspendedAt).toBeDefined();
    });

    it('should throw error when suspending already suspended tenant', () => {
      const tenant = Tenant.create(validProps);
      tenant.suspend('First suspension');

      expect(() => tenant.suspend('Second suspension')).toThrow(
        'Tenant is already suspended',
      );
    });

    it('should throw error when suspending deleted tenant', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(), // Use free tier so it can be deleted
      });
      tenant.delete();

      expect(() => tenant.suspend('Test')).toThrow(
        'Cannot suspend deleted tenant',
      );
    });
  });

  describe('delete', () => {
    it('should soft delete a tenant', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(), // Use free tier so it can be deleted
      });

      tenant.delete();

      expect(tenant.status.isDeleted()).toBe(true);
      expect(tenant.deletedAt).toBeInstanceOf(Date);
    });

    it('should throw error when deleting tenant with active paid subscription', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
        status: TenantStatus.active(),
      });

      expect(() => tenant.delete()).toThrow(
        'Cannot delete tenant with active paid subscription',
      );
    });

    it('should allow deleting free tier tenant', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(),
      });

      expect(() => tenant.delete()).not.toThrow();
      expect(tenant.status.isDeleted()).toBe(true);
    });

    it('should allow deleting suspended paid tenant', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
      });
      tenant.suspend('Non-payment');

      expect(() => tenant.delete()).not.toThrow();
      expect(tenant.status.isDeleted()).toBe(true);
    });
  });

  describe('upgradeTier', () => {
    it('should upgrade from STARTER to PROFESSIONAL', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(),
        maxWells: 50,
      });

      tenant.upgradeTier(SubscriptionTier.professional());

      expect(tenant.subscriptionTier.isProfessional()).toBe(true);
      expect(tenant.maxWells).toBe(200); // Updated to professional limits
    });

    it('should upgrade from PROFESSIONAL to ENTERPRISE', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
      });

      tenant.upgradeTier(SubscriptionTier.enterprise());

      expect(tenant.subscriptionTier.isEnterprise()).toBe(true);
    });

    it('should throw error when downgrading via upgradeTier', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
      });

      expect(() => {
        tenant.upgradeTier(SubscriptionTier.starter());
      }).toThrow('New tier must be higher than current tier');
    });

    it('should throw error when upgrading to same tier', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
      });

      expect(() => {
        tenant.upgradeTier(SubscriptionTier.professional());
      }).toThrow('New tier must be higher than current tier');
    });
  });

  describe('downgradeTier', () => {
    it('should downgrade from PROFESSIONAL to STARTER if usage allows', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
        maxWells: 200,
      });

      const currentUsage = { wells: 40, users: 3 }; // Within STARTER limits

      tenant.downgradeTier(SubscriptionTier.starter(), currentUsage);

      expect(tenant.subscriptionTier.isStarter()).toBe(true);
    });

    it('should throw error when downgrading exceeds well limit', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
      });

      const currentUsage = { wells: 150, users: 3 }; // Exceeds STARTER limit (50)

      expect(() => {
        tenant.downgradeTier(SubscriptionTier.starter(), currentUsage);
      }).toThrow(
        'Cannot downgrade: Current well count (150) exceeds new tier limit',
      );
    });

    it('should throw error when downgrading exceeds user limit', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.professional(),
      });

      const currentUsage = { wells: 40, users: 10 }; // Exceeds STARTER limit (5)

      expect(() => {
        tenant.downgradeTier(SubscriptionTier.starter(), currentUsage);
      }).toThrow(
        'Cannot downgrade: Current user count (10) exceeds new tier limit',
      );
    });
  });

  describe('setFeatureFlag', () => {
    it('should enable a feature flag', () => {
      const tenant = Tenant.create(validProps);

      tenant.setFeatureFlag('enableMlPredictions', true);

      expect(tenant.hasFeature('enableMlPredictions')).toBe(true);
    });

    it('should disable a feature flag', () => {
      const tenant = Tenant.create({
        ...validProps,
        featureFlags: {
          enableMlPredictions: true,
        },
      });

      tenant.setFeatureFlag('enableMlPredictions', false);

      expect(tenant.hasFeature('enableMlPredictions')).toBe(false);
    });

    it('should throw error when modifying flags for deleted tenant', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(), // Use free tier so it can be deleted
      });
      tenant.delete();

      expect(() => tenant.setFeatureFlag('enableMlPredictions', true)).toThrow(
        'Cannot modify feature flags for deleted tenant',
      );
    });
  });

  describe('updateDetails', () => {
    it('should update tenant name', () => {
      const tenant = Tenant.create(validProps);

      tenant.updateDetails({ name: 'Updated ACME Oil & Gas' });

      expect(tenant.name).toBe('Updated ACME Oil & Gas');
    });

    it('should update contact email', () => {
      const tenant = Tenant.create(validProps);

      tenant.updateDetails({ contactEmail: 'new-admin@acme.com' });

      expect(tenant.contactEmail).toBe('new-admin@acme.com');
    });

    it('should throw error for invalid email', () => {
      const tenant = Tenant.create(validProps);

      expect(() => {
        tenant.updateDetails({ contactEmail: 'invalid-email' });
      }).toThrow('Contact email must be valid');
    });

    it('should throw error when updating deleted tenant', () => {
      const tenant = Tenant.create({
        ...validProps,
        subscriptionTier: SubscriptionTier.starter(), // Use free tier so it can be deleted
      });
      tenant.delete();

      expect(() => {
        tenant.updateDetails({ name: 'New Name' });
      }).toThrow('Cannot update deleted tenant');
    });
  });

  describe('toPersistence', () => {
    it('should convert entity to persistence format', () => {
      const tenant = Tenant.create(validProps);

      const persistence = tenant.toPersistence();

      expect(persistence.slug).toBe('acme-oil-gas');
      expect(persistence.subdomain).toBe('acme');
      expect(persistence.subscriptionTier).toEqual(
        SubscriptionTier.professional(),
      );
      expect(persistence.status).toEqual(TenantStatus.active());
      expect(persistence.databaseConfig).toEqual(validProps.databaseConfig);
    });
  });

  describe('fromPersistence', () => {
    it('should reconstruct entity from persistence format', () => {
      const persistenceData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'acme-oil-gas',
        subdomain: 'acme',
        name: 'ACME Oil & Gas',
        databaseConfig: DatabaseConfig.create({
          type: 'POSTGRESQL',
          url: 'postgresql://user:pass@localhost:5432/acme_wellpulse',
          name: 'acme_wellpulse',
          host: 'localhost',
          port: 5432,
        }),
        subscriptionTier: SubscriptionTier.professional(),
        status: TenantStatus.active(),
        maxWells: 200,
        maxUsers: 20,
        storageQuotaGb: 50,
        contactEmail: 'admin@acme.com',
        featureFlags: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tenant = Tenant.fromPersistence(persistenceData);

      expect(tenant.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(tenant.slug).toBe('acme-oil-gas');
      expect(tenant.name).toBe('ACME Oil & Gas');
    });
  });
});
