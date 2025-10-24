/**
 * Create Well Command and Handler
 *
 * Implements well creation with API number uniqueness validation.
 */

import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IWellRepository } from '../../../domain/repositories/well.repository.interface';
import { Well, WellStatus } from '../../../domain/wells/well.entity';

/**
 * Create Well Command
 */
export class CreateWellCommand {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly data: {
      name: string;
      apiNumber: string;
      latitude: number;
      longitude: number;
      status?: WellStatus;
      lease?: string;
      field?: string;
      operator?: string;
      spudDate?: string;
      completionDate?: string;
      metadata?: Record<string, any>;
    },
    public readonly databaseName?: string,
  ) {}
}

/**
 * Create Well Command Handler
 *
 * Business Rules:
 * - API number must be unique within tenant
 * - Validates all business rules through Well entity
 * - Only Admin and Manager roles can create wells (enforced at controller level)
 */
@Injectable()
@CommandHandler(CreateWellCommand)
export class CreateWellHandler
  implements ICommandHandler<CreateWellCommand, string>
{
  constructor(
    @Inject('IWellRepository')
    private readonly wellRepository: IWellRepository,
  ) {}

  async execute(command: CreateWellCommand): Promise<string> {
    // 1. Check if API number already exists in this tenant
    const existing = await this.wellRepository.findByApiNumber(
      command.tenantId,
      command.data.apiNumber,
      command.databaseName,
    );

    if (existing) {
      throw new ConflictException(
        `Well with API number ${command.data.apiNumber} already exists`,
      );
    }

    // 2. Create domain entity (validates business rules)
    const well = Well.create({
      name: command.data.name,
      apiNumber: command.data.apiNumber,
      latitude: command.data.latitude,
      longitude: command.data.longitude,
      status: command.data.status,
      lease: command.data.lease,
      field: command.data.field,
      operator: command.data.operator,
      spudDate: command.data.spudDate
        ? new Date(command.data.spudDate)
        : undefined,
      completionDate: command.data.completionDate
        ? new Date(command.data.completionDate)
        : undefined,
      metadata: command.data.metadata,
      createdBy: command.userId,
    });

    // 3. Save to tenant database
    await this.wellRepository.save(
      command.tenantId,
      well,
      command.databaseName,
    );

    return well.id;
  }
}
