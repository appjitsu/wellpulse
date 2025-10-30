import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateFieldEntryRequestDto } from '../../field-data/dto/create-field-entry.request.dto';

export class SyncPushRequestDto {
  @IsString()
  deviceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFieldEntryRequestDto)
  entries: CreateFieldEntryRequestDto[];
}
