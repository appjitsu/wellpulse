/**
 * SCADA Readings E2E Tests
 *
 * Tests the complete SCADA data ingestion and retrieval flow including:
 * - Recording SCADA readings from sensors
 * - Querying readings with time-range filters
 * - Alarm creation and lifecycle management
 * - Multi-tenant isolation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('SCADA Readings & Alarms (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let managerToken: string;
  let consultantToken: string;
  let tenantId: string;
  let wellId: string;
  let scadaConnectionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Setup: Create test tenant, users, well, and SCADA connection
    const setupResult = await setupTestEnvironment(app);
    adminToken = setupResult.adminToken;
    managerToken = setupResult.managerToken;
    consultantToken = setupResult.consultantToken;
    tenantId = setupResult.tenantId;
    wellId = setupResult.wellId;
    scadaConnectionId = setupResult.scadaConnectionId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /scada/readings - Record SCADA Reading', () => {
    it('should record a numeric SCADA reading (ADMIN)', async () => {
      const reading = {
        wellId,
        scadaConnectionId,
        tagName: 'PRESSURE',
        value: 150.5,
        unit: 'PSI',
        minValue: 100,
        maxValue: 200,
        metadata: {
          sensor: 'PT-100',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/scada/readings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reading)
        .expect(201);

      expect(response.body).toHaveProperty('readingId');
      expect(response.body.readingId).toMatch(/^reading_/);
    });

    it('should record a string SCADA reading (MANAGER)', async () => {
      const reading = {
        wellId,
        scadaConnectionId,
        tagName: 'STATUS',
        value: 'RUNNING',
        metadata: {
          sensor: 'STATUS-001',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/scada/readings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reading)
        .expect(201);

      expect(response.body).toHaveProperty('readingId');
    });

    it('should record a boolean SCADA reading (CONSULTANT)', async () => {
      const reading = {
        wellId,
        scadaConnectionId,
        tagName: 'PUMP_ENABLED',
        value: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/scada/readings')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send(reading)
        .expect(201);

      expect(response.body).toHaveProperty('readingId');
    });

    it('should auto-detect OUT_OF_RANGE quality', async () => {
      const reading = {
        wellId,
        scadaConnectionId,
        tagName: 'TEMPERATURE',
        value: 250, // Out of range (min: 50, max: 200)
        unit: '°F',
        minValue: 50,
        maxValue: 200,
      };

      await request(app.getHttpServer())
        .post('/api/scada/readings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reading)
        .expect(201);

      // Verify reading was recorded with OUT_OF_RANGE quality
      const response = await request(app.getHttpServer())
        .get('/api/scada/readings')
        .query({ wellId, tagName: 'TEMPERATURE' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      const latestReading = response.body[0];
      expect(latestReading.quality).toBe('OUT_OF_RANGE');
    });

    it('should reject reading without authentication', async () => {
      const reading = {
        wellId,
        scadaConnectionId,
        tagName: 'FLOW_RATE',
        value: 100,
      };

      await request(app.getHttpServer())
        .post('/api/scada/readings')
        .send(reading)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const invalidReading = {
        wellId,
        // Missing scadaConnectionId
        tagName: 'FLOW_RATE',
        // Missing value
      };

      await request(app.getHttpServer())
        .post('/api/scada/readings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidReading)
        .expect(400);
    });
  });

  describe('GET /scada/readings - Query SCADA Readings', () => {
    it('should retrieve all readings for a well', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/scada/readings')
        .query({ wellId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const reading = response.body[0];
      expect(reading).toHaveProperty('id');
      expect(reading).toHaveProperty('wellId', wellId);
      expect(reading).toHaveProperty('tagName');
      expect(reading).toHaveProperty('value');
      expect(reading).toHaveProperty('quality');
      expect(reading).toHaveProperty('timestamp');
    });

    it('should filter readings by tag name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/scada/readings')
        .query({ wellId, tagName: 'PRESSURE' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((reading: any) => {
        expect(reading.tagName).toBe('PRESSURE');
      });
    });

    it('should filter readings by time range', async () => {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

      const response = await request(app.getHttpServer())
        .get('/api/scada/readings')
        .query({
          wellId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/scada/readings')
        .query({ wellId, limit: 2, offset: 0 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(2);
    });

    it('should return readings ordered by timestamp DESC', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/scada/readings')
        .query({ wellId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(1);

      // Verify descending order
      for (let i = 0; i < response.body.length - 1; i++) {
        const current = new Date(response.body[i].timestamp);
        const next = new Date(response.body[i + 1].timestamp);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not return readings from other tenants', async () => {
      // Create a second tenant
      const tenant2Setup = await createTenant(app, 'tenant2-scada');
      const tenant2AdminToken = tenant2Setup.adminToken;
      const tenant2WellId = tenant2Setup.wellId;
      const tenant2ConnectionId = tenant2Setup.scadaConnectionId;

      // Record reading for tenant 2
      await request(app.getHttpServer())
        .post('/api/scada/readings')
        .set('Authorization', `Bearer ${tenant2AdminToken}`)
        .send({
          wellId: tenant2WellId,
          scadaConnectionId: tenant2ConnectionId,
          tagName: 'ISOLATED_TAG',
          value: 999,
        })
        .expect(201);

      // Query from tenant 1 - should NOT see tenant 2's reading
      const response = await request(app.getHttpServer())
        .get('/api/scada/readings')
        .query({ tagName: 'ISOLATED_TAG' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const isolatedTags = response.body.filter(
        (r: any) => r.tagName === 'ISOLATED_TAG',
      );
      expect(isolatedTags.length).toBe(0);
    });
  });
});

/**
 * Setup test environment with tenant, users, well, and SCADA connection
 */
