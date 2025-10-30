/**
 * Database Module
 *
 * Provides database services globally throughout the application.
 * Manages tenant database connections with connection pooling.
 *
 * Exports:
 * - TenantDatabaseService: Manages tenant-specific database connections
 * - EncryptionService: Encrypts/decrypts sensitive data (e.g., database URLs)
 */

import { Global, Module } from '@nestjs/common';
import { TenantDatabaseService } from './tenant-database.service';
import { EncryptionService } from '../services/encryption.service';

@Global()
@Module({
  providers: [TenantDatabaseService, EncryptionService],
  exports: [TenantDatabaseService, EncryptionService],
})
export class DatabaseModule {}
