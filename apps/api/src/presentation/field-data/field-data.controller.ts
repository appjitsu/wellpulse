import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { TenantContext } from '../../infrastructure/decorators/tenant-context.decorator';
import { CreateFieldEntryCommand } from '../../application/field-data/commands/create-field-entry/create-field-entry.command';
import { GetFieldEntriesQuery } from '../../application/field-data/queries/get-field-entries/get-field-entries.query';
import { CreateFieldEntryRequestDto } from '../../application/field-data/dto/create-field-entry.request.dto';
import { FieldEntryDto } from '../../application/field-data/dto/field-entry.dto';
import { EntryType } from '../../domain/field-data/field-entry.entity';
import { User } from '../../domain/users/user.entity';
import { SharePhotosDto } from './dto/share-photos.dto';
import { EmailService } from '../../infrastructure/services/email.service';

@Controller('field-data')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FieldDataController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  async createFieldEntry(
    @TenantContext() tenantId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateFieldEntryRequestDto,
  ): Promise<{ id: string }> {
    const command = new CreateFieldEntryCommand(
      tenantId,
      dto.wellId,
      dto.entryType,
      dto.data,
      new Date(dto.recordedAt),
      user.id,
      dto.deviceId,
      dto.latitude,
      dto.longitude,
      dto.photos,
      dto.notes,
    );

    const id = await this.commandBus.execute<CreateFieldEntryCommand, string>(
      command,
    );

    return { id };
  }

  @Get()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  async getFieldEntries(
    @TenantContext() tenantId: string,
    @Query('wellId') wellId?: string,
    @Query('entryType') entryType?: EntryType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ): Promise<FieldEntryDto[]> {
    const query = new GetFieldEntriesQuery(
      tenantId,
      wellId,
      entryType,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    );

    return this.queryBus.execute<GetFieldEntriesQuery, FieldEntryDto[]>(query);
  }

  @Get('well/:wellId')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  async getWellFieldEntries(
    @TenantContext() tenantId: string,
    @Param('wellId') wellId: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ): Promise<FieldEntryDto[]> {
    const query = new GetFieldEntriesQuery(
      tenantId,
      wellId,
      undefined,
      undefined,
      undefined,
      limit,
      offset,
    );

    return this.queryBus.execute<GetFieldEntriesQuery, FieldEntryDto[]>(query);
  }

  @Post('share-photos')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async sharePhotos(
    @CurrentUser() user: User,
    @Body() dto: SharePhotosDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.emailService.sendFieldEntryPhotos(
        dto.recipients,
        dto.photos,
        user.name || user.email,
        dto.wellName,
        dto.entryData,
        dto.checklist,
      );

      return {
        success: true,
        message: `Photos shared successfully with ${dto.recipients.length} recipient(s)`,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to share photos. Please try again.',
      };
    }
  }
}
