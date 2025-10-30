import {
  IsString,
  IsEnum,
  IsObject,
  IsDateString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { EntryType } from '../../../domain/field-data/field-entry.entity';

export class CreateFieldEntryRequestDto {
  @IsString()
  wellId: string;

  @IsEnum(['PRODUCTION', 'INSPECTION', 'MAINTENANCE'])
  entryType: EntryType;

  @IsObject()
  data: any; // Validated by domain value objects

  @IsDateString()
  recordedAt: string;

  @IsString()
  deviceId: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
