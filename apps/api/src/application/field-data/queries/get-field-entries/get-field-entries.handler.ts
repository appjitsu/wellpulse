import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetFieldEntriesQuery } from './get-field-entries.query';
import { IFieldEntryRepository } from '../../../../domain/repositories/field-entry.repository.interface';
import { FieldEntryDto } from '../../dto/field-entry.dto';

@QueryHandler(GetFieldEntriesQuery)
export class GetFieldEntriesHandler
  implements IQueryHandler<GetFieldEntriesQuery, FieldEntryDto[]>
{
  constructor(
    @Inject('IFieldEntryRepository')
    private readonly fieldEntryRepository: IFieldEntryRepository,
  ) {}

  async execute(query: GetFieldEntriesQuery): Promise<FieldEntryDto[]> {
    const { tenantId, wellId, entryType, startDate, endDate, limit, offset } =
      query;

    const entries = await this.fieldEntryRepository.findAll(
      tenantId,
      {
        wellId,
        entryType,
        startDate,
        endDate,
      },
      limit,
      offset,
    );

    return entries.map((entry) => FieldEntryDto.fromDomain(entry));
  }
}
