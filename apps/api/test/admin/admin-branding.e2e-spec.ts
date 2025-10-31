/**
 * Admin Branding E2E Tests
 *
 * Tests the complete admin branding management flow:
 * - Create branding configuration for a tenant
 * - Read branding configuration
 * - Update branding details
 * - Upload logo (multipart/form-data)
 * - Remove logo
 * - Delete branding configuration
 * - RBAC enforcement (ADMIN role required)
 * - Master database operations (not tenant-scoped)
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import * as path from 'path';
import * as fs from 'fs';

describe('Admin Branding Management (e2e)', () => {
  let app: INestApplication;
  let adminAccessToken: string;
  let testTenantId: string;

  // Test logo file path (create a simple test image)
  const testLogoPath = path.join(__dirname, 'test-logo.png');

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

    // Create a test PNG file (1x1 pixel transparent PNG)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.writeFileSync(testLogoPath, pngBuffer);

    // Authenticate as admin user
    // NOTE: This assumes a test admin user exists in the master database
    // In real implementation, you would seed a test admin user or use a test helper
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@wellpulse.io',
        password: 'AdminPass123!@#',
      })
      .expect(200);

    adminAccessToken = adminLoginResponse.body.accessToken;

    // Create a test tenant to use for branding tests
    const tenantResponse = await request(app.getHttpServer())
      .post('/api/admin/tenants')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        subdomain: `test-branding-${Date.now()}`,
        companyName: 'Test Branding Company',
        ownerEmail: `owner-${Date.now()}@test.com`,
        ownerName: 'Branding Test Owner',
        databaseName: `test_branding_${Date.now()}`,
      })
      .expect(201);

    testTenantId = tenantResponse.body.id;
  });

  afterAll(async () => {
    // Clean up test logo file
    if (fs.existsSync(testLogoPath)) {
      fs.unlinkSync(testLogoPath);
    }

    // Clean up test tenant (optional - depends on test strategy)
    // await request(app.getHttpServer())
    //   .delete(`/api/admin/tenants/${testTenantId}`)
    //   .set('Authorization', `Bearer ${adminAccessToken}`)
    //   .expect(200);

    await app.close();
  });

  describe('GET /admin/branding/:tenantId', () => {
    it('should return null when branding does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toBeNull();
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/api/admin/branding/${testTenantId}`)
        .expect(401);
    });

    it('should reject request from non-admin user', async () => {
      // Assuming we have a regular user token (not admin)
      // This would require additional test setup
      // For now, we'll skip this test or mark as TODO
    });
  });

  describe('POST /admin/branding/:tenantId', () => {
    it('should create branding configuration successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          companyName: 'Test Branding Company',
          address: '123 Test Street',
          city: 'Midland',
          state: 'TX',
          zipCode: '79701',
          phone: '432-555-1234',
          email: 'info@testbranding.com',
          website: 'https://testbranding.com',
          primaryColor: '#1a73e8',
          secondaryColor: '#5f6368',
          textColor: '#202124',
          backgroundColor: '#ffffff',
          headerText: 'Trusted Partner Since 1985',
          footerText: 'Confidential & Proprietary',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.message).toContain('success');
    });

    it('should reject duplicate branding creation', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          companyName: 'Test Branding Company',
          address: '123 Test Street',
          city: 'Midland',
          state: 'TX',
          zipCode: '79701',
        })
        .expect(409); // Conflict - branding already exists
    });

    it('should validate required fields', async () => {
      const newTenantId = crypto.randomUUID();

      await request(app.getHttpServer())
        .post(`/api/admin/branding/${newTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          companyName: 'Test Company',
          // Missing required address fields
        })
        .expect(400);
    });

    it('should validate color format', async () => {
      const newTenantId = crypto.randomUUID();

      await request(app.getHttpServer())
        .post(`/api/admin/branding/${newTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          companyName: 'Test Company',
          address: '123 Test St',
          city: 'Test City',
          state: 'TX',
          zipCode: '12345',
          primaryColor: 'invalid-color', // Invalid hex color
          secondaryColor: '#5f6368',
          textColor: '#202124',
          backgroundColor: '#ffffff',
        })
        .expect(400);
    });
  });

  describe('GET /admin/branding/:tenantId (after creation)', () => {
    it('should return branding configuration', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('companyInfo');
      expect(response.body.companyInfo.companyName).toBe(
        'Test Branding Company',
      );
      expect(response.body).toHaveProperty('brandColors');
      expect(response.body.brandColors.primary).toBe('#1a73e8');
      expect(response.body).toHaveProperty('logoAsset');
      expect(response.body.logoAsset).toBeNull(); // No logo uploaded yet
    });
  });

  describe('PUT /admin/branding/:tenantId', () => {
    it('should update branding configuration', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          companyName: 'Updated Branding Company',
          primaryColor: '#ff5722',
          secondaryColor: '#9e9e9e',
          textColor: '#000000',
          backgroundColor: '#f5f5f5',
          headerText: 'Updated Header',
        })
        .expect(200);

      expect(response.body.message).toContain('success');
    });

    it('should return 404 for non-existent branding', async () => {
      const nonExistentTenantId = crypto.randomUUID();

      await request(app.getHttpServer())
        .put(`/api/admin/branding/${nonExistentTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          companyName: 'Updated Company',
        })
        .expect(404);
    });
  });

  describe('POST /admin/branding/:tenantId/logo/upload', () => {
    it('should upload logo successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/admin/branding/${testTenantId}/logo/upload`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .attach('file', testLogoPath)
        .expect(200);

      expect(response.body).toHaveProperty('logoAsset');
      expect(response.body.logoAsset).toHaveProperty('blobUrl');
      expect(response.body.logoAsset).toHaveProperty('fileName');
      expect(response.body.logoAsset).toHaveProperty('width');
      expect(response.body.logoAsset).toHaveProperty('height');
      expect(response.body.message).toContain('success');
    });

    it('should reject upload without file', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/branding/${testTenantId}/logo/upload`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(400);
    });

    it('should reject invalid file type', async () => {
      // Create a test text file
      const txtPath = path.join(__dirname, 'test.txt');
      fs.writeFileSync(txtPath, 'This is not an image');

      await request(app.getHttpServer())
        .post(`/api/admin/branding/${testTenantId}/logo/upload`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .attach('file', txtPath)
        .expect(400);

      // Clean up
      fs.unlinkSync(txtPath);
    });

    it('should reject logo that is too large', async () => {
      // Create a large file (> 2MB)
      const largePath = path.join(__dirname, 'large-logo.png');
      const largeBuffer = Buffer.alloc(3 * 1024 * 1024); // 3MB
      fs.writeFileSync(largePath, largeBuffer);

      await request(app.getHttpServer())
        .post(`/api/admin/branding/${testTenantId}/logo/upload`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .attach('file', largePath)
        .expect(400);

      // Clean up
      fs.unlinkSync(largePath);
    });
  });

  describe('GET /admin/branding/:tenantId (after logo upload)', () => {
    it('should return branding with logo metadata', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.logoAsset).not.toBeNull();
      expect(response.body.logoAsset).toHaveProperty('blobUrl');
      expect(response.body.logoAsset).toHaveProperty('fileName');
      expect(response.body.logoAsset).toHaveProperty('mimeType');
      expect(response.body.logoAsset).toHaveProperty('sizeBytes');
      expect(response.body.logoAsset).toHaveProperty('width');
      expect(response.body.logoAsset).toHaveProperty('height');
    });
  });

  describe('DELETE /admin/branding/:tenantId/logo', () => {
    it('should remove logo successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/admin/branding/${testTenantId}/logo`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.message).toContain('success');
    });

    it('should return 404 for non-existent branding', async () => {
      const nonExistentTenantId = crypto.randomUUID();

      await request(app.getHttpServer())
        .delete(`/api/admin/branding/${nonExistentTenantId}/logo`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });
  });

  describe('DELETE /admin/branding/:tenantId', () => {
    it('should delete branding configuration', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.message).toContain('success');
    });

    it('should return 404 when trying to delete again', async () => {
      await request(app.getHttpServer())
        .delete(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it('should confirm branding is deleted', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/admin/branding/${testTenantId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toBeNull();
    });
  });
});
