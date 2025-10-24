/**
 * Email Service
 *
 * Handles sending transactional emails for authentication flows.
 * Uses nodemailer with SMTP configuration.
 *
 * In development: Uses Mailpit (localhost:1025)
 * In production: Uses production SMTP provider (e.g., SendGrid, AWS SES)
 *
 * Features:
 * - Professional HTML email templates with inline CSS
 * - Error handling with graceful fallback
 * - Comprehensive logging
 * - Environment-based URL generation
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    // Initialize nodemailer transporter with SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE', false), // true for 465, false for other ports
      auth:
        this.configService.get<string>('SMTP_USER') &&
        this.configService.get<string>('SMTP_PASS')
          ? {
              user: this.configService.get<string>('SMTP_USER'),
              pass: this.configService.get<string>('SMTP_PASS'),
            }
          : undefined,
    });

    this.logger.log('Email service initialized');
  }

  /**
   * Send email verification code
   *
   * @param email - User's email address
   * @param code - 6-digit verification code
   * @param tenantSlug - Tenant slug for URL generation
   */
  async sendVerificationEmail(
    email: string,
    code: string,
    tenantSlug: string,
  ): Promise<void> {
    const verificationUrl = `https://${tenantSlug}.wellpulse.app/verify-email?email=${encodeURIComponent(email)}&code=${code}`;

    const htmlContent = this.createVerificationEmailTemplate(
      code,
      verificationUrl,
    );

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject: 'Verify your WellPulse account',
        html: htmlContent,
      });

      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      // Log error but don't throw - email failures shouldn't break auth flow
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send verification email to ${email}: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Send password reset email
   *
   * @param email - User's email address
   * @param token - Password reset token
   * @param tenantSlug - Tenant slug for URL generation
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    tenantSlug: string,
  ): Promise<void> {
    const resetUrl = `https://${tenantSlug}.wellpulse.app/reset-password?token=${token}`;

    const htmlContent = this.createPasswordResetEmailTemplate(resetUrl);

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject: 'Reset your WellPulse password',
        html: htmlContent,
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      // Log error but don't throw - email failures shouldn't break auth flow
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send password reset email to ${email}: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Create verification email HTML template
   * Uses inline CSS for email client compatibility
   */
  private createVerificationEmailTemplate(
    code: string,
    verificationUrl: string,
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your WellPulse account</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #0066cc;">
              <h1 style="margin: 0; color: #0066cc; font-size: 28px; font-weight: bold;">WellPulse</h1>
              <p style="margin: 10px 0 0; color: #666666; font-size: 14px;">Field Data Management Platform</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px; font-weight: normal;">Welcome to WellPulse!</h2>

              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5;">
                Thank you for signing up. To complete your registration, please verify your email address using the code below:
              </p>

              <!-- Verification Code -->
              <div style="background-color: #f8f9fa; border: 2px solid #0066cc; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <div style="color: #666666; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Verification Code</div>
                <div style="font-size: 36px; font-weight: bold; color: #0066cc; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</div>
              </div>

              <p style="margin: 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                Or click the button below to verify your email:
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Verify Email</a>
              </div>

              <p style="margin: 20px 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                This verification code will expire in <strong>24 hours</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                If you didn't create a WellPulse account, you can safely ignore this email.
              </p>
              <p style="margin: 15px 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} WellPulse. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Create password reset email HTML template
   * Uses inline CSS for email client compatibility
   */
  private createPasswordResetEmailTemplate(resetUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your WellPulse password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #0066cc;">
              <h1 style="margin: 0; color: #0066cc; font-size: 28px; font-weight: bold;">WellPulse</h1>
              <p style="margin: 10px 0 0; color: #666666; font-size: 14px;">Field Data Management Platform</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px; font-weight: normal;">Password Reset Request</h2>

              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5;">
                We received a request to reset your WellPulse password. Click the button below to create a new password:
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Reset Password</a>
              </div>

              <p style="margin: 20px 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                This password reset link will expire in <strong>1 hour</strong> for security reasons.
              </p>

              <!-- Security Notice -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                  <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
              </div>

              <p style="margin: 20px 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; color: #0066cc; font-size: 12px; word-break: break-all;">
                ${resetUrl}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                For security reasons, this link will expire after 1 hour. If you need assistance, please contact our support team.
              </p>
              <p style="margin: 15px 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} WellPulse. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
