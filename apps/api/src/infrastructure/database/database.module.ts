/**
 * Database Module
 *
 * Provides database services globally throughout the application.
 * Manages tenant database connections with connection pooling.
 *
 * Exports:
 * - TenantDatabaseService: Manages tenant-specific database connections
 */

import { Global, Module } from '@nestjs/common';
import { TenantDatabaseService } from './tenant-database.service';

@Global()
@Module({
  providers: [TenantDatabaseService],
  exports: [TenantDatabaseService],
})
export class DatabaseModule {}