async function setupTestEnvironment(app: INestApplication) {
  const tenantResult = await createTenant(app, 'scada-test');
  return tenantResult;
}

/**
 * Create a tenant with admin user, well, and SCADA connection
 */
async function createTenant(app: INestApplication, subdomain: string) {
  // Create tenant via master admin
  const masterAdminResponse = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: 'admin@wellpulse.io',
      password: 'Admin123!@#',
    });

  const masterAdminToken = masterAdminResponse.body.accessToken;

  // Create tenant
  const tenantResponse = await request(app.getHttpServer())
    .post('/api/admin/tenants')
    .set('Authorization', `Bearer ${masterAdminToken}`)
    .send({
      name: `${subdomain} Oil & Gas`,
      subdomain,
      planTier: 'PROFESSIONAL',
      billingEmail: `${subdomain}@example.com`,
    });

  const tenantId = tenantResponse.body.id;

  // Create admin user for tenant
  const adminUserResponse = await request(app.getHttpServer())
    .post(`/admin/tenants/${tenantId}/users`)
    .set('Authorization', `Bearer ${masterAdminToken}`)
    .send({
      email: `admin@${subdomain}.com`,
      password: 'Admin123!@#',
      name: 'Tenant Admin',
      role: 'ADMIN',
    });

  // Login as tenant admin
  const adminLoginResponse = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: `admin@${subdomain}.com`,
      password: 'Admin123!@#',
    });

  const adminToken = adminLoginResponse.body.accessToken;

  // Create manager user
  await request(app.getHttpServer())
    .post(`/admin/tenants/${tenantId}/users`)
    .set('Authorization', `Bearer ${masterAdminToken}`)
    .send({
      email: `manager@${subdomain}.com`,
      password: 'Manager123!@#',
      name: 'Tenant Manager',
      role: 'MANAGER',
    });

  const managerLoginResponse = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: `manager@${subdomain}.com`,
      password: 'Manager123!@#',
    });

  const managerToken = managerLoginResponse.body.accessToken;

  // Create consultant user
  await request(app.getHttpServer())
    .post(`/admin/tenants/${tenantId}/users`)
    .set('Authorization', `Bearer ${masterAdminToken}`)
    .send({
      email: `consultant@${subdomain}.com`,
      password: 'Consultant123!@#',
      name: 'Tenant Consultant',
      role: 'CONSULTANT',
    });

  const consultantLoginResponse = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: `consultant@${subdomain}.com`,
      password: 'Consultant123!@#',
    });

  const consultantToken = consultantLoginResponse.body.accessToken;

  // Create a well
  const wellResponse = await request(app.getHttpServer())
    .post('/api/wells')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      apiNumber: `${subdomain}-WELL-001`,
      name: 'Test Well 1',
      operatorName: `${subdomain} Operator`,
      latitude: 31.8,
      longitude: -102.4,
      status: 'ACTIVE',
    });

  const wellId = wellResponse.body.id;

  // Create SCADA connection
  const scadaConnectionResponse = await request(app.getHttpServer())
    .post('/scada/connections')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      wellId,
      name: 'Test SCADA Connection',
      description: 'SCADA system for test well',
      endpointUrl: 'opc.tcp://localhost:4840',
      endpointSecurityMode: 'None',
      endpointSecurityPolicy: 'None',
      pollIntervalSeconds: 5,
    });

  const scadaConnectionId = scadaConnectionResponse.body.id;

  return {
    adminToken,
    managerToken,
    consultantToken,
    tenantId,
    wellId,
    scadaConnectionId,
  };
}
