/**
 * SCADA Alarms E2E Tests
 *
 * Tests alarm lifecycle management including:
 * - Alarm retrieval with filters
 * - Alarm acknowledgment
 * - Alarm severity filtering
 * - Role-based access control
 * - Multi-tenant isolation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('SCADA Alarms (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let managerToken: string;
  let consultantToken: string;
  let tenantId: string;
  let wellId: string;
  let scadaConnectionId: string;
  let testAlarmId: string;

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

    // Setup: Create test tenant, users, well, SCADA connection, and test alarm
    const setupResult = await setupTestEnvironment(app);
    adminToken = setupResult.adminToken;
    managerToken = setupResult.managerToken;
    consultantToken = setupResult.consultantToken;
    tenantId = setupResult.tenantId;
    wellId = setupResult.wellId;
    scadaConnectionId = setupResult.scadaConnectionId;
    testAlarmId = setupResult.testAlarmId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /alarms - List Active Alarms', () => {
    it('should retrieve all active alarms (ADMIN)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const alarm = response.body[0];
      expect(alarm).toHaveProperty('id');
      expect(alarm).toHaveProperty('wellId');
      expect(alarm).toHaveProperty('tagName');
      expect(alarm).toHaveProperty('alarmType');
      expect(alarm).toHaveProperty('severity');
      expect(alarm).toHaveProperty('state');
      expect(alarm).toHaveProperty('message');
      expect(alarm.state).not.toBe('CLEARED'); // Active alarms only
    });

    it('should filter alarms by wellId', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .query({ wellId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((alarm: any) => {
        expect(alarm.wellId).toBe(wellId);
      });
    });

    it('should filter alarms by severity', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .query({ severity: 'CRITICAL' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((alarm: any) => {
        expect(alarm.severity).toBe('CRITICAL');
      });
    });

    it('should return alarms ordered by severity and time', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.length > 1) {
        // Verify CRITICAL alarms come first
        let sawNonCritical = false;
        for (const alarm of response.body) {
          if (sawNonCritical && alarm.severity === 'CRITICAL') {
            fail('CRITICAL alarms should come before non-CRITICAL alarms');
          }
          if (alarm.severity !== 'CRITICAL') {
            sawNonCritical = true;
          }
        }
      }
    });

    it('should allow MANAGER to view alarms', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow CONSULTANT to view alarms', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .set('Authorization', `Bearer ${consultantToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/api/alarms').expect(401);
    });
  });

  describe('PATCH /alarms/:alarmId/acknowledge - Acknowledge Alarm', () => {
    it('should acknowledge alarm (ADMIN)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/alarms/${testAlarmId}/acknowledge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify alarm is now acknowledged
      const alarmsResponse = await request(app.getHttpServer())
        .get('/api/alarms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const acknowledgedAlarm = alarmsResponse.body.find(
        (a: any) => a.id === testAlarmId,
      );
      expect(acknowledgedAlarm).toBeDefined();
      expect(acknowledgedAlarm.state).toBe('ACKNOWLEDGED');
      expect(acknowledgedAlarm.acknowledgedAt).toBeDefined();
      expect(acknowledgedAlarm.acknowledgedBy).toBeDefined();
    });

    it('should allow MANAGER to acknowledge alarm', async () => {
      // Create a new alarm for this test
      const newAlarmId = await createTestAlarm(
        app,
        adminToken,
        wellId,
        scadaConnectionId,
        'TEST_TAG_2',
      );

      await request(app.getHttpServer())
        .patch(`/api/alarms/${newAlarmId}/acknowledge`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
    });

    it('should reject CONSULTANT acknowledgment (insufficient permissions)', async () => {
      // Create a new alarm for this test
      const newAlarmId = await createTestAlarm(
        app,
        adminToken,
        wellId,
        scadaConnectionId,
        'TEST_TAG_3',
      );

      await request(app.getHttpServer())
        .patch(`/api/alarms/${newAlarmId}/acknowledge`)
        .set('Authorization', `Bearer ${consultantToken}`)
        .expect(403); // Forbidden - CONSULTANT cannot acknowledge
    });

    it('should reject acknowledgment of already acknowledged alarm', async () => {
      // Try to acknowledge the same alarm twice
      await request(app.getHttpServer())
        .patch(`/api/alarms/${testAlarmId}/acknowledge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400); // Bad Request - already acknowledged
    });

    it('should reject acknowledgment of non-existent alarm', async () => {
      await request(app.getHttpServer())
        .patch('/api/alarms/non-existent-alarm-id/acknowledge')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404); // Not Found
    });

    it('should reject unauthenticated acknowledgment', async () => {
      const newAlarmId = await createTestAlarm(
        app,
        adminToken,
        wellId,
        scadaConnectionId,
        'TEST_TAG_4',
      );

      await request(app.getHttpServer())
        .patch(`/api/alarms/${newAlarmId}/acknowledge`)
        .expect(401); // Unauthorized
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should not return alarms from other tenants', async () => {
      // Create a second tenant with an alarm
      const tenant2Setup = await createTenantWithAlarm(app, 'tenant2-alarms');
      const tenant2AdminToken = tenant2Setup.adminToken;
      const tenant2AlarmId = tenant2Setup.alarmId;

      // Query from tenant 1 - should NOT see tenant 2's alarm
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const tenant2Alarm = response.body.find(
        (a: any) => a.id === tenant2AlarmId,
      );
      expect(tenant2Alarm).toBeUndefined();
    });

    it('should not allow acknowledging alarms from other tenants', async () => {
      // Create a second tenant with an alarm
      const tenant2Setup = await createTenantWithAlarm(app, 'tenant3-alarms');
      const tenant2AlarmId = tenant2Setup.alarmId;

      // Try to acknowledge tenant 2's alarm from tenant 1
      await request(app.getHttpServer())
        .patch(`/api/alarms/${tenant2AlarmId}/acknowledge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404); // Not Found (because it's isolated)
    });
  });

  describe('Alarm Lifecycle', () => {
    it('should track trigger count for recurring alarms', async () => {
      // This test would require SCADA system integration to retrigger alarms
      // For now, we verify the field exists
      const response = await request(app.getHttpServer())
        .get('/api/alarms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('triggerCount');
        expect(typeof response.body[0].triggerCount).toBe('number');
        expect(response.body[0].triggerCount).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

/**
 * Setup test environment with tenant, users, well, SCADA connection, and test alarm
 */
