/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Dashboard E2E Tests
 *
 * Tests the dashboard analytics endpoints:
 * - GET /api/dashboard/metrics
 * - GET /api/dashboard/well-status
 * - GET /api/dashboard/recent-activity
 * - GET /api/dashboard/top-producers
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { provisionTestTenant } from '../helpers/provision-test-tenant';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let createdWellId: string;

  beforeAll(async () => {
    // Provision test tenant database
    await provisionTestTenant({
      subdomain: 'dashboardtest',
      slug: 'dashboardtest',
    });

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

    // Setup test user and test data
    await setupTestUserAndData();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  /**
   * Helper function to create test user and sample data
   */
  async function setupTestUserAndData() {
    const timestamp = Date.now();

    // Register and login admin user
    const email = `admin-${timestamp}@dashboard.test`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('X-Tenant-Subdomain', 'dashboardtest')
      .send({
        email,
        password: 'AdminPass123!@#',
        name: 'Dashboard Admin',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Tenant-Subdomain', 'dashboardtest')
      .send({
        email,
        password: 'AdminPass123!@#',
      })
      .expect(200);

    accessToken = loginResponse.body.accessToken;

    // Create sample wells for testing
    const wellsToCreate = [
      {
        apiNumber: `42-123-${timestamp}-001`,
        name: 'Dashboard Test Well 1',
        status: 'ACTIVE',
        latitude: 31.7619,
        longitude: -106.485,
      },
      {
        apiNumber: `42-123-${timestamp}-002`,
        name: 'Dashboard Test Well 2',
        status: 'ACTIVE',
        latitude: 31.8,
        longitude: -106.5,
      },
      {
        apiNumber: `42-123-${timestamp}-003`,
        name: 'Dashboard Test Well 3',
        status: 'INACTIVE',
        latitude: 31.85,
        longitude: -106.55,
      },
    ];

    for (const well of wellsToCreate) {
      const response = await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(well)
        .expect(201);

      if (!createdWellId) {
        createdWellId = response.body.id;
      }

      // Create sample field entries for production data
      if (well.status === 'ACTIVE') {
        await request(app.getHttpServer())
          .post('/api/field-data')
          .set('X-Tenant-Subdomain', 'dashboardtest')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            wellId: response.body.id,
            entryType: 'PRODUCTION',
            productionData: {
              oilVolume: 100 + Math.floor(Math.random() * 50),
              gasVolume: 200,
              waterVolume: 50,
              runHours: 24,
              casingPressure: 500,
              tubingPressure: 450,
              chokeSize: 32,
            },
            recordedAt: new Date().toISOString(),
            deviceId: 'test-device-001',
          })
          .expect(201);
      }
    }
  }

  describe('GET /api/dashboard/metrics', () => {
    it('should return dashboard metrics successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/metrics')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('totalWells');
      expect(response.body).toHaveProperty('dailyProduction');
      expect(response.body).toHaveProperty('activeAlerts');
      expect(response.body).toHaveProperty('monthlyRevenue');

      // Verify totalWells metric structure
      expect(response.body.totalWells).toHaveProperty('value');
      expect(response.body.totalWells).toHaveProperty('change');
      expect(response.body.totalWells).toHaveProperty('trend');
      expect(response.body.totalWells.value).toBeGreaterThan(0);

      // Verify dailyProduction metric structure
      expect(response.body.dailyProduction).toHaveProperty('value');
      expect(response.body.dailyProduction).toHaveProperty('unit');
      expect(response.body.dailyProduction.unit).toBe('bbl');
      expect(response.body.dailyProduction).toHaveProperty('change');
      expect(response.body.dailyProduction).toHaveProperty('trend');

      // Verify activeAlerts metric structure
      expect(response.body.activeAlerts).toHaveProperty('value');
      expect(response.body.activeAlerts).toHaveProperty('change');
      expect(response.body.activeAlerts).toHaveProperty('trend');

      // Verify monthlyRevenue metric structure
      expect(response.body.monthlyRevenue).toHaveProperty('value');
      expect(response.body.monthlyRevenue).toHaveProperty('change');
      expect(response.body.monthlyRevenue).toHaveProperty('trend');
    });

    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/metrics')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .expect(401);
    });

    it('should reject missing tenant context', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /api/dashboard/well-status', () => {
    it('should return well status distribution successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/well-status')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('statusDistribution');
      expect(response.body).toHaveProperty('totalWells');
      expect(Array.isArray(response.body.statusDistribution)).toBe(true);
      expect(response.body.totalWells).toBeGreaterThan(0);

      // Verify status items structure
      if (response.body.statusDistribution.length > 0) {
        const statusItem = response.body.statusDistribution[0];
        expect(statusItem).toHaveProperty('status');
        expect(statusItem).toHaveProperty('count');
        expect(statusItem).toHaveProperty('percentage');
        expect(statusItem.count).toBeGreaterThan(0);
        expect(statusItem.percentage).toBeGreaterThan(0);
      }

      // Verify we have ACTIVE wells (we created them)

      const activeStatus = response.body.statusDistribution.find(
        (s: { status: string; count: number }) => s.status === 'ACTIVE',
      );
      expect(activeStatus).toBeDefined();
      expect(activeStatus?.count).toBeGreaterThan(0);
    });

    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/well-status')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .expect(401);
    });
  });

  describe('GET /api/dashboard/recent-activity', () => {
    it('should return recent activity successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/recent-activity')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('activities');
      expect(Array.isArray(response.body.activities)).toBe(true);

      // Verify activity items structure
      if (response.body.activities.length > 0) {
        const activity = response.body.activities[0];
        expect(activity).toHaveProperty('id');
        expect(activity).toHaveProperty('wellName');
        expect(activity).toHaveProperty('wellId');
        expect(activity).toHaveProperty('event');
        expect(activity).toHaveProperty('eventType');
        expect(activity).toHaveProperty('severity');
        expect(activity).toHaveProperty('timestamp');
        expect(activity).toHaveProperty('timeAgo');

        // Verify eventType is valid
        expect([
          'PRODUCTION',
          'INSPECTION',
          'MAINTENANCE',
          'ANOMALY',
        ]).toContain(activity.eventType);

        // Verify severity is valid
        expect(['success', 'warning', 'info']).toContain(activity.severity);
      }

      // Should not return more than 10 activities
      expect(response.body.activities.length).toBeLessThanOrEqual(10);
    });

    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/recent-activity')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .expect(401);
    });
  });

  describe('GET /api/dashboard/top-producers', () => {
    it('should return top producers successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/top-producers')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('topProducers');
      expect(Array.isArray(response.body.topProducers)).toBe(true);

      // Verify top producer items structure
      if (response.body.topProducers.length > 0) {
        const producer = response.body.topProducers[0];
        expect(producer).toHaveProperty('wellId');
        expect(producer).toHaveProperty('wellName');
        expect(producer).toHaveProperty('avgDailyProduction');
        expect(producer).toHaveProperty('trendPercentage');
        expect(producer).toHaveProperty('trend');

        // Verify production is positive
        expect(producer.avgDailyProduction).toBeGreaterThan(0);

        // Verify trend is valid
        expect(['up', 'down', 'neutral']).toContain(producer.trend);
      }

      // Should not return more than 5 producers
      expect(response.body.topProducers.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array when no production data exists', async () => {
      // This will be tested with a fresh tenant that has no production
      const timestamp = Date.now();
      const email = `noprod-${timestamp}@dashboard.test`;

      // Provision new tenant
      await provisionTestTenant({
        subdomain: 'noproduction',
        slug: 'noproduction',
      });

      // Register and login
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('X-Tenant-Subdomain', 'noproduction')
        .send({
          email,
          password: 'NoProduction123!@#',
          name: 'No Production User',
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'noproduction')
        .send({
          email,
          password: 'NoProduction123!@#',
        })
        .expect(200);

      const token = loginResponse.body.accessToken;

      const response = await request(app.getHttpServer())
        .get('/api/dashboard/top-producers')
        .set('X-Tenant-Subdomain', 'noproduction')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.topProducers).toEqual([]);
    });

    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/top-producers')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .expect(401);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    let tenant2AccessToken: string;

    beforeAll(async () => {
      // Provision second tenant
      await provisionTestTenant({
        subdomain: 'dashboard2',
        slug: 'dashboard2',
      });

      // Create admin user in tenant2
      const timestamp = Date.now();
      const email = `tenant2-${timestamp}@dashboard.test`;

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('X-Tenant-Subdomain', 'dashboard2')
        .send({
          email,
          password: 'Tenant2Pass123!@#',
          name: 'Tenant 2 Admin',
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'dashboard2')
        .send({
          email,
          password: 'Tenant2Pass123!@#',
        })
        .expect(200);

      tenant2AccessToken = loginResponse.body.accessToken;
    });

    it('should return different metrics for different tenants', async () => {
      // Get metrics for tenant1
      const tenant1Response = await request(app.getHttpServer())
        .get('/api/dashboard/metrics')
        .set('X-Tenant-Subdomain', 'dashboardtest')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Get metrics for tenant2 (no data)
      const tenant2Response = await request(app.getHttpServer())
        .get('/api/dashboard/metrics')
        .set('X-Tenant-Subdomain', 'dashboard2')
        .set('Authorization', `Bearer ${tenant2AccessToken}`)
        .expect(200);

      // Tenant1 should have wells, tenant2 should not
      expect(tenant1Response.body.totalWells.value).toBeGreaterThan(0);
      expect(tenant2Response.body.totalWells.value).toBe(0);
    });

    it('should not show tenant1 wells in tenant2 status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/well-status')
        .set('X-Tenant-Subdomain', 'dashboard2')
        .set('Authorization', `Bearer ${tenant2AccessToken}`)
        .expect(200);

      expect(response.body.totalWells).toBe(0);
      expect(response.body.statusDistribution).toEqual([]);
    });
  });
});
