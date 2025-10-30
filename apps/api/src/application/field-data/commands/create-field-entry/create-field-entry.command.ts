import { ICommand } from '@nestjs/cqrs';
import { EntryType } from '../../../../domain/field-data/field-entry.entity';

export class CreateFieldEntryCommand implements ICommand {
  constructor(
    public readonly tenantId: string,
    public readonly wellId: string,
    public readonly entryType: EntryType,
    public readonly data: any, // ProductionData | InspectionData | MaintenanceData props
    public readonly recordedAt: Date,
    public readonly createdBy: string,
    public readonly deviceId: string,
    public readonly latitude?: number,
    public readonly longitude?: number,
    public readonly photos?: string[],
    public readonly notes?: string,
  ) {}
}
