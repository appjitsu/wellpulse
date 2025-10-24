/**
 * Forgot Password DTO
 *
 * Request body for forgot password endpoint.
 */

import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
