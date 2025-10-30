/**
 * Wells E2E Tests
 *
 * Tests the complete wells management flow:
 * - CRUD operations (Create, Read, Update, Delete)
 * - API number uniqueness validation
 * - Location validation and distance calculations
 * - Well status lifecycle (ACTIVE → INACTIVE → PLUGGED)
 * - RBAC enforcement (Admin/Manager can create, Operator cannot)
 * - Multi-tenant isolation
 * - Pagination and filtering
 * - Soft delete behavior
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { provisionTestTenant } from '../helpers/provision-test-tenant';

describe('Wells (e2e)', () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let managerAccessToken: string;
  let operatorAccessToken: string;
  let createdWellId: string;
  let testApiNumber: string;

  beforeAll(async () => {
    // Provision test tenant databases
    await provisionTestTenant({ subdomain: 'wellstest', slug: 'wellstest' });
    await provisionTestTenant({ subdomain: 'tenant2', slug: 'tenant2' });

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

    // Generate unique API number for testing
    const timestamp = Date.now().toString().slice(-5);
    testApiNumber = `42-123-${timestamp}`; // Texas RRC format

    // Register and authenticate users with different roles
    await setupTestUsers();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  /**
   * Helper function to create test users with different roles
   */
  async function setupTestUsers() {
    const timestamp = Date.now();

    // Register admin (first user is auto-admin)
    const adminEmail = `admin-${timestamp}@wells.test`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('X-Tenant-Subdomain', 'wellstest')
      .send({
        email: adminEmail,
        password: 'AdminPass123!@#',
        name: 'Admin User',
      })
      .expect(201);

    // Login as admin
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Tenant-Subdomain', 'wellstest')
      .send({
        email: adminEmail,
        password: 'AdminPass123!@#',
      })
      .expect(200);

    adminAccessToken = adminLoginResponse.body.accessToken;

    // Register manager (requires admin to set role)
    const managerEmail = `manager-${timestamp}@wells.test`;
    const managerRegResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('X-Tenant-Subdomain', 'wellstest')
      .send({
        email: managerEmail,
        password: 'ManagerPass123!@#',
        name: 'Manager User',
      })
      .expect(201);

    const managerId = managerRegResponse.body.userId;

    // Admin sets manager role
    await request(app.getHttpServer())
      .patch(`/api/users/${managerId}/role`)
      .set('X-Tenant-Subdomain', 'wellstest')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ role: 'MANAGER' })
      .expect(200);

    // Login as manager
    const managerLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Tenant-Subdomain', 'wellstest')
      .send({
        email: managerEmail,
        password: 'ManagerPass123!@#',
      })
      .expect(200);

    managerAccessToken = managerLoginResponse.body.accessToken;

    // Register operator
    const operatorEmail = `operator-${timestamp}@wells.test`;
    const operatorRegResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set('X-Tenant-Subdomain', 'wellstest')
      .send({
        email: operatorEmail,
        password: 'OperatorPass123!@#',
        name: 'Operator User',
      })
      .expect(201);

    const operatorId = operatorRegResponse.body.userId;

    // Admin sets operator role
    await request(app.getHttpServer())
      .patch(`/api/users/${operatorId}/role`)
      .set('X-Tenant-Subdomain', 'wellstest')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ role: 'OPERATOR' })
      .expect(200);

    // Login as operator
    const operatorLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Tenant-Subdomain', 'wellstest')
      .send({
        email: operatorEmail,
        password: 'OperatorPass123!@#',
      })
      .expect(200);

    operatorAccessToken = operatorLoginResponse.body.accessToken;
  }

  describe('Create Well', () => {
    it('should create a new well successfully (Admin)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber: testApiNumber,
          name: 'Test Well Alpha',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Test Lease 1',
          field: 'Permian Basin',
          operator: 'Test Operator LLC',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.apiNumber).toBe(testApiNumber);
      expect(response.body.name).toBe('Test Well Alpha');
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.latitude).toBe(31.7619);
      expect(response.body.longitude).toBe(-106.485);

      // Save well ID for subsequent tests
      createdWellId = response.body.id;
    });

    it('should create a new well successfully (Manager)', async () => {
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;

      const response = await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${managerAccessToken}`)
        .send({
          apiNumber,
          name: 'Test Well Beta',
          status: 'ACTIVE',
          latitude: 31.8,
          longitude: -106.5,
          lease: 'Test Lease 2',
          field: 'Permian Basin',
          operator: 'Test Operator LLC',
        })
        .expect(201);

      expect(response.body.apiNumber).toBe(apiNumber);
    });

    it('should reject well creation by Operator (RBAC)', async () => {
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;

      await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${operatorAccessToken}`)
        .send({
          apiNumber,
          name: 'Unauthorized Well',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Test Lease',
          field: 'Permian Basin',
          operator: 'Test Operator LLC',
        })
        .expect(403); // Forbidden
    });

    it('should reject duplicate API number', async () => {
      await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber: testApiNumber, // Duplicate
          name: 'Duplicate Well',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Test Lease',
          field: 'Permian Basin',
          operator: 'Test Operator LLC',
        })
        .expect(409); // Conflict
    });

    it('should validate API number format (Texas RRC)', async () => {
      await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber: 'INVALID-FORMAT', // Wrong format
          name: 'Invalid API Well',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Test Lease',
          field: 'Permian Basin',
          operator: 'Test Operator LLC',
        })
        .expect(400); // Bad Request
    });

    it('should validate latitude range (-90 to 90)', async () => {
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;

      await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber,
          name: 'Invalid Latitude Well',
          status: 'ACTIVE',
          latitude: 95.0, // Invalid (> 90)
          longitude: -106.485,
          lease: 'Test Lease',
          field: 'Permian Basin',
          operator: 'Test Operator LLC',
        })
        .expect(400);
    });

    it('should validate longitude range (-180 to 180)', async () => {
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;

      await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber,
          name: 'Invalid Longitude Well',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -200.0, // Invalid (< -180)
          lease: 'Test Lease',
          field: 'Permian Basin',
          operator: 'Test Operator LLC',
        })
        .expect(400);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          // Missing apiNumber
          name: 'Incomplete Well',
          status: 'ACTIVE',
        })
        .expect(400);
    });
  });

  describe('Get Wells (List)', () => {
    it('should get all wells (Admin)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('wells');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.wells)).toBe(true);
      expect(response.body.wells.length).toBeGreaterThan(0);
    });

    it('should get all wells (Operator can read)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${operatorAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('wells');
      expect(response.body).toHaveProperty('total');
    });

    it('should filter wells by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells?status=ACTIVE')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(
        response.body.wells.every(
          (well: { status: string }) => well.status === 'ACTIVE',
        ),
      ).toBe(true);
    });

    it('should filter wells by operator', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells?operator=Test Operator LLC')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(
        response.body.wells.every(
          (well: { operator: string }) => well.operator === 'Test Operator LLC',
        ),
      ).toBe(true);
    });

    it('should paginate wells (limit)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells?limit=1')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.wells.length).toBeLessThanOrEqual(1);
    });

    it('should paginate wells (offset)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells?offset=1')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('wells');
    });

    it('should search wells by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells?search=Alpha')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(
        response.body.wells.some((well: { name: string }) =>
          well.name.includes('Alpha'),
        ),
      ).toBe(true);
    });

    it('should reject unauthenticated access', async () => {
      await request(app.getHttpServer())
        .get('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .expect(401);
    });
  });

  describe('Get Well by ID', () => {
    it('should get well by ID successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/wells/${createdWellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdWellId);
      expect(response.body.apiNumber).toBe(testApiNumber);
      expect(response.body.name).toBe('Test Well Alpha');
    });

    it('should return 404 for non-existent well', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/wells/${fakeId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it('should validate UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/wells/invalid-uuid')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(400);
    });
  });

  describe('Get Well by API Number', () => {
    it('should get well by API number successfully', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/wells/api-number/${testApiNumber}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.apiNumber).toBe(testApiNumber);
      expect(response.body.id).toBe(createdWellId);
    });

    it('should return 404 for non-existent API number', async () => {
      await request(app.getHttpServer())
        .get('/api/wells/api-number/99-999-99999')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });
  });

  describe('Update Well', () => {
    it('should update well successfully (Admin)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/wells/${createdWellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Updated Test Well Alpha',
          operator: 'Updated Operator LLC',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Test Well Alpha');
      expect(response.body.operator).toBe('Updated Operator LLC');
      expect(response.body.apiNumber).toBe(testApiNumber); // Unchanged
    });

    it('should update well successfully (Manager)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/wells/${createdWellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${managerAccessToken}`)
        .send({
          lease: 'Updated Lease Name',
        })
        .expect(200);

      expect(response.body.lease).toBe('Updated Lease Name');
    });

    it('should reject well update by Operator (RBAC)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/wells/${createdWellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${operatorAccessToken}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(403);
    });

    it('should validate location on update', async () => {
      await request(app.getHttpServer())
        .patch(`/api/wells/${createdWellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          latitude: 200.0, // Invalid
        })
        .expect(400);
    });

    it('should return 404 when updating non-existent well', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .patch(`/api/wells/${fakeId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: 'Does Not Exist',
        })
        .expect(404);
    });
  });

  describe('Well Status Lifecycle', () => {
    let lifecycleWellId: string;

    beforeAll(async () => {
      // Create a well for lifecycle testing
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;
      const response = await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber,
          name: 'Lifecycle Test Well',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Lifecycle Lease',
          field: 'Permian Basin',
          operator: 'Lifecycle Operator',
        })
        .expect(201);

      lifecycleWellId = response.body.id;
    });

    it('should deactivate an active well', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/wells/${lifecycleWellId}/deactivate`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('INACTIVE');
    });

    it('should reactivate an inactive well', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/wells/${lifecycleWellId}/activate`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('ACTIVE');
    });

    it('should mark well as plugged (terminal state)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/wells/${lifecycleWellId}/plug`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.status).toBe('PLUGGED');
    });

    it('should reject activation of plugged well (terminal state)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/wells/${lifecycleWellId}/activate`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(400); // Business rule violation
    });
  });

  describe('Delete Well (Soft Delete)', () => {
    let deleteTestWellId: string;

    beforeAll(async () => {
      // Create a well for deletion testing
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;
      const response = await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber,
          name: 'Delete Test Well',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Delete Lease',
          field: 'Permian Basin',
          operator: 'Delete Operator',
        })
        .expect(201);

      deleteTestWellId = response.body.id;
    });

    it('should soft delete well successfully (Admin)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/wells/${deleteTestWellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.message).toContain('deleted successfully');
    });

    it('should not return soft-deleted well in list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      const deletedWell = response.body.wells.find(
        (well: { id: string }) => well.id === deleteTestWellId,
      );
      expect(deletedWell).toBeUndefined();
    });

    it('should return 404 when accessing soft-deleted well', async () => {
      await request(app.getHttpServer())
        .get(`/api/wells/${deleteTestWellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it('should reject well deletion by Operator (RBAC)', async () => {
      // Create another well for operator delete test
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;
      const createResponse = await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber,
          name: 'Operator Delete Test',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Test Lease',
          field: 'Permian Basin',
          operator: 'Test Operator',
        })
        .expect(201);

      const wellId = createResponse.body.id;

      // Operator tries to delete
      await request(app.getHttpServer())
        .delete(`/api/wells/${wellId}`)
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${operatorAccessToken}`)
        .expect(403);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    let tenant1WellId: string;
    let tenant2AccessToken: string;

    beforeAll(async () => {
      // Create well in tenant1 (wellstest)
      const apiNumber = `42-123-${Date.now().toString().slice(-5)}`;
      const response = await request(app.getHttpServer())
        .post('/api/wells')
        .set('X-Tenant-Subdomain', 'wellstest')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          apiNumber,
          name: 'Tenant 1 Well',
          status: 'ACTIVE',
          latitude: 31.7619,
          longitude: -106.485,
          lease: 'Tenant 1 Lease',
          field: 'Permian Basin',
          operator: 'Tenant 1 Operator',
        })
        .expect(201);

      tenant1WellId = response.body.id;

      // Create admin user in tenant2
      const tenant2Email = `tenant2-admin-${Date.now()}@wells.test`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('X-Tenant-Subdomain', 'tenant2')
        .send({
          email: tenant2Email,
          password: 'Tenant2Pass123!@#',
          name: 'Tenant 2 Admin',
        })
        .expect(201);

      // Login to tenant2
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'tenant2')
        .send({
          email: tenant2Email,
          password: 'Tenant2Pass123!@#',
        })
        .expect(200);

      tenant2AccessToken = loginResponse.body.accessToken;
    });

    it('should not return tenant1 wells to tenant2', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/wells')
        .set('X-Tenant-Subdomain', 'tenant2')
        .set('Authorization', `Bearer ${tenant2AccessToken}`)
        .expect(200);

      const tenant1Well = response.body.wells.find(
        (well: { id: string }) => well.id === tenant1WellId,
      );
      expect(tenant1Well).toBeUndefined();
    });

    it('should return 404 when tenant2 accesses tenant1 well by ID', async () => {
      await request(app.getHttpServer())
        .get(`/api/wells/${tenant1WellId}`)
        .set('X-Tenant-Subdomain', 'tenant2')
        .set('Authorization', `Bearer ${tenant2AccessToken}`)
        .expect(404);
    });

    it('should reject tenant2 updating tenant1 well', async () => {
      await request(app.getHttpServer())
        .patch(`/api/wells/${tenant1WellId}`)
        .set('X-Tenant-Subdomain', 'tenant2')
        .set('Authorization', `Bearer ${tenant2AccessToken}`)
        .send({
          name: 'Unauthorized Cross-Tenant Update',
        })
        .expect(404); // Well not found in tenant2's database
    });
  });
});
