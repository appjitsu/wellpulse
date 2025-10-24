/**
 * Auth Types
 *
 * TypeScript interfaces for authentication API requests and responses.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
  requiresVerification: boolean;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  user: User;
}

export interface LogoutResponse {
  message: string;
}

export interface RefreshResponse {
  message: string;
  accessToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}
