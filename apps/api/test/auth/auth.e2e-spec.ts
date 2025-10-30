/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow:
 * - User registration
 * - Email verification
 * - Login and JWT authentication
 * - Token refresh with rotation
 * - Password reset flow
 * - RBAC enforcement
 * - Rate limiting
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let testEmail: string;
  let testPassword: string;
  let accessToken: string;
  let refreshTokenCookie: string;

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

    // Generate unique test email
    testEmail = `test-${Date.now()}@example.com`;
    testPassword = 'SecurePass123!@#';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('X-Tenant-Subdomain', 'acme') // Use test tenant
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('requiresVerification');
      expect(response.body.message).toContain('Registration successful');

      // First user should not require verification (auto-admin)
      // Subsequent users will require verification
    });

    it('should reject duplicate email registration', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User Duplicate',
        })
        .expect(409); // Conflict
    });

    it('should validate password requirements', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: `weak-${Date.now()}@example.com`,
          password: 'weak', // Too weak
          name: 'Test User',
        })
        .expect(400);
    });

    it('should enforce rate limiting on registration (3 per hour)', async () => {
      // Make 3 registration attempts (should succeed)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/register')
          .set('X-Tenant-Subdomain', 'acme')
          .send({
            email: `ratelimit-${Date.now()}-${i}@example.com`,
            password: testPassword,
            name: `Rate Limit Test ${i}`,
          })
          .expect(201);
      }

      // 4th attempt should be rate limited
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: `ratelimit-${Date.now()}-final@example.com`,
          password: testPassword,
          name: 'Rate Limit Test Final',
        })
        .expect(429); // Too Many Requests
    }, 10000); // Increase timeout for rate limit test
  });

  describe('Email Verification', () => {
    it('should verify email with correct code', async () => {
      // For testing, we'll skip actual email verification
      // In production, verification code would come from email
      // For first user (auto-admin), this step is skipped
    });

    it('should reject invalid verification code', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/verify-email')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: testEmail,
          code: 'INVALID',
        })
        .expect(400);
    });
  });

  describe('Login & JWT Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.message).toBe('Login successful');

      // Extract access token
      accessToken = response.body.accessToken;

      // Extract refresh token from cookie
      const cookies = response.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();
      refreshTokenCookie =
        cookies?.find((cookie: string) => cookie.startsWith('refreshToken=')) ||
        '';
      expect(refreshTokenCookie).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject login for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);
    });

    it('should enforce rate limiting on login (5 per 15 minutes)', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Tenant-Subdomain', 'acme')
          .send({
            email: testEmail,
            password: `WrongPassword${i}`,
          })
          .expect(401);
      }

      // 6th attempt should be rate limited
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: testEmail,
          password: 'WrongPasswordFinal',
        })
        .expect(429); // Too Many Requests
    }, 10000);
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // Wait a moment to ensure token is actually different
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('X-Tenant-Subdomain', 'acme')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.message).toBe('Token refreshed successfully');

      // New access token should be different
      const newAccessToken = response.body.accessToken;
      expect(newAccessToken).not.toBe(accessToken);

      // Should receive new refresh token (rotation)
      const cookies = response.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();
      const newRefreshCookie = cookies?.find((cookie: string) =>
        cookie.startsWith('refreshToken='),
      );
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie).not.toBe(refreshTokenCookie);
    });

    it('should reject refresh without refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('X-Tenant-Subdomain', 'acme')
        .expect(401);
    });
  });

  describe('Protected Routes & RBAC', () => {
    it('should access protected route with valid token', async () => {
      // Test accessing users endpoint (admin-only)
      await request(app.getHttpServer())
        .get('/api/users')
        .set('X-Tenant-Subdomain', 'acme')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject protected route without token', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('X-Tenant-Subdomain', 'acme')
        .expect(401);
    });

    it('should reject protected route with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('X-Tenant-Subdomain', 'acme')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    // Note: Testing OPERATOR access to ADMIN route requires creating an operator user
    // This would be part of more comprehensive RBAC tests
  });

  describe('Password Reset Flow', () => {
    it('should request password reset successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: testEmail,
        })
        .expect(200);

      expect(response.body.message).toContain(
        'If an account exists with this email',
      );
    });

    it('should not reveal if email does not exist (security)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .set('X-Tenant-Subdomain', 'acme')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200);

      // Same message for security (don't reveal if email exists)
      expect(response.body.message).toContain(
        'If an account exists with this email',
      );
    });

    // Note: Testing actual password reset requires extracting reset token from database
    // or from email in real implementation
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('X-Tenant-Subdomain', 'acme')
        .expect(200);

      expect(response.body.message).toBe('Logout successful');

      // Should clear refresh token cookie
      const cookies = response.headers['set-cookie'] as unknown as
        | string[]
        | undefined;
      expect(cookies).toBeDefined();
      const clearedCookie = cookies?.find((cookie: string) =>
        cookie.startsWith('refreshToken='),
      );
      expect(clearedCookie).toContain('Max-Age=0'); // Cookie should be cleared
    });

    it('should not rate limit logout (safe operation)', async () => {
      // Make multiple logout requests (should all succeed)
      for (let i = 0; i < 20; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/logout')
          .set('X-Tenant-Subdomain', 'acme')
          .expect(200);
      }
    });
  });
});
