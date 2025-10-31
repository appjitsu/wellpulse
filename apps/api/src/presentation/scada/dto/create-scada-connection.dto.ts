/**
 * Create SCADA Connection Request DTO
 *
 * Validates incoming requests for creating SCADA connections with OPC-UA configuration.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsIn,
  ValidateIf,
} from 'class-validator';

/**
 * Create SCADA Connection DTO
 */
export class CreateScadaConnectionDto {
  @ApiProperty({
    description: 'Well ID to associate with SCADA connection',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  wellId!: string;

  @ApiProperty({
    description: 'User-friendly connection name',
    example: 'Acme Well 001 RTU',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Optional description of the connection',
    example: 'Primary SCADA system for production monitoring',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'OPC-UA server endpoint URL',
    example: 'opc.tcp://192.168.1.100:4840',
  })
  @IsString()
  @IsNotEmpty()
  opcUaUrl!: string;

  @ApiProperty({
    description: 'OPC-UA security mode',
    enum: ['None', 'Sign', 'SignAndEncrypt'],
    example: 'SignAndEncrypt',
  })
  @IsString()
  @IsIn(['None', 'Sign', 'SignAndEncrypt'])
  securityMode!: 'None' | 'Sign' | 'SignAndEncrypt';

  @ApiProperty({
    description: 'OPC-UA security policy',
    enum: [
      'None',
      'Basic128Rsa15',
      'Basic256',
      'Basic256Sha256',
      'Aes128_Sha256_RsaOaep',
      'Aes256_Sha256_RsaPss',
    ],
    example: 'Basic256Sha256',
  })
  @IsString()
  @IsIn([
    'None',
    'Basic128Rsa15',
    'Basic256',
    'Basic256Sha256',
    'Aes128_Sha256_RsaOaep',
    'Aes256_Sha256_RsaPss',
  ])
  securityPolicy!:
    | 'None'
    | 'Basic128Rsa15'
    | 'Basic256'
    | 'Basic256Sha256'
    | 'Aes128_Sha256_RsaOaep'
    | 'Aes256_Sha256_RsaPss';

  @ApiProperty({
    description: 'OPC-UA username for authentication (optional)',
    example: 'opcua_user',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string;

  @ApiProperty({
    description: 'OPC-UA password for authentication (optional)',
    example: 'secure_password',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ValidateIf((o: CreateScadaConnectionDto) => o.username !== undefined)
  password?: string;

  @ApiProperty({
    description: 'Polling interval in seconds (1-300)',
    example: 5,
    minimum: 1,
    maximum: 300,
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  pollIntervalSeconds?: number;
}
