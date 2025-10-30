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
import {
  FieldEntryReportTemplate,
  FieldEntryReportData,
} from '../templates/email/field-entry-report.template';
import {
  EmailVerificationTemplate,
  EmailVerificationData,
} from '../templates/email/email-verification.template';
import {
  PasswordResetTemplate,
  PasswordResetData,
} from '../templates/email/password-reset.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    // Initialize nodemailer transporter with SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true', // true for 465, false for other ports
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

    // Prepare template data
    const templateData: EmailVerificationData = {
      code,
      verificationUrl,
    };

    // Render email using template
    const template = new EmailVerificationTemplate();
    const htmlContent = template.render(templateData);
    const subject = template.getSubject();

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject,
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

    // Prepare template data
    const templateData: PasswordResetData = {
      resetUrl,
    };

    // Render email using template
    const template = new PasswordResetTemplate();
    const htmlContent = template.render(templateData);
    const subject = template.getSubject();

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: email,
        subject,
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
   * Send field entry photos via email with attachments
   *
   * @param recipientEmails - Array of recipient email addresses
   * @param photos - Array of photo URIs
   * @param senderName - Name of the field operator sending the photos
   * @param wellName - Optional well name for context
   * @param entryData - Optional field entry data (production, pressure, etc.)
   * @param checklist - Optional checklist items
   */
  async sendFieldEntryPhotos(
    recipientEmails: string[],
    photos: Array<{ localUri: string; remoteUrl?: string }>,
    senderName: string,
    wellName?: string,
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
    },
    checklist?: Array<{ label: string; checked: boolean }>,
  ): Promise<void> {
    // Prepare template data
    const templateData: FieldEntryReportData = {
      senderName,
      wellName,
      photoCount: photos.length,
      entryData,
      checklist,
    };

    // Render email using template
    const template = new FieldEntryReportTemplate();
    const htmlContent = template.render(templateData);
    const subject = template.getSubject(templateData);

    try {
      // Download photos and create attachments
      const attachments = await this.createPhotoAttachments(photos);

      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: recipientEmails.join(', '),
        subject,
        html: htmlContent,
        attachments,
      });

      this.logger.log(
        `Field entry photos email sent to ${recipientEmails.length} recipient(s) with ${attachments.length} attachment(s)`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send field entry photos email: ${errorMessage}`,
        errorStack,
      );
      throw error; // Throw to let caller know the email failed
    }
  }

  /**
   * Create photo attachments from URIs
   * Downloads photos from remoteUrl or converts base64 localUri to buffer
   */
  private async createPhotoAttachments(
    photos: Array<{ localUri: string; remoteUrl?: string }>,
  ): Promise<
    Array<{ filename: string; content: Buffer; contentType: string }>
  > {
    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }> = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        let photoBuffer: Buffer;

        if (photo.remoteUrl) {
          // Download from remote URL
          const response = await fetch(photo.remoteUrl);
          if (!response.ok) {
            this.logger.warn(
              `Failed to download photo from ${photo.remoteUrl}`,
            );
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          photoBuffer = Buffer.from(arrayBuffer);
        } else if (photo.localUri.startsWith('data:')) {
          // Extract base64 data from data URI
          const matches = photo.localUri.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            photoBuffer = Buffer.from(matches[2], 'base64');
          } else {
            this.logger.warn(`Invalid data URI format for photo ${i + 1}`);
            continue;
          }
        } else if (photo.localUri.startsWith('http')) {
          // Download from HTTP URL
          const response = await fetch(photo.localUri);
          if (!response.ok) {
            this.logger.warn(`Failed to download photo from ${photo.localUri}`);
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          photoBuffer = Buffer.from(arrayBuffer);
        } else {
          // Assume it's a file path (for Electron app)
          // Skip for now as we can't access local file system from API
          this.logger.warn(`Skipping local file path: ${photo.localUri}`);
          continue;
        }

        attachments.push({
          filename: `photo-${i + 1}.jpg`,
          content: photoBuffer,
          contentType: 'image/jpeg',
        });
      } catch (error) {
        this.logger.warn(
          `Failed to process photo ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Continue with other photos
      }
    }

    return attachments;
  }
}
