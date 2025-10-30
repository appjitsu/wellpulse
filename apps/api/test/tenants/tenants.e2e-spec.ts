/**
 * Tenants E2E Tests
 *
 * Tests the complete tenant management flow:
 * - Tenant creation with database provisioning
 * - Slug and subdomain uniqueness validation
 * - Database type validation (POSTGRESQL, SQL_SERVER, etc.)
 * - Subscription tier validation
 * - Trial period management
 * - Tenant retrieval by ID, slug, and subdomain
 * - Tenant status lifecycle
 * - Database provisioning verification
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

describe('Tenants (e2e)', () => {
  let app: INestApplication;
  let createdTenantId: string;
  let testSlug: string;
  let testSubdomain: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same middleware as main.ts
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();

    // Generate unique identifiers for testing
    const timestamp = Date.now();
    testSlug = `test-tenant-${timestamp}`;
    testSubdomain = `test${timestamp}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Create Tenant', () => {
    it('should create a new tenant successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: testSlug,
          subdomain: testSubdomain,
          name: 'Test Oil & Gas Company',
          contactEmail: 'admin@test-tenant.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
          contactPhone: '+1-555-0123',
          billingEmail: 'billing@test-tenant.com',
          maxWells: 100,
          maxUsers: 10,
          storageQuotaGb: 50,
          trialDays: 30,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.slug).toBe(testSlug);
      expect(response.body.subdomain).toContain(testSubdomain);
      expect(response.body.name).toBe('Test Oil & Gas Company');
      expect(response.body.status).toBe('TRIAL');
      expect(response.body.databaseType).toBe('POSTGRESQL');
      expect(response.body.subscriptionTier).toBe('STARTER');
      expect(response.body).toHaveProperty('databaseName');
      expect(response.body).toHaveProperty('databaseUrl');

      // Save tenant ID for subsequent tests
      createdTenantId = response.body.id;
    });

    it('should create tenant with default values when optionals omitted', async () => {
      const slug = `minimal-${Date.now()}`;
      const subdomain = `min${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Minimal Tenant',
          contactEmail: 'contact@minimal.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(201);

      expect(response.body.maxWells).toBe(50); // Default
      expect(response.body.maxUsers).toBe(5); // Default
      expect(response.body.storageQuotaGb).toBe(10); // Default
    });

    it('should reject duplicate slug', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: testSlug, // Duplicate
          subdomain: `unique-${Date.now()}`,
          name: 'Duplicate Slug Tenant',
          contactEmail: 'dup@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(409); // Conflict
    });

    it('should reject duplicate subdomain', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: `unique-${Date.now()}`,
          subdomain: testSubdomain, // Duplicate
          name: 'Duplicate Subdomain Tenant',
          contactEmail: 'dup2@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(409); // Conflict
    });

    it('should validate slug format (lowercase alphanumeric with hyphens)', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: 'INVALID_SLUG', // Invalid: uppercase and underscore
          subdomain: `sub${Date.now()}`,
          name: 'Invalid Slug Tenant',
          contactEmail: 'invalid@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(400);
    });

    it('should validate subdomain format (lowercase alphanumeric with hyphens)', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: `slug${Date.now()}`,
          subdomain: 'INVALID.SUB', // Invalid: uppercase and dot
          name: 'Invalid Subdomain Tenant',
          contactEmail: 'invalid2@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(400);
    });

    it('should validate email format', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: `email-test-${Date.now()}`,
          subdomain: `email${Date.now()}`,
          name: 'Email Test Tenant',
          contactEmail: 'not-an-email', // Invalid email
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(400);
    });

    it('should validate trial days range (1-90)', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: `trial-test-${Date.now()}`,
          subdomain: `trial${Date.now()}`,
          name: 'Trial Test Tenant',
          contactEmail: 'trial@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
          trialDays: 100, // Invalid: > 90
        })
        .expect(400);
    });

    it('should validate maxWells is positive', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug: `wells-test-${Date.now()}`,
          subdomain: `wells${Date.now()}`,
          name: 'Wells Test Tenant',
          contactEmail: 'wells@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
          maxWells: 0, // Invalid: must be >= 1
        })
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          // Missing slug, subdomain, name, etc.
          contactEmail: 'incomplete@test.com',
        })
        .expect(400);
    });

    it('should support different database types', async () => {
      const slug = `sqlserver-${Date.now()}`;
      const subdomain = `sql${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'SQL Server Tenant',
          contactEmail: 'sqlserver@test.com',
          subscriptionTier: 'ENTERPRISE',
          databaseType: 'SQL_SERVER', // Different DB type
        })
        .expect(201);

      expect(response.body.databaseType).toBe('SQL_SERVER');
    });

    it('should support different subscription tiers', async () => {
      const testCases = [
        { tier: 'STARTER' },
        { tier: 'PROFESSIONAL' },
        { tier: 'ENTERPRISE' },
        { tier: 'ENTERPRISE_PLUS' },
      ];

      for (const { tier } of testCases) {
        const slug = `tier-${tier.toLowerCase()}-${Date.now()}`;
        const subdomain = `${tier.toLowerCase()}${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/api/tenants')
          .send({
            slug,
            subdomain,
            name: `${tier} Tier Tenant`,
            contactEmail: `${tier.toLowerCase()}@test.com`,
            subscriptionTier: tier,
            databaseType: 'POSTGRESQL',
          })
          .expect(201);

        expect(response.body.subscriptionTier).toBe(tier);
        // Note: Business rules for tier-based limits would be tested here
      }
    }, 30000); // Increase timeout for multiple requests
  });

  describe('Get Tenant by ID', () => {
    it('should get tenant by ID successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tenants/${createdTenantId}`)
        .expect(200);

      expect(response.body.id).toBe(createdTenantId);
      expect(response.body.slug).toBe(testSlug);
      expect(response.body.subdomain).toContain(testSubdomain);
    });

    it('should return 404 for non-existent tenant', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/tenants/${fakeId}`)
        .expect(404);
    });

    it('should validate UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/tenants/invalid-uuid')
        .expect(400);
    });
  });

  describe('Get Tenant by Slug', () => {
    it('should get tenant by slug successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tenants?slug=${testSlug}`)
        .expect(200);

      expect(response.body.id).toBe(createdTenantId);
      expect(response.body.slug).toBe(testSlug);
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app.getHttpServer())
        .get('/api/tenants?slug=non-existent-tenant')
        .expect(404);
    });
  });

  describe('Get Tenant by Subdomain', () => {
    it('should get tenant by subdomain successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tenants?subdomain=${testSubdomain}`)
        .expect(200);

      expect(response.body.id).toBe(createdTenantId);
      expect(response.body.subdomain).toContain(testSubdomain);
    });

    it('should return 404 for non-existent subdomain', async () => {
      await request(app.getHttpServer())
        .get('/api/tenants?subdomain=nonexistent')
        .expect(404);
    });
  });

  describe('Tenant Status Lifecycle', () => {
    it('should create tenant in TRIAL status with trial period', async () => {
      const slug = `lifecycle-${Date.now()}`;
      const subdomain = `life${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Lifecycle Test Tenant',
          contactEmail: 'lifecycle@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
          trialDays: 14,
        })
        .expect(201);

      expect(response.body.status).toBe('TRIAL');
      expect(response.body).toHaveProperty('trialEndsAt');
    });

    it('should create tenant in ACTIVE status when no trial specified', async () => {
      const slug = `active-${Date.now()}`;
      const subdomain = `act${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Active Test Tenant',
          contactEmail: 'active@test.com',
          subscriptionTier: 'PROFESSIONAL',
          databaseType: 'POSTGRESQL',
          trialDays: 0, // No trial
        })
        .expect(201);

      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.trialEndsAt).toBeNull();
    });
  });

  describe('Database Provisioning', () => {
    it('should provision PostgreSQL database automatically', async () => {
      const slug = `db-provision-${Date.now()}`;
      const subdomain = `dbprov${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'DB Provision Test',
          contactEmail: 'dbprovision@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(201);

      expect(response.body.databaseName).toContain(slug.replace(/-/g, '_'));
      expect(response.body.databaseUrl).toContain('postgresql://');
      expect(response.body.databaseUrl).toContain(response.body.databaseName);
    });

    it('should handle SQL Server database type (adapter pattern)', async () => {
      const slug = `db-sqlserver-${Date.now()}`;
      const subdomain = `dbsql${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'SQL Server Test',
          contactEmail: 'sqlserver-db@test.com',
          subscriptionTier: 'ENTERPRISE',
          databaseType: 'SQL_SERVER',
        })
        .expect(201);

      expect(response.body.databaseType).toBe('SQL_SERVER');
      // Note: SQL Server provisioning would be handled differently
    });

    it('should handle MySQL database type (adapter pattern)', async () => {
      const slug = `db-mysql-${Date.now()}`;
      const subdomain = `dbmysql${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'MySQL Test',
          contactEmail: 'mysql-db@test.com',
          subscriptionTier: 'ENTERPRISE',
          databaseType: 'MYSQL',
        })
        .expect(201);

      expect(response.body.databaseType).toBe('MYSQL');
    });
  });

  describe('Subscription Tier Limits', () => {
    it('should respect subscription tier limits for STARTER', async () => {
      const slug = `limits-starter-${Date.now()}`;
      const subdomain = `limstart${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Limits Test Starter',
          contactEmail: 'limits-starter@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(201);

      // STARTER tier defaults
      expect(response.body.maxWells).toBe(50);
      expect(response.body.maxUsers).toBe(5);
      expect(response.body.storageQuotaGb).toBe(10);
    });

    it('should allow custom limits within tier constraints', async () => {
      const slug = `limits-custom-${Date.now()}`;
      const subdomain = `limcust${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Limits Test Custom',
          contactEmail: 'limits-custom@test.com',
          subscriptionTier: 'PROFESSIONAL',
          databaseType: 'POSTGRESQL',
          maxWells: 150, // Custom within PROFESSIONAL limits
          maxUsers: 25,
          storageQuotaGb: 100,
        })
        .expect(201);

      expect(response.body.maxWells).toBe(150);
      expect(response.body.maxUsers).toBe(25);
      expect(response.body.storageQuotaGb).toBe(100);
    });
  });

  describe('Contact Information', () => {
    it('should store contact information correctly', async () => {
      const slug = `contact-${Date.now()}`;
      const subdomain = `cont${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Contact Test Tenant',
          contactEmail: 'contact@test.com',
          contactPhone: '+1-555-1234',
          billingEmail: 'billing@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(201);

      expect(response.body.contactEmail).toBe('contact@test.com');
      expect(response.body.contactPhone).toBe('+1-555-1234');
      expect(response.body.billingEmail).toBe('billing@test.com');
    });

    it('should allow omitting optional contact fields', async () => {
      const slug = `contact-minimal-${Date.now()}`;
      const subdomain = `contmin${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Contact Minimal Test',
          contactEmail: 'minimal-contact@test.com',
          // Omit contactPhone and billingEmail
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(201);

      expect(response.body.contactEmail).toBe('minimal-contact@test.com');
      expect(response.body.contactPhone).toBeUndefined();
      expect(response.body.billingEmail).toBeUndefined();
    });
  });

  describe('ETL Sync Configuration', () => {
    it('should handle ETL_SYNCED database type for external systems', async () => {
      const slug = `etl-sync-${Date.now()}`;
      const subdomain = `etl${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'ETL Sync Test',
          contactEmail: 'etl@test.com',
          subscriptionTier: 'ENTERPRISE_PLUS',
          databaseType: 'ETL_SYNCED',
        })
        .expect(201);

      expect(response.body.databaseType).toBe('ETL_SYNCED');
      // Note: ETL configuration would be set up separately
    });
  });

  describe('Tenant Metadata', () => {
    it('should include audit timestamps', async () => {
      const slug = `audit-${Date.now()}`;
      const subdomain = `aud${Date.now()}`;

      const response = await request(app.getHttpServer())
        .post('/api/tenants')
        .send({
          slug,
          subdomain,
          name: 'Audit Test Tenant',
          contactEmail: 'audit@test.com',
          subscriptionTier: 'STARTER',
          databaseType: 'POSTGRESQL',
        })
        .expect(201);

      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(response.body.updatedAt)).toBeInstanceOf(Date);
    });
  });
});
