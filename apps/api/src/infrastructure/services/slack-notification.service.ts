/**
 * Slack Notification Service
 *
 * Sends notifications to Slack channels for important events:
 * - Tenant creation (with secret credentials)
 * - Tenant secret rotation
 * - System alerts
 *
 * Uses Slack Incoming Webhooks for simple, secure notifications.
 */

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface TenantCreatedNotification {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  tenantSecret: string;
  contactEmail: string;
  subscriptionTier: string;
  createdBy?: string;
}

export interface SecretRotatedNotification {
  tenantId: string;
  tenantName: string;
  newSecret: string;
  rotatedBy: string;
  reason?: string;
}

@Injectable()
export class SlackNotificationService {
  private readonly logger = new Logger(SlackNotificationService.name);
  private readonly webhookUrl: string | undefined;
  private readonly enabled: boolean;

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.enabled = !!this.webhookUrl;

    if (!this.enabled) {
      this.logger.warn(
        'Slack notifications disabled: SLACK_WEBHOOK_URL not configured',
      );
    }
  }

  /**
   * Send notification when new tenant is created
   * Includes tenant secret (sent ONLY via Slack, never logged)
   */
  async notifyTenantCreated(data: TenantCreatedNotification): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug('Slack disabled, skipping tenant created notification');
      return false;
    }

    try {
      const message = {
        text: '🎉 New Tenant Created',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🎉 New Tenant Created',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Tenant Name:*\n${data.tenantName}`,
              },
              {
                type: 'mrkdwn',
                text: `*Subdomain:*\n${data.subdomain}.wellpulse.app`,
              },
              {
                type: 'mrkdwn',
                text: `*Contact Email:*\n${data.contactEmail}`,
              },
              {
                type: 'mrkdwn',
                text: `*Subscription:*\n${data.subscriptionTier}`,
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🔐 Credentials (Mobile/Desktop Apps)*`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Tenant ID:*\n\`${data.tenantId}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Tenant Secret:*\n\`${data.tenantSecret}\``,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '⚠️ *IMPORTANT:* Store tenant secret securely - it will never be shown again!',
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: data.createdBy
                  ? `Created by: ${data.createdBy}`
                  : 'Created via API',
              },
            ],
          },
        ],
      };

      await this.sendToSlack(message);
      this.logger.log(
        `Sent tenant created notification to Slack: ${data.tenantName}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to send Slack notification', error);
      return false;
    }
  }

  /**
   * Send notification when tenant secret is rotated
   */
  async notifySecretRotated(data: SecretRotatedNotification): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug(
        'Slack disabled, skipping secret rotation notification',
      );
      return false;
    }

    try {
      const message = {
        text: '🔄 Tenant Secret Rotated',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔄 Tenant Secret Rotated',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Tenant:*\n${data.tenantName}`,
              },
              {
                type: 'mrkdwn',
                text: `*Tenant ID:*\n\`${data.tenantId}\``,
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🔐 New Tenant Secret:*\n\`${data.newSecret}\``,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '⚠️ Old secret has been invalidated. Update all mobile/desktop apps with new secret.',
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Rotated by: ${data.rotatedBy}${data.reason ? ` | Reason: ${data.reason}` : ''}`,
              },
            ],
          },
        ],
      };

      await this.sendToSlack(message);
      this.logger.log(
        `Sent secret rotation notification to Slack: ${data.tenantName}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to send Slack notification', error);
      return false;
    }
  }

  /**
   * Send generic alert to Slack
   */
  async sendAlert(
    title: string,
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
  ): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const emoji =
        level === 'error' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
      const color =
        level === 'error'
          ? '#FF0000'
          : level === 'warning'
            ? '#FFA500'
            : '#0066CC';

      const slackMessage = {
        text: `${emoji} ${title}`,
        attachments: [
          {
            color,
            text: message,
            footer: 'WellPulse API',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      await this.sendToSlack(slackMessage);
      return true;
    } catch (error) {
      this.logger.error('Failed to send Slack alert', error);
      return false;
    }
  }

  /**
   * Send message to Slack webhook
   */
  private async sendToSlack(message: unknown): Promise<void> {
    if (!this.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    await axios.post(this.webhookUrl, message, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000, // 5 second timeout
    });
  }

  /**
   * Check if Slack notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
