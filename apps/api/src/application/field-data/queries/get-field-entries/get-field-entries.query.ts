import { IQuery } from '@nestjs/cqrs';
import { EntryType } from '../../../../domain/field-data/field-entry.entity';

export class GetFieldEntriesQuery implements IQuery {
  constructor(
    public readonly tenantId: string,
    public readonly wellId?: string,
    public readonly entryType?: EntryType,
    public readonly startDate?: Date,
    public readonly endDate?: Date,
    public readonly limit = 100,
    public readonly offset = 0,
  ) {}
}
