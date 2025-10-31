/**
 * Master Database Service
 *
 * Provides access to the master PostgreSQL database for:
 * - Tenant metadata
 * - Admin users
 * - Billing subscriptions
 * - Commodity price quotes (shared reference data)
 * - Usage metrics
 * - Audit logs
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as masterSchema from './master/schema';

@Injectable()
export class MasterDatabaseService implements OnModuleInit {
  private db: NodePgDatabase<typeof masterSchema>;
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    // Initialize master database connection on module startup
    const masterDbUrl = this.configService.get<string>('MASTER_DATABASE_URL');

    if (!masterDbUrl) {
      throw new Error('MASTER_DATABASE_URL not configured in environment');
    }

    this.pool = new Pool({
      connectionString: masterDbUrl,
      max: 20, // Master DB can handle more connections
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.db = drizzle(this.pool, { schema: masterSchema });
  }

  /**
   * Get master database instance
   */
  getDatabase(): NodePgDatabase<typeof masterSchema> {
    if (!this.db) {
      throw new Error('Master database not initialized');
    }
    return this.db;
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  async closeConnections(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