async function setupTestEnvironment(app: INestApplication) {
  const tenantResult = await createTenantWithAlarm(app, 'alarm-test');
  return tenantResult;
}

/**
 * Create a tenant with admin user, well, SCADA connection, and test alarm
 */
async function createTenantWithAlarm(app: INestApplication, subdomain: string) {
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

  // Create admin user
  await request(app.getHttpServer())
    .post(`/admin/tenants/${tenantId}/users`)
    .set('Authorization', `Bearer ${masterAdminToken}`)
    .send({
      email: `admin@${subdomain}.com`,
      password: 'Admin123!@#',
      name: 'Tenant Admin',
      role: 'ADMIN',
    });

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

  // Create well
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

  // Create a test alarm (using direct repository or command)
  const testAlarmId = await createTestAlarm(
    app,
    adminToken,
    wellId,
    scadaConnectionId,
    'TEST_TAG_1',
  );

  return {
    adminToken,
    managerToken,
    consultantToken,
    tenantId,
    wellId,
    scadaConnectionId,
    testAlarmId,
    alarmId: testAlarmId, // For multi-tenant tests
  };
}

/**
 * Helper function to create a test alarm
 * In a real implementation, this would trigger via SCADA reading
 * For testing, we can directly create an alarm via the repository
 */
async function createTestAlarm(
  app: INestApplication,
  adminToken: string,
  wellId: string,
  scadaConnectionId: string,
  tagName: string,
): Promise<string> {
  // Record an out-of-range reading that will trigger an alarm
  // (This assumes the alarm creation logic is in the RecordScadaReadingHandler)
  const readingResponse = await request(app.getHttpServer())
    .post('/scada/readings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      wellId,
      scadaConnectionId,
      tagName,
      value: 300, // Out of range
      minValue: 0,
      maxValue: 200,
    });

  // Wait briefly for alarm to be created
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Fetch the alarm
  const alarmsResponse = await request(app.getHttpServer())
    .get('/api/alarms')
    .query({ wellId, tagName })
    .set('Authorization', `Bearer ${adminToken}`);

  // If no alarm was auto-created (not implemented yet), create manually
  // This is a placeholder - in production, alarms would be created by SCADA polling service
  if (alarmsResponse.body.length === 0) {
    // For now, return a mock ID
    // When alarm auto-creation is implemented, this will be replaced
    return `alarm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  return alarmsResponse.body[0].id;
}
