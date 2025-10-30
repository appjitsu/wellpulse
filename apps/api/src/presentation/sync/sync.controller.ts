import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { TenantContext } from '../../infrastructure/decorators/tenant-context.decorator';
import { SyncService } from '../../application/sync/sync.service';
import { SyncPullResponseDto } from '../../application/sync/dto/sync-pull-response.dto';
import { SyncPushRequestDto } from '../../application/sync/dto/sync-push-request.dto';
import { SyncPushResponseDto } from '../../application/sync/dto/sync-push-response.dto';
import { User } from '../../domain/users/user.entity';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Pull data for offline use
   * Downloads wells and users to offline device
   *
   * GET /sync/pull
   */
  @Get('pull')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  async pullData(
    @TenantContext() tenantId: string,
  ): Promise<SyncPullResponseDto> {
    return this.syncService.pullData(tenantId);
  }

  /**
   * Push field entries from offline device
   * Uploads field entries collected offline
   *
   * POST /sync/push
   */
  @Post('push')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  async pushData(
    @TenantContext() tenantId: string,
    @CurrentUser() user: User,
    @Body() dto: SyncPushRequestDto,
  ): Promise<SyncPushResponseDto> {
    return this.syncService.pushData(
      tenantId,
      user.id,
      dto.deviceId,
      dto.entries,
    );
  }

  /**
   * Get sync status for a device
   *
   * GET /sync/status?deviceId=xxx
   */
  @Get('status')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  getSyncStatus(
    @TenantContext() tenantId: string,
    @Query('deviceId') deviceId: string,
  ): {
    deviceId: string;
    lastSyncAt: string | null;
    pendingEntries: number;
  } {
    return this.syncService.getSyncStatus(tenantId, deviceId);
  }
}
