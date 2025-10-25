/**
 * Tenant Database Service
 *
 * Manages tenant-specific database connections with connection pooling.
 * Each tenant has their own isolated database.
 *
 * Architecture:
 * - Maintains a connection pool per tenant (lazy initialization)
 * - Automatically connects to correct tenant database based on tenantId
 * - Supports configurable connection limits and timeouts
 *
 * Multi-Tenancy Pattern:
 * - Database-per-tenant isolation
 * - Connection pooling for performance
 * - Lazy loading of connections (only create when needed)
 *
 * TODO for Production:
 * - Add connection pool configuration per tenant tier
 * - Implement connection health checks
 * - Add metrics/monitoring for connection usage
 * - Support multiple database types (PostgreSQL, SQL Server, MySQL, Oracle)
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as tenantSchema from './schema/tenant';

/**
 * Connection pool configuration per tenant
 */
interface PoolConfig {
  max: number; // Maximum connections in pool
  min: number; // Minimum connections in pool
  idleTimeoutMillis: number; // Close idle connections after this time
  connectionTimeoutMillis: number; // Timeout for acquiring connection
}

/**
 * Tenant database connection info
 */
export interface TenantConnection {
  pool: Pool;
  db: NodePgDatabase<typeof tenantSchema>;
}

@Injectable()
export class TenantDatabaseService implements OnModuleDestroy {
  // Map of tenantId -> connection pool
  private readonly connections = new Map<string, TenantConnection>();

  // Default connection pool configuration
  private readonly defaultPoolConfig: PoolConfig = {
    max: 10, // Max 10 connections per tenant
    min: 2, // Keep 2 connections warm
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 5000, // 5 second timeout for acquiring connection
  };

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get database connection for a tenant
   * Creates connection pool if it doesn't exist (lazy initialization)
   *
   * @param tenantId - Unique tenant identifier (used as connection pool key)
   * @param databaseName - Actual database name (e.g., 'acme_wellpulse')
   */
  async getTenantDatabase(
    tenantId: string,
    databaseName?: string,
  ): Promise<NodePgDatabase<typeof tenantSchema>> {
    // Check if connection already exists
    let connection = this.connections.get(tenantId);

    if (!connection) {
      // Create new connection pool for tenant
      connection = await this.createTenantConnection(tenantId, databaseName);
      this.connections.set(tenantId, connection);
    }

    return connection.db;
  }

  /**
   * Create a new database connection for a tenant
   *
   * @param tenantId - Unique tenant identifier
   * @param databaseName - Actual database name from tenant record
   */
  private async createTenantConnection(
    tenantId: string,
    databaseName?: string,
  ): Promise<TenantConnection> {
    const host = this.configService.get<string>('POSTGRES_HOST') || 'localhost';
    const port =
      parseInt(this.configService.get<string>('POSTGRES_PORT') || '5432', 10) ||
      5432;
    const user = this.configService.get<string>('POSTGRES_USER') || 'wellpulse';
    const password =
      this.configService.get<string>('POSTGRES_PASSWORD') || 'wellpulse';

    // Use provided database name, or fall back to convention-based naming
    // Convention: {slug}_wellpulse (e.g., 'acme_wellpulse')
    const database = databaseName || `${tenantId.replace(/-/g, '_')}_wellpulse`;

    // Create PostgreSQL connection pool
    const pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      ...this.defaultPoolConfig,
    });

    // Test connection
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      throw new Error(
        `Failed to connect to tenant database '${database}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Create Drizzle instance with tenant schema
    const db = drizzle(pool, { schema: tenantSchema });

    return { pool, db };
  }

  /**
   * Close all tenant database connections
   * Called on application shutdown
   */
  async onModuleDestroy(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(
      (connection) => connection.pool.end(),
    );

    await Promise.all(closePromises);
    this.connections.clear();
  }

  /**
   * Get active connection count
   * Useful for monitoring/debugging
   */
  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Close a specific tenant's connection pool
   * Useful for tenant offboarding or connection cleanup
   */
  async closeTenantConnection(tenantId: string): Promise<void> {
    const connection = this.connections.get(tenantId);
    if (connection) {
      await connection.pool.end();
      this.connections.delete(tenantId);
    }
  }

  /**
   * Get all tenant connections for monitoring/metrics
   * Returns read-only map of tenantId -> TenantConnection
   */
  getAllConnections(): ReadonlyMap<string, TenantConnection> {
    return this.connections;
  }
}
