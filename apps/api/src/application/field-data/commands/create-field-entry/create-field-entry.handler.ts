import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateFieldEntryCommand } from './create-field-entry.command';
import { IFieldEntryRepository } from '../../../../domain/repositories/field-entry.repository.interface';
import { FieldEntry } from '../../../../domain/field-data/field-entry.entity';
import {
  ProductionData,
  InspectionData,
  MaintenanceData,
} from '../../../../domain/field-data/value-objects';

@CommandHandler(CreateFieldEntryCommand)
export class CreateFieldEntryHandler
  implements ICommandHandler<CreateFieldEntryCommand, string>
{
  constructor(
    @Inject('IFieldEntryRepository')
    private readonly fieldEntryRepository: IFieldEntryRepository,
  ) {}

  async execute(command: CreateFieldEntryCommand): Promise<string> {
    const {
      tenantId,
      wellId,
      entryType,
      recordedAt,
      createdBy,
      deviceId,
      latitude,
      longitude,
      photos,
      notes,
    } = command;

    // Create appropriate value object based on entry type
    // Note: data is validated by value object constructors
    let productionData: ProductionData | undefined;
    let inspectionData: InspectionData | undefined;
    let maintenanceData: MaintenanceData | undefined;

    switch (entryType) {
      case 'PRODUCTION':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        productionData = ProductionData.create(command.data);
        break;
      case 'INSPECTION':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        inspectionData = InspectionData.create(command.data);
        break;
      case 'MAINTENANCE':
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        maintenanceData = MaintenanceData.create(command.data);
        break;
    }

    // Create field entry entity
    const fieldEntry = FieldEntry.create({
      id: randomUUID(),
      tenantId,
      wellId,
      entryType,
      productionData,
      inspectionData,
      maintenanceData,
      recordedAt,
      createdBy,
      deviceId,
      latitude,
      longitude,
      photos,
      notes,
    });

    // Save to repository
    await this.fieldEntryRepository.save(tenantId, fieldEntry);

    return fieldEntry.id;
  }
}
