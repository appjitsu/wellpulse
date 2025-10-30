import {
  IsEmail,
  IsArray,
  ArrayMinSize,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';

export class SharePhotosDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one email address is required' })
  @IsEmail(
    {},
    { each: true, message: 'All recipients must be valid email addresses' },
  )
  recipients!: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one photo must be selected' })
  photos!: Array<{
    localUri: string;
    remoteUrl?: string;
  }>;

  @IsOptional()
  @IsString()
  wellName?: string;

  @IsOptional()
  @IsObject()
  entryData?: {
    productionVolume?: number;
    pressure?: number;
    temperature?: number;
    gasVolume?: number;
    waterCut?: number;
    notes?: string;
    recordedAt?: string;
    latitude?: number;
    longitude?: number;
  };

  @IsOptional()
  @IsArray()
  checklist?: Array<{
    label: string;
    checked: boolean;
  }>;
}
