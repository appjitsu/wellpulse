import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role for the user',
    enum: ['ADMIN', 'MANAGER', 'OPERATOR'],
    example: 'MANAGER',
  })
  @IsEnum(['ADMIN', 'MANAGER', 'OPERATOR'], {
    message: 'Role must be ADMIN, MANAGER, or OPERATOR',
  })
  @IsNotEmpty()
  role!: 'ADMIN' | 'MANAGER' | 'OPERATOR';
}
