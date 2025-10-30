/**
 * Tenant Provisioning Service
 *
 * Handles automatic provisioning of tenant databases when new tenants are created.
 *
 * Flow:
 * 1. Generate database name from tenant slug
 * 2. Create PostgreSQL database (requires admin privileges)
 * 3. Run tenant schema migrations on new database
 * 4. Verify database is accessible
 *
 * This service implements the core Sprint 1 requirement: automatic tenant database creation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postgresImport from 'postgres';
import type { Sql } from 'postgres';
import { Tenant } from '../../domain/tenants/tenant.entity';

// Handle ESM/CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
const postgresDefault = (postgresImport as any).default;
const postgres: (url: string, options?: { max?: number }) => Sql =
  typeof postgresImport === 'function'
    ? (postgresImport as unknown as (
        url: string,
        options?: { max?: number },
      ) => Sql)
    : (postgresDefault as (url: string, options?: { max?: number }) => Sql);

export interface TenantProvisioningResult {
  databaseName: string;
  databaseUrl: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Provision a new tenant database
   *
   * Creates the PostgreSQL database and sets up initial schema.
   *
   * @param tenant - The tenant entity (already validated by domain layer)
   * @returns Provisioning result with database URL
   */
  async provisionTenantDatabase(
    tenant: Tenant,
  ): Promise<TenantProvisioningResult> {
    const databaseName = this.generateDatabaseName(tenant.slug);
    this.logger.log(
      `Provisioning database for tenant: ${tenant.slug} (${databaseName})`,
    );

    try {
      // Step 1: Create PostgreSQL database
      await this.createDatabase(databaseName);

      // Step 2: Build tenant database connection URL
      const databaseUrl = this.buildTenantDatabaseUrl(databaseName);

      // Step 3: Run tenant schema migrations (Sprint 3 - for now just verify connection)
      await this.initializeTenantSchema(databaseUrl);

      // Step 4: Verify database is accessible
      await this.verifyDatabaseConnection(databaseUrl);

      this.logger.log(`✅ Successfully provisioned database: ${databaseName}`);

      return {
        databaseName,
        databaseUrl,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to provision database: ${databaseName}`,
        error,
      );

      return {
        databaseName,
        databaseUrl: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new PostgreSQL database
   *
   * Uses admin connection with CREATE DATABASE privileges.
   * Handles case where database already exists (idempotent).
   */
  private async createDatabase(databaseName: string): Promise<void> {
    const adminDbUrl = this.getAdminDatabaseUrl();
    const adminClient = postgres(adminDbUrl, {
      max: 1, // Single connection for admin operations
    });

    try {
      // CREATE DATABASE cannot run in a transaction, so we use unsafe
      await adminClient.unsafe(
        `CREATE DATABASE ${this.sanitizeDatabaseName(databaseName)}`,
      );
      this.logger.log(`Created database: ${databaseName}`);
    } catch (error: unknown) {
      // PostgreSQL error code 42P04 = database already exists
      const pgError = error as { code?: string; message?: string };
      if (pgError.code === '42P04') {
        this.logger.warn(`Database already exists: ${databaseName}`);
        // This is OK - database creation is idempotent
      } else {
        throw new Error(
          `Failed to create database ${databaseName}: ${pgError.message || 'Unknown error'}`,
        );
      }
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Initialize tenant schema (placeholder for Sprint 3)
   *
   * In Sprint 3, this will run Drizzle migrations to set up:
   * - users table
   * - wells table
   * - production table
   * - equipment table
   * - field_events table
   *
   * For Sprint 1, we just verify the connection works.
   */
  private async initializeTenantSchema(databaseUrl: string): Promise<void> {
    const tenantClient = postgres(databaseUrl, {
      max: 1,
    });

    try {
      // Create a basic health check table to verify schema access
      await tenantClient.unsafe(`
        CREATE TABLE IF NOT EXISTS _schema_version (
          version INTEGER PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await tenantClient.unsafe(`
        INSERT INTO _schema_version (version) VALUES (1)
        ON CONFLICT (version) DO NOTHING
      `);

      this.logger.log('Tenant schema initialized (Sprint 1 basic setup)');
    } finally {
      await tenantClient.end();
    }
  }

  /**
   * Verify database connection is working
   */
  private async verifyDatabaseConnection(databaseUrl: string): Promise<void> {
    const client = postgres(databaseUrl, { max: 1 });

    try {
      const result = await client<{ result: number }[]>`SELECT 1 as result`;
      if (result[0]?.result !== 1) {
        throw new Error('Database connection verification failed');
      }
    } finally {
      await client.end();
    }
  }

  /**
   * Generate database name from tenant slug
   *
   * Examples:
   * - "acme-oil-gas" → "acme_oil_gas_wellpulse"
   * - "demo" → "demo_wellpulse"
   */
  private generateDatabaseName(slug: string): string {
    // Replace hyphens with underscores (PostgreSQL naming convention)
    const sanitized = slug.replace(/-/g, '_');
    return `${sanitized}_wellpulse`;
  }

  /**
   * Sanitize database name to prevent SQL injection
   *
   * Only allows lowercase letters, numbers, and underscores.
   */
  private sanitizeDatabaseName(name: string): string {
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw new Error(
        `Invalid database name: ${name}. Must contain only lowercase letters, numbers, and underscores.`,
      );
    }
    return name;
  }

  /**
   * Build tenant database connection URL
   */
  private buildTenantDatabaseUrl(databaseName: string): string {
    const host = this.configService.get<string>('POSTGRES_HOST', 'localhost');
    const port = this.configService.get<number>('POSTGRES_PORT', 5432);
    const user = this.configService.get<string>('POSTGRES_USER', 'wellpulse');
    const password = this.configService.get<string>(
      'POSTGRES_PASSWORD',
      'wellpulse',
    );

    return `postgresql://${user}:${password}@${host}:${port}/${databaseName}`;
  }

  /**
   * Get admin database URL for creating databases
   *
   * Connects to the default 'postgres' database with admin privileges.
   */
  private getAdminDatabaseUrl(): string {
    const host = this.configService.get<string>('POSTGRES_HOST', 'localhost');
    const port = this.configService.get<number>('POSTGRES_PORT', 5432);
    const user = this.configService.get<string>('POSTGRES_USER', 'wellpulse');
    const password = this.configService.get<string>(
      'POSTGRES_PASSWORD',
      'wellpulse',
    );

    // Connect to 'postgres' database (default admin database)
    return `postgresql://${user}:${password}@${host}:${port}/postgres`;
  }

  /**
   * Deprovision a tenant database (soft delete - for admin use only)
   *
   * Does NOT actually drop the database (too dangerous).
   * Just marks it for manual cleanup by platform admins.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async deprovisionTenantDatabase(tenant: Tenant): Promise<void> {
    const databaseName = this.generateDatabaseName(tenant.slug);
    this.logger.warn(
      `⚠️  Tenant database marked for deletion: ${databaseName}. Manual cleanup required by admin.`,
    );

    // In production, we would:
    // 1. Backup the database
    // 2. Mark in master DB as 'PENDING_DELETION'
    // 3. After retention period (e.g., 90 days), admin manually drops database
    //
    // For Sprint 1, we just log this - actual implementation in Sprint 10+
  }
}
