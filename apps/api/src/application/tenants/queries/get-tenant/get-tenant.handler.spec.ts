/**
 * GetTenantHandler Tests
 *
 * Tests tenant query handler with comprehensive coverage of:
 * - Get tenant by ID
 * - Get tenant by slug
 * - Get tenant by subdomain
 * - Not found scenarios
 * - Query parameter validation
 */

import { NotFoundException } from '@nestjs/common';
import { GetTenantHandler } from './get-tenant.handler';
import { GetTenantQuery } from './get-tenant.query';
import { ITenantRepository } from '../../../../domain/repositories/tenant.repository.interface';
import { Tenant } from '../../../../domain/tenants/tenant.entity';
import { TenantStatus } from '../../../../domain/tenants/value-objects/tenant-status.vo';
import { SubscriptionTier } from '../../../../domain/tenants/value-objects/subscription-tier.vo';
import { DatabaseConfig } from '../../../../domain/tenants/value-objects/database-config.vo';

/* eslint-disable @typescript-eslint/unbound-method */

describe('GetTenantHandler', () => {
  let handler: GetTenantHandler;
  let mockRepository: jest.Mocked<ITenantRepository>;

  // Helper function to create a mock tenant
  const createMockTenant = (
    overrides?: Partial<{
      id: string;
      slug: string;
      subdomain: string;
      name: string;
      subscriptionTier: SubscriptionTier;
      status: TenantStatus;
    }>,
  ): Tenant => {
    return Tenant.fromPersistence({
      id: overrides?.id || 'tenant-123',
      slug: overrides?.slug || 'acme-oil-gas',
      subdomain: overrides?.subdomain || 'acme',
      tenantId: 'ACME-A5L32W',
      secretKeyHash: 'hashed_secret_key_placeholder',
      name: overrides?.name || 'ACME Oil & Gas',
      databaseConfig: DatabaseConfig.create({
        type: 'POSTGRESQL',
        url: 'postgresql://user:pass@localhost:5432/acme_wellpulse',
        name: 'acme_wellpulse',
        host: 'localhost',
        port: 5432,
      }),
      subscriptionTier:
        overrides?.subscriptionTier || SubscriptionTier.professional(),
      status: overrides?.status || TenantStatus.active(),
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
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    });
  };

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findBySubdomain: jest.fn(),
      findByTenantId: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      slugExists: jest.fn(),
      subdomainExists: jest.fn(),
      countByStatus: jest.fn(),
      findExpiredTrials: jest.fn(),
    } as jest.Mocked<ITenantRepository>;

    // Initialize handler with mock
    handler = new GetTenantHandler(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Get tenant by ID', () => {
      it('should return tenant when found by ID', async () => {
        // Arrange
        const mockTenant = createMockTenant({ id: 'tenant-123' });
        mockRepository.findById.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery('tenant-123');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toEqual(mockTenant);
        expect(result.id).toBe('tenant-123');
        expect(result.slug).toBe('acme-oil-gas');
        expect(result.subdomain).toBe('acme');
        expect(result.name).toBe('ACME Oil & Gas');

        // Verify repository method was called correctly
        expect(mockRepository.findById).toHaveBeenCalledWith('tenant-123');
        expect(mockRepository.findById).toHaveBeenCalledTimes(1);

        // Verify other methods were NOT called
        expect(mockRepository.findBySlug).not.toHaveBeenCalled();
        expect(mockRepository.findBySubdomain).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when tenant not found by ID', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        const query = new GetTenantQuery('nonexistent-id');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
        await expect(handler.execute(query)).rejects.toThrow(
          'Tenant not found: nonexistent-id',
        );

        expect(mockRepository.findById).toHaveBeenCalledWith('nonexistent-id');
      });

      it('should return tenant with different subscription tiers', async () => {
        // Test STARTER tier
        const starterTenant = createMockTenant({
          id: 'starter-tenant',
          subscriptionTier: SubscriptionTier.starter(),
        });
        mockRepository.findById.mockResolvedValue(starterTenant);

        let result = await handler.execute(
          new GetTenantQuery('starter-tenant'),
        );
        expect(result.subscriptionTier.isStarter()).toBe(true);

        // Test ENTERPRISE tier
        const enterpriseTenant = createMockTenant({
          id: 'enterprise-tenant',
          subscriptionTier: SubscriptionTier.enterprise(),
        });
        mockRepository.findById.mockResolvedValue(enterpriseTenant);

        result = await handler.execute(new GetTenantQuery('enterprise-tenant'));
        expect(result.subscriptionTier.isEnterprise()).toBe(true);

        // Test ENTERPRISE_PLUS tier
        const enterprisePlusTenant = createMockTenant({
          id: 'enterprise-plus-tenant',
          subscriptionTier: SubscriptionTier.enterprisePlus(),
        });
        mockRepository.findById.mockResolvedValue(enterprisePlusTenant);

        result = await handler.execute(
          new GetTenantQuery('enterprise-plus-tenant'),
        );
        expect(result.subscriptionTier.isEnterprisePlus()).toBe(true);
      });

      it('should return tenant with different statuses', async () => {
        // Test ACTIVE status
        const activeTenant = createMockTenant({
          id: 'active-tenant',
          status: TenantStatus.active(),
        });
        mockRepository.findById.mockResolvedValue(activeTenant);

        let result = await handler.execute(new GetTenantQuery('active-tenant'));
        expect(result.status.isActive()).toBe(true);

        // Test TRIAL status - need to create with trialEndsAt
        const trialTenant = Tenant.fromPersistence({
          id: 'trial-tenant',
          slug: 'trial-tenant',
          subdomain: 'trial',
          tenantId: 'TRIAL-T5L32W',
          secretKeyHash: 'hashed_secret_key_placeholder',
          name: 'Trial Tenant',
          databaseConfig: DatabaseConfig.create({
            type: 'POSTGRESQL',
            url: 'postgresql://user:pass@localhost:5432/trial_wellpulse',
            name: 'trial_wellpulse',
            host: 'localhost',
            port: 5432,
          }),
          subscriptionTier: SubscriptionTier.professional(),
          status: TenantStatus.trial(),
          maxWells: 200,
          maxUsers: 20,
          storageQuotaGb: 50,
          contactEmail: 'admin@trial.com',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Required for trial status
          featureFlags: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        mockRepository.findById.mockResolvedValue(trialTenant);

        result = await handler.execute(new GetTenantQuery('trial-tenant'));
        expect(result.status.isTrial()).toBe(true);
        expect(result.trialEndsAt).toBeInstanceOf(Date);

        // Test SUSPENDED status
        const suspendedTenant = createMockTenant({
          id: 'suspended-tenant',
          status: TenantStatus.suspended(),
        });
        mockRepository.findById.mockResolvedValue(suspendedTenant);

        result = await handler.execute(new GetTenantQuery('suspended-tenant'));
        expect(result.status.isSuspended()).toBe(true);
      });
    });

    describe('Get tenant by slug', () => {
      it('should return tenant when found by slug', async () => {
        // Arrange
        const mockTenant = createMockTenant({ slug: 'acme-oil-gas' });
        mockRepository.findBySlug.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, 'acme-oil-gas');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toEqual(mockTenant);
        expect(result.slug).toBe('acme-oil-gas');

        // Verify repository method was called correctly
        expect(mockRepository.findBySlug).toHaveBeenCalledWith('acme-oil-gas');
        expect(mockRepository.findBySlug).toHaveBeenCalledTimes(1);

        // Verify other methods were NOT called
        expect(mockRepository.findById).not.toHaveBeenCalled();
        expect(mockRepository.findBySubdomain).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when tenant not found by slug', async () => {
        // Arrange
        mockRepository.findBySlug.mockResolvedValue(null);

        const query = new GetTenantQuery(undefined, 'nonexistent-slug');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
        await expect(handler.execute(query)).rejects.toThrow(
          'Tenant not found: nonexistent-slug',
        );

        expect(mockRepository.findBySlug).toHaveBeenCalledWith(
          'nonexistent-slug',
        );
      });

      it('should handle slugs with hyphens', async () => {
        // Arrange
        const mockTenant = createMockTenant({
          slug: 'big-oil-and-gas-company',
        });
        mockRepository.findBySlug.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, 'big-oil-and-gas-company');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result.slug).toBe('big-oil-and-gas-company');
        expect(mockRepository.findBySlug).toHaveBeenCalledWith(
          'big-oil-and-gas-company',
        );
      });

      it('should handle slugs with numbers', async () => {
        // Arrange
        const mockTenant = createMockTenant({ slug: 'oil-company-123' });
        mockRepository.findBySlug.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, 'oil-company-123');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result.slug).toBe('oil-company-123');
        expect(mockRepository.findBySlug).toHaveBeenCalledWith(
          'oil-company-123',
        );
      });
    });

    describe('Get tenant by subdomain', () => {
      it('should return tenant when found by subdomain', async () => {
        // Arrange
        const mockTenant = createMockTenant({ subdomain: 'acme' });
        mockRepository.findBySubdomain.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, undefined, 'acme');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toEqual(mockTenant);
        expect(result.subdomain).toBe('acme');

        // Verify repository method was called correctly
        expect(mockRepository.findBySubdomain).toHaveBeenCalledWith('acme');
        expect(mockRepository.findBySubdomain).toHaveBeenCalledTimes(1);

        // Verify other methods were NOT called
        expect(mockRepository.findById).not.toHaveBeenCalled();
        expect(mockRepository.findBySlug).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when tenant not found by subdomain', async () => {
        // Arrange
        mockRepository.findBySubdomain.mockResolvedValue(null);

        const query = new GetTenantQuery(undefined, undefined, 'nonexistent');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
        await expect(handler.execute(query)).rejects.toThrow(
          'Tenant not found: nonexistent',
        );

        expect(mockRepository.findBySubdomain).toHaveBeenCalledWith(
          'nonexistent',
        );
      });

      it('should handle short subdomains', async () => {
        // Arrange
        const mockTenant = createMockTenant({ subdomain: 'ab' });
        mockRepository.findBySubdomain.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, undefined, 'ab');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result.subdomain).toBe('ab');
        expect(mockRepository.findBySubdomain).toHaveBeenCalledWith('ab');
      });

      it('should handle long subdomains', async () => {
        // Arrange
        const longSubdomain = 'verylongsubdomainnamefortenant';
        const mockTenant = createMockTenant({ subdomain: longSubdomain });
        mockRepository.findBySubdomain.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, undefined, longSubdomain);

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result.subdomain).toBe(longSubdomain);
        expect(mockRepository.findBySubdomain).toHaveBeenCalledWith(
          longSubdomain,
        );
      });
    });

    describe('Query priority', () => {
      it('should prioritize ID over slug and subdomain', async () => {
        // Arrange
        const mockTenant = createMockTenant({ id: 'tenant-123' });
        mockRepository.findById.mockResolvedValue(mockTenant);

        // Pass all three parameters
        const query = new GetTenantQuery('tenant-123', 'acme-oil-gas', 'acme');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toEqual(mockTenant);

        // Should only call findById
        expect(mockRepository.findById).toHaveBeenCalledWith('tenant-123');
        expect(mockRepository.findBySlug).not.toHaveBeenCalled();
        expect(mockRepository.findBySubdomain).not.toHaveBeenCalled();
      });

      it('should use slug when ID is not provided', async () => {
        // Arrange
        const mockTenant = createMockTenant({ slug: 'acme-oil-gas' });
        mockRepository.findBySlug.mockResolvedValue(mockTenant);

        // Pass slug and subdomain, but not ID
        const query = new GetTenantQuery(undefined, 'acme-oil-gas', 'acme');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toEqual(mockTenant);

        // Should call findBySlug, not findBySubdomain
        expect(mockRepository.findById).not.toHaveBeenCalled();
        expect(mockRepository.findBySlug).toHaveBeenCalledWith('acme-oil-gas');
        expect(mockRepository.findBySubdomain).not.toHaveBeenCalled();
      });

      it('should use subdomain when ID and slug are not provided', async () => {
        // Arrange
        const mockTenant = createMockTenant({ subdomain: 'acme' });
        mockRepository.findBySubdomain.mockResolvedValue(mockTenant);

        // Pass only subdomain
        const query = new GetTenantQuery(undefined, undefined, 'acme');

        // Act
        const result = await handler.execute(query);

        // Assert
        expect(result).toEqual(mockTenant);

        // Should only call findBySubdomain
        expect(mockRepository.findById).not.toHaveBeenCalled();
        expect(mockRepository.findBySlug).not.toHaveBeenCalled();
        expect(mockRepository.findBySubdomain).toHaveBeenCalledWith('acme');
      });
    });

    describe('Query validation', () => {
      it('should throw error when no identifier is provided in query constructor', () => {
        // Act & Assert
        expect(() => {
          new GetTenantQuery(undefined, undefined, undefined);
        }).toThrow(
          'At least one identifier (id, slug, or subdomain) must be provided',
        );
      });

      it('should allow creating query with only ID', () => {
        // Act & Assert
        expect(() => {
          new GetTenantQuery('tenant-123');
        }).not.toThrow();
      });

      it('should allow creating query with only slug', () => {
        // Act & Assert
        expect(() => {
          new GetTenantQuery(undefined, 'acme-oil-gas');
        }).not.toThrow();
      });

      it('should allow creating query with only subdomain', () => {
        // Act & Assert
        expect(() => {
          new GetTenantQuery(undefined, undefined, 'acme');
        }).not.toThrow();
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors', async () => {
        // Arrange
        mockRepository.findById.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const query = new GetTenantQuery('tenant-123');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should handle null response from findById', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        const query = new GetTenantQuery('tenant-123');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      });

      it('should handle null response from findBySlug', async () => {
        // Arrange
        mockRepository.findBySlug.mockResolvedValue(null);

        const query = new GetTenantQuery(undefined, 'acme-oil-gas');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      });

      it('should handle null response from findBySubdomain', async () => {
        // Arrange
        mockRepository.findBySubdomain.mockResolvedValue(null);

        const query = new GetTenantQuery(undefined, undefined, 'acme');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);
      });

      it('should include correct identifier in error message', async () => {
        // Test with ID
        mockRepository.findById.mockResolvedValue(null);
        await expect(
          handler.execute(new GetTenantQuery('id-123')),
        ).rejects.toThrow('Tenant not found: id-123');

        // Test with slug
        mockRepository.findBySlug.mockResolvedValue(null);
        await expect(
          handler.execute(new GetTenantQuery(undefined, 'test-slug')),
        ).rejects.toThrow('Tenant not found: test-slug');

        // Test with subdomain
        mockRepository.findBySubdomain.mockResolvedValue(null);
        await expect(
          handler.execute(new GetTenantQuery(undefined, undefined, 'testsub')),
        ).rejects.toThrow('Tenant not found: testsub');
      });
    });

    describe('Repository method call verification', () => {
      it('should call findById exactly once when ID is provided', async () => {
        // Arrange
        const mockTenant = createMockTenant();
        mockRepository.findById.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery('tenant-123');

        // Act
        await handler.execute(query);

        // Assert
        expect(mockRepository.findById).toHaveBeenCalledTimes(1);
        expect(mockRepository.findById).toHaveBeenCalledWith('tenant-123');
      });

      it('should call findBySlug exactly once when slug is provided', async () => {
        // Arrange
        const mockTenant = createMockTenant();
        mockRepository.findBySlug.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, 'acme-oil-gas');

        // Act
        await handler.execute(query);

        // Assert
        expect(mockRepository.findBySlug).toHaveBeenCalledTimes(1);
        expect(mockRepository.findBySlug).toHaveBeenCalledWith('acme-oil-gas');
      });

      it('should call findBySubdomain exactly once when subdomain is provided', async () => {
        // Arrange
        const mockTenant = createMockTenant();
        mockRepository.findBySubdomain.mockResolvedValue(mockTenant);

        const query = new GetTenantQuery(undefined, undefined, 'acme');

        // Act
        await handler.execute(query);

        // Assert
        expect(mockRepository.findBySubdomain).toHaveBeenCalledTimes(1);
        expect(mockRepository.findBySubdomain).toHaveBeenCalledWith('acme');
      });

      it('should not call any repository methods after NotFoundException', async () => {
        // Arrange
        mockRepository.findById.mockResolvedValue(null);

        const query = new GetTenantQuery('nonexistent');

        // Act & Assert
        await expect(handler.execute(query)).rejects.toThrow(NotFoundException);

        // Repository methods should only be called once (not retried)
        expect(mockRepository.findById).toHaveBeenCalledTimes(1);
        expect(mockRepository.findBySlug).not.toHaveBeenCalled();
        expect(mockRepository.findBySubdomain).not.toHaveBeenCalled();
      });
    });
  });
});
