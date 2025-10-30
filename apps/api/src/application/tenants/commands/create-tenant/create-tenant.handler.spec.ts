/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * CreateTenantHandler Tests
 *
 * Tests tenant creation command handler with comprehensive coverage of:
 * - Successful tenant creation
 * - Uniqueness validation (slug and subdomain)
 * - Database provisioning integration
 * - Error handling and failure scenarios
 * - Subscription tier validation
 * - Feature flag assignment based on tier
 */

import {
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateTenantHandler } from './create-tenant.handler';
import { CreateTenantCommand } from './create-tenant.command';
import { ITenantRepository } from '../../../../domain/repositories/tenant.repository.interface';
import { TenantProvisioningService } from '../../../../infrastructure/services/tenant-provisioning.service';
import { Tenant } from '../../../../domain/tenants/tenant.entity';

/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await */

describe('CreateTenantHandler', () => {
  let handler: CreateTenantHandler;
  let mockRepository: jest.Mocked<ITenantRepository>;
  let mockProvisioningService: jest.Mocked<TenantProvisioningService>;
  let mockSlackNotificationService: jest.Mocked<any>;

  // Mock environment variables
  const originalEnv = process.env;

  beforeAll(() => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_USER = 'wellpulse';
    process.env.POSTGRES_PASSWORD = 'wellpulse';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Create mock repository with all methods
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

    // Create mock provisioning service
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    mockProvisioningService = {
      provisionTenantDatabase: jest.fn(),
      deprovisionTenantDatabase: jest.fn(),
    } as any;

    // Create mock Slack notification service
    mockSlackNotificationService = {
      notifyTenantCreated: jest.fn().mockResolvedValue(undefined),
      isEnabled: jest.fn().mockReturnValue(false), // Disabled by default in tests
    };

    // Initialize handler with mocks
    handler = new CreateTenantHandler(
      mockRepository,
      mockProvisioningService,
      mockSlackNotificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Successful tenant creation', () => {
      it('should create a tenant with STARTER tier', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'acme-oil-gas',
          'acme',
          'ACME Oil & Gas',
          'admin@acme.com',
          'STARTER',
          'POSTGRESQL',
          '+1-555-0123',
          'billing@acme.com',
          undefined, // maxWells - use defaults
          undefined, // maxUsers - use defaults
          undefined, // storageQuotaGb - use defaults
          undefined, // trialDays
          'admin@wellpulse.io',
        );

        // Mock uniqueness validation (no conflicts)
        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Mock successful database provisioning
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'acme_oil_gas_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/acme_oil_gas_wellpulse',
          success: true,
        });

        // Mock repository create

        mockRepository.create.mockImplementation(async (tenant: Tenant) => {
          return tenant;
        });

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result).toBeInstanceOf(Tenant);
        expect(result.slug).toBe('acme-oil-gas');
        expect(result.subdomain).toBe('acme');
        expect(result.name).toBe('ACME Oil & Gas');
        expect(result.contactEmail).toBe('admin@acme.com');
        expect(result.contactPhone).toBe('+1-555-0123');
        expect(result.billingEmail).toBe('billing@acme.com');
        expect(result.subscriptionTier.isStarter()).toBe(true);
        expect(result.status.isActive()).toBe(true);
        expect(result.createdBy).toBe('admin@wellpulse.io');

        // Verify default limits for STARTER tier
        expect(result.maxWells).toBe(50);
        expect(result.maxUsers).toBe(5);
        expect(result.storageQuotaGb).toBe(10);

        // Verify feature flags for STARTER tier
        expect(result.featureFlags?.enableMlPredictions).toBe(false);
        expect(result.featureFlags?.enableOfflineSync).toBe(true);
        expect(result.featureFlags?.enableAdvancedReporting).toBe(false);
        expect(result.featureFlags?.enableCustomIntegrations).toBe(false);
        expect(result.featureFlags?.enableETLSync).toBe(false);
        expect(result.featureFlags?.enableMultiDatabase).toBe(false);
        expect(result.featureFlags?.enablePrioritySupport).toBe(false);

        // Verify method calls

        expect(mockRepository.slugExists).toHaveBeenCalledWith('acme-oil-gas');

        expect(mockRepository.subdomainExists).toHaveBeenCalledWith('acme');

        expect(
          mockProvisioningService.provisionTenantDatabase,
        ).toHaveBeenCalled();

        expect(mockRepository.create).toHaveBeenCalled();
      });

      it('should create a tenant with PROFESSIONAL tier', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'demo-oil',
          'demo',
          'Demo Oil Company',
          'contact@demo.com',
          'PROFESSIONAL',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'demo_oil_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/demo_oil_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result.subscriptionTier.isProfessional()).toBe(true);
        expect(result.maxWells).toBe(200);
        expect(result.maxUsers).toBe(20);
        expect(result.storageQuotaGb).toBe(50);

        // PROFESSIONAL tier has ML predictions
        expect(result.featureFlags?.enableMlPredictions).toBe(true);
        expect(result.featureFlags?.enableAdvancedReporting).toBe(true);
        expect(result.featureFlags?.enableCustomIntegrations).toBe(false); // Only ENTERPRISE+
        expect(result.featureFlags?.enableETLSync).toBe(false); // Only ENTERPRISE_PLUS
      });

      it('should create a tenant with ENTERPRISE tier', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'big-oil',
          'bigoil',
          'Big Oil Corporation',
          'admin@bigoil.com',
          'ENTERPRISE',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'big_oil_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/big_oil_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result.subscriptionTier.isEnterprise()).toBe(true);
        expect(result.maxWells).toBe(1000);
        expect(result.maxUsers).toBe(100);
        expect(result.storageQuotaGb).toBe(250);

        // ENTERPRISE tier has advanced features
        expect(result.featureFlags?.enableMlPredictions).toBe(true);
        expect(result.featureFlags?.enableAdvancedReporting).toBe(true);
        expect(result.featureFlags?.enableCustomIntegrations).toBe(true);
        expect(result.featureFlags?.enableMultiDatabase).toBe(true);
        expect(result.featureFlags?.enablePrioritySupport).toBe(true);
        expect(result.featureFlags?.enableETLSync).toBe(false); // Only ENTERPRISE_PLUS
      });

      it('should create a tenant with ENTERPRISE_PLUS tier', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'mega-oil',
          'megaoil',
          'Mega Oil Industries',
          'admin@megaoil.com',
          'ENTERPRISE_PLUS',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'mega_oil_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/mega_oil_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result.subscriptionTier.isEnterprisePlus()).toBe(true);
        expect(result.maxWells).toBe(10000);
        expect(result.maxUsers).toBe(500);
        expect(result.storageQuotaGb).toBe(1000);

        // ENTERPRISE_PLUS tier has all features
        expect(result.featureFlags?.enableMlPredictions).toBe(true);
        expect(result.featureFlags?.enableAdvancedReporting).toBe(true);
        expect(result.featureFlags?.enableCustomIntegrations).toBe(true);
        expect(result.featureFlags?.enableMultiDatabase).toBe(true);
        expect(result.featureFlags?.enablePrioritySupport).toBe(true);
        expect(result.featureFlags?.enableETLSync).toBe(true);
      });

      it('should create a trial tenant with trial end date', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'trial-oil',
          'trial',
          'Trial Oil Company',
          'trial@test.com',
          'PROFESSIONAL',
          'POSTGRESQL',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          14, // 14-day trial
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'trial_oil_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/trial_oil_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result.status.isTrial()).toBe(true);
        expect(result.trialEndsAt).toBeInstanceOf(Date);

        // Verify trial end date is approximately 14 days from now
        const expectedTrialEnd = new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        );
        const actualTrialEnd = result.trialEndsAt!;
        const timeDiff = Math.abs(
          expectedTrialEnd.getTime() - actualTrialEnd.getTime(),
        );
        expect(timeDiff).toBeLessThan(1000); // Within 1 second tolerance
      });

      it('should create tenant with custom limits that override defaults', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'custom-oil',
          'custom',
          'Custom Oil Company',
          'custom@test.com',
          'PROFESSIONAL',
          'POSTGRESQL',
          undefined,
          undefined,
          150, // Custom maxWells
          15, // Custom maxUsers
          40, // Custom storageQuotaGb
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'custom_oil_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/custom_oil_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert - should use custom limits instead of defaults
        expect(result.maxWells).toBe(150);
        expect(result.maxUsers).toBe(15);
        expect(result.storageQuotaGb).toBe(40);
      });

      it('should create tenant with PostgreSQL database type (case insensitive)', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'legacy-oil',
          'legacy',
          'Legacy Oil Systems',
          'admin@legacy.com',
          'ENTERPRISE_PLUS',
          'postgresql', // Lowercase to test case handling
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'legacy_oil_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/legacy_oil_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert
        expect(result).toBeInstanceOf(Tenant);
        expect(result.databaseConfig.type.toString()).toBe('POSTGRESQL');

        expect(
          mockProvisioningService.provisionTenantDatabase,
        ).toHaveBeenCalled();
      });
    });

    describe('Uniqueness validation', () => {
      it('should throw ConflictException when slug already exists', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'existing-slug',
          'newsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(true); // Slug exists
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          ConflictException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          "Tenant with slug 'existing-slug' already exists",
        );

        // Verify provisioning was never called

        expect(
          mockProvisioningService.provisionTenantDatabase,
        ).not.toHaveBeenCalled();

        expect(mockRepository.create).not.toHaveBeenCalled();
      });

      it('should throw ConflictException when subdomain already exists', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'new-slug',
          'existing-subdomain',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(true); // Subdomain exists

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          ConflictException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          "Tenant with subdomain 'existing-subdomain' already exists",
        );

        // Verify provisioning was never called

        expect(
          mockProvisioningService.provisionTenantDatabase,
        ).not.toHaveBeenCalled();

        expect(mockRepository.create).not.toHaveBeenCalled();
      });

      it('should throw ConflictException when both slug and subdomain exist', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'existing-slug',
          'existing-subdomain',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(true);
        mockRepository.subdomainExists.mockResolvedValue(true);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          ConflictException,
        );
        // Should throw for slug first (order of validation)
        await expect(handler.execute(command)).rejects.toThrow(
          "Tenant with slug 'existing-slug' already exists",
        );
      });
    });

    describe('Subscription tier validation', () => {
      it('should throw BadRequestException for invalid subscription tier', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'INVALID_TIER', // Invalid tier
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          BadRequestException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid subscription tier: INVALID_TIER. Must be one of: STARTER, PROFESSIONAL, ENTERPRISE, ENTERPRISE_PLUS',
        );
      });

      it('should handle case-insensitive subscription tier', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'professional', // Lowercase
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'test_slug_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/test_slug_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert - should successfully parse lowercase tier
        expect(result.subscriptionTier.isProfessional()).toBe(true);
      });
    });

    describe('Database provisioning integration', () => {
      it('should throw InternalServerErrorException when provisioning fails', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Mock provisioning failure
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'test_slug_wellpulse',
          databaseUrl: '',
          success: false,
          error: 'Failed to connect to PostgreSQL server',
        });

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Failed to provision tenant database: Failed to connect to PostgreSQL server',
        );

        // Verify tenant was NOT created in database

        expect(mockRepository.create).not.toHaveBeenCalled();
      });

      it('should update database config with provisioned URL', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        const provisionedUrl =
          'postgresql://wellpulse:wellpulse@db.azure.com:5432/test_slug_wellpulse';

        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'test_slug_wellpulse',
          databaseUrl: provisionedUrl,
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert - should use the provisioned URL, not the initial URL
        expect(result.databaseConfig.url).toBe(provisionedUrl);
        expect(result.databaseConfig.name).toBe('test_slug_wellpulse');
      });

      it('should provision database before persisting tenant', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        const callOrder: string[] = [];

        mockProvisioningService.provisionTenantDatabase.mockImplementation(
          async () => {
            callOrder.push('provision');
            return {
              databaseName: 'test_slug_wellpulse',
              databaseUrl:
                'postgresql://wellpulse:wellpulse@localhost:5432/test_slug_wellpulse',
              success: true,
            };
          },
        );

        mockRepository.create.mockImplementation(async (tenant: Tenant) => {
          callOrder.push('create');
          return tenant;
        });

        // Act
        await handler.execute(command);

        // Assert - provisioning must happen before repository create
        expect(callOrder).toEqual(['provision', 'create']);
      });
    });

    describe('Database type validation', () => {
      it('should throw BadRequestException for SQL_SERVER (not yet implemented)', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'SQL_SERVER',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          BadRequestException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'SQL Server support not yet implemented',
        );
      });

      it('should throw BadRequestException for MYSQL (not yet implemented)', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'MYSQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          BadRequestException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'MySQL support not yet implemented',
        );
      });

      it('should throw BadRequestException for ORACLE (not yet implemented)', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'ORACLE',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          BadRequestException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Oracle support not yet implemented',
        );
      });

      it('should throw BadRequestException for invalid database type', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'MONGODB', // Invalid
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          BadRequestException,
        );
        await expect(handler.execute(command)).rejects.toThrow(
          'Invalid database type: MONGODB. Must be one of: POSTGRESQL, SQL_SERVER, MYSQL, ORACLE, ETL_SYNCED',
        );
      });

      it('should handle case-insensitive database type', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'postgresql', // Lowercase
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);
        mockProvisioningService.provisionTenantDatabase.mockResolvedValue({
          databaseName: 'test_slug_wellpulse',
          databaseUrl:
            'postgresql://wellpulse:wellpulse@localhost:5432/test_slug_wellpulse',
          success: true,
        });

        mockRepository.create.mockImplementation(
          async (tenant: Tenant) => tenant,
        );

        // Act
        const result = await handler.execute(command);

        // Assert - should successfully parse lowercase database type
        expect(result.databaseConfig.type.toString()).toBe('POSTGRESQL');
      });
    });

    describe('Error handling', () => {
      it('should propagate repository errors', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockRejectedValue(
          new Error('Database connection failed'),
        );

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should propagate provisioning service errors', async () => {
        // Arrange
        const command = new CreateTenantCommand(
          'test-slug',
          'testsub',
          'Test Company',
          'test@test.com',
          'STARTER',
          'POSTGRESQL',
        );

        mockRepository.slugExists.mockResolvedValue(false);
        mockRepository.subdomainExists.mockResolvedValue(false);

        mockProvisioningService.provisionTenantDatabase.mockRejectedValue(
          new Error('PostgreSQL server not accessible'),
        );

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(
          'PostgreSQL server not accessible',
        );
      });
    });
  });
});
