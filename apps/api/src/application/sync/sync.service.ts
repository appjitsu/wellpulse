import { Injectable, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IWellRepository } from '../../domain/repositories/well.repository.interface';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import {
  SyncPullResponseDto,
  WellSyncDto,
  UserSyncDto,
} from './dto/sync-pull-response.dto';
import { SyncPushResponseDto, ConflictDto } from './dto/sync-push-response.dto';
import { CreateFieldEntryRequestDto } from '../field-data/dto/create-field-entry.request.dto';
import { CreateFieldEntryCommand } from '../field-data/commands/create-field-entry/create-field-entry.command';

@Injectable()
export class SyncService {
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly commandBus: CommandBus,
  ) {}

  /**
   * Pull data for offline use
   * Returns wells and users for the tenant
   */
  async pullData(tenantId: string): Promise<SyncPullResponseDto> {
    // Fetch all active wells
    const wells = await this.wellRepository.findAll(tenantId, {
      status: 'ACTIVE',
      limit: 1000,
    });

    // Fetch all active users
    const users = await this.userRepository.findAll(tenantId);

    // Map to sync DTOs (lightweight representations for offline storage)
    const wellDtos: WellSyncDto[] = wells.map((well) => ({
      id: well.id,
      name: well.name,
      apiNumber: well.apiNumber,
      latitude: well.latitude,
      longitude: well.longitude,
      status: well.status,
      lease: well.lease,
      field: well.field,
      operator: well.operator,
    }));

    // Map users to sync DTOs - extracting primitives from domain entities
    const userDtos: UserSyncDto[] = users.map((user) => ({
      id: user.id,
      email: user.email, // email getter returns string directly
      name: user.name, // single name field
      role: user.role,
    }));

    return {
      wells: wellDtos,
      users: userDtos,
      lastSyncTimestamp: new Date().toISOString(),
      tenantId,
    };
  }

  /**
   * Push field entries from offline device
   * Handles batch upload with conflict detection
   */
  async pushData(
    tenantId: string,
    userId: string,
    deviceId: string,
    entries: CreateFieldEntryRequestDto[],
  ): Promise<SyncPushResponseDto> {
    let succeeded = 0;
    let failed = 0;
    const conflicts: ConflictDto[] = [];
    const errors: Array<{ wellId: string; error: string }> = [];

    // Process each entry
    for (const entry of entries) {
      try {
        // Create field entry via CQRS command
        const command = new CreateFieldEntryCommand(
          tenantId,
          entry.wellId,
          entry.entryType,
          entry.data,
          new Date(entry.recordedAt),
          userId,
          deviceId,
          entry.latitude,
          entry.longitude,
          entry.photos,
          entry.notes,
        );

        await this.commandBus.execute(command);
        succeeded++;
      } catch (error: unknown) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const wellId = entry.wellId;
        const recordedAt = entry.recordedAt;

        errors.push({
          wellId,
          error: errorMessage,
        });

        // Check if it's a conflict (e.g., duplicate entry)
        if (
          errorMessage.includes('duplicate') ||
          errorMessage.includes('conflict')
        ) {
          conflicts.push({
            entryId: '', // Would need entry ID from device
            wellId,
            recordedAt,
            reason: errorMessage,
            resolution: 'SERVER_WINS', // Last-write-wins strategy
          });
        }
      }
    }

    return {
      succeeded,
      failed,
      conflicts,
      errors,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Get sync status for a device
   * TODO: Implement actual sync tracking
   */
  getSyncStatus(
    tenantId: string,
    deviceId: string,
  ): {
    deviceId: string;
    lastSyncAt: string | null;
    pendingEntries: number;
  } {
    // This would query the database for the last sync timestamp
    // For now, return a simple response
    return {
      deviceId,
      lastSyncAt: null,
      pendingEntries: 0,
    };
  }
}
