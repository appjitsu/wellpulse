/**
 * Alert Notification Service
 *
 * Sends alert notifications to users via email (and optionally SMS in the future).
 * Handles different alert types and severity levels with appropriate notification channels.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alert, AlertSeverity } from '../../../domain/alert/alert.entity';
import { EmailService } from '../../../infrastructure/services/email.service';

/**
 * Notification Preferences
 * In production, this would come from user settings in the database.
 */
export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  criticalOnly: boolean; // Only notify for critical alerts
  recipientEmails: string[];
  recipientPhones?: string[];
}

/**
 * Alert Notification Service
 *
 * Business Rules:
 * - Critical alerts are sent immediately
 * - Warning alerts can be batched (future enhancement)
 * - Info alerts are typically not sent (dashboard only)
 * - Notifications respect user preferences
 * - Failed notifications are logged but don't block the system
 */
@Injectable()
export class AlertNotificationService {
  private readonly logger = new Logger(AlertNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sends notification for a single alert.
   *
   * @param alert - The alert to send notification for
   * @param preferences - User notification preferences
   */
  sendAlertNotification(
    alert: Alert,
    preferences: NotificationPreferences,
  ): void {
    // Check if notifications are enabled
    if (!preferences.emailEnabled && !preferences.smsEnabled) {
      return;
    }

    // Check if we should skip based on severity preferences
    if (preferences.criticalOnly && !alert.isCritical()) {
      return;
    }

    // Check if alert severity warrants notification (skip info alerts by default)
    if (alert.severity === 'info') {
      return;
    }

    try {
      // Send email notification
      if (preferences.emailEnabled && preferences.recipientEmails.length > 0) {
        this.sendEmailNotification(alert, preferences.recipientEmails);
      }

      // SMS notification (future enhancement)
      if (
        preferences.smsEnabled &&
        preferences.recipientPhones &&
        preferences.recipientPhones.length > 0
      ) {
        this.sendSmsNotification(alert, preferences.recipientPhones);
      }

      this.logger.log(
        `Notification sent for alert ${alert.id} (severity: ${alert.severity})`,
      );
    } catch (error) {
      // Log error but don't throw - notification failures shouldn't break alert creation
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to send notification for alert ${alert.id}: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Sends notifications for multiple alerts (batch).
   * Useful for digest emails or batch processing.
   *
   * @param alerts - Array of alerts to send notifications for
   * @param preferences - User notification preferences
   */
  sendBatchNotifications(
    alerts: Alert[],
    preferences: NotificationPreferences,
  ): void {
    if (alerts.length === 0) {
      return;
    }

    // Send individual notifications for each alert
    // Future enhancement: Group into a single digest email
    for (const alert of alerts) {
      this.sendAlertNotification(alert, preferences);
    }
  }

  /**
   * Sends an email notification for an alert.
   *
   * @private
   */
  private sendEmailNotification(alert: Alert, recipientEmails: string[]): void {
    const subject = this.getEmailSubject(alert);
    const htmlContent = this.getEmailContent(alert);

    // For now, log that we would send an email
    // In production, we'd extend EmailService with a sendGenericEmail method
    this.logger.log(
      `Email notification would be sent to ${recipientEmails.join(', ')}`,
    );
    this.logger.log(`Subject: ${subject}`);
    this.logger.log(`Content: ${htmlContent.substring(0, 200)}...`);

    // TODO: Extend EmailService with sendGenericEmail method
    // await this.emailService.sendGenericEmail({
    //   to: recipientEmails,
    //   subject,
    //   html: htmlContent,
    // });
  }

  /**
   * Sends an SMS notification for an alert.
   * Placeholder for future SMS integration (Twilio, AWS SNS, etc.)
   *
   * @private
   */
  private sendSmsNotification(alert: Alert, recipientPhones: string[]): void {
    // TODO: Implement SMS notifications using Twilio or AWS SNS
    this.logger.log(
      `SMS notification would be sent to ${recipientPhones.join(', ')} for alert ${alert.id}`,
    );
  }

  /**
   * Generates email subject line for an alert.
   *
   * @private
   */
  private getEmailSubject(alert: Alert): string {
    const severityEmoji = this.getSeverityEmoji(alert.severity);

    switch (alert.alertType) {
      case 'nominal_range_violation':
        return `${severityEmoji} ${alert.severity.toUpperCase()}: ${alert.fieldName} out of range`;
      case 'well_down':
        return `${severityEmoji} CRITICAL: Well Down`;
      case 'equipment_failure':
        return `${severityEmoji} ${alert.severity.toUpperCase()}: Equipment Failure`;
      case 'high_downtime':
        return `${severityEmoji} WARNING: High Downtime Detected`;
      case 'system':
        return `${severityEmoji} ${alert.severity.toUpperCase()}: System Alert`;
      default:
        return `${severityEmoji} ${alert.severity.toUpperCase()}: Alert`;
    }
  }

  /**
   * Generates HTML email content for an alert.
   *
   * @private
   */
  private getEmailContent(alert: Alert): string {
    const severityColor = this.getSeverityColor(alert.severity);
    const dashboardUrl =
      this.configService.get<string>('APP_URL') || 'https://wellpulse.app';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${severityColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${this.getSeverityEmoji(alert.severity)} ${alert.severity.toUpperCase()} Alert</h1>
            </div>
            <div class="content">
              <p><strong>${alert.message}</strong></p>

              <div class="details">
                <p><span class="label">Alert Type:</span> <span class="value">${this.formatAlertType(alert.alertType)}</span></p>
                <p><span class="label">Severity:</span> <span class="value">${alert.severity}</span></p>
                <p><span class="label">Created:</span> <span class="value">${alert.createdAt.toLocaleString()}</span></p>

                ${alert.wellId ? `<p><span class="label">Well ID:</span> <span class="value">${alert.wellId}</span></p>` : ''}

                ${
                  alert.fieldName &&
                  alert.actualValue !== null &&
                  alert.actualValue !== undefined
                    ? `
                  <p><span class="label">Field:</span> <span class="value">${alert.fieldName}</span></p>
                  <p><span class="label">Actual Value:</span> <span class="value">${alert.actualValue}</span></p>
                  ${alert.expectedMin !== null && alert.expectedMin !== undefined ? `<p><span class="label">Expected Min:</span> <span class="value">${alert.expectedMin}</span></p>` : ''}
                  ${alert.expectedMax !== null && alert.expectedMax !== undefined ? `<p><span class="label">Expected Max:</span> <span class="value">${alert.expectedMax}</span></p>` : ''}
                `
                    : ''
                }
              </div>

              <p>Please review this alert in your dashboard and take appropriate action.</p>

              <a href="${dashboardUrl}/dashboard/alerts/${alert.id}" class="button">View Alert Details</a>
            </div>

            <div class="footer">
              <p>This is an automated notification from WellPulse. Do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} WellPulse. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Gets emoji for alert severity.
   *
   * @private
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  }

  /**
   * Gets color for alert severity (for email styling).
   *
   * @private
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '#dc3545'; // Red
      case 'warning':
        return '#ffc107'; // Yellow
      case 'info':
        return '#17a2b8'; // Blue
      default:
        return '#6c757d'; // Gray
    }
  }

  /**
   * Formats alert type for display.
   *
   * @private
   */
  private formatAlertType(alertType: string): string {
    return alertType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
