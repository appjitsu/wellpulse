/**
 * Create Tag Mappings Request DTO
 *
 * Validates incoming requests for creating tag mappings that map OPC-UA tags
 * to field entry properties.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Tag Configuration Input DTO
 */
export class TagConfigDto {
  @ApiProperty({
    description: 'OPC-UA node identifier',
    example: 'ns=2;s=Pressure',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nodeId!: string;

  @ApiProperty({
    description: 'Internal tag name',
    example: 'casingPressure',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tagName!: string;

  @ApiProperty({
    description: 'Field entry property to populate',
    example: 'casingPressure',
    enum: [
      'casingPressure',
      'tubingPressure',
      'linePressure',
      'temperature',
      'flowRate',
      'oilVolume',
      'gasVolume',
      'waterVolume',
      'chokePressure',
      'separatorPressure',
    ],
  })
  @IsString()
  @IsIn([
    'casingPressure',
    'tubingPressure',
    'linePressure',
    'temperature',
    'flowRate',
    'oilVolume',
    'gasVolume',
    'waterVolume',
    'chokePressure',
    'separatorPressure',
  ])
  fieldEntryProperty!: string;

  @ApiProperty({
    description: 'OPC-UA data type',
    enum: [
      'Boolean',
      'SByte',
      'Byte',
      'Int16',
      'UInt16',
      'Int32',
      'UInt32',
      'Int64',
      'UInt64',
      'Float',
      'Double',
      'String',
      'DateTime',
    ],
    example: 'Float',
  })
  @IsString()
  @IsIn([
    'Boolean',
    'SByte',
    'Byte',
    'Int16',
    'UInt16',
    'Int32',
    'UInt32',
    'Int64',
    'UInt64',
    'Float',
    'Double',
    'String',
    'DateTime',
  ])
  dataType!: string;

  @ApiProperty({
    description: 'Measurement unit',
    example: 'psi',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiProperty({
    description: 'Scaling factor to apply to raw value',
    example: 1.0,
    default: 1.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  scalingFactor?: number;

  @ApiProperty({
    description:
      'Deadband threshold - minimum change required to record new value',
    example: 5.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deadband?: number;
}

/**
 * Create Tag Mappings DTO
 */
export class CreateTagMappingsDto {
  @ApiProperty({
    description: 'Array of tag configurations to create',
    type: [TagConfigDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TagConfigDto)
  tags!: TagConfigDto[];
}
