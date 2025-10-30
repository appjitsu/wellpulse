/**
 * Password Reset Template
 * Used for sending password reset links
 */

import { BaseTemplate } from '../base.template';

export interface PasswordResetData {
  resetUrl: string;
}

export class PasswordResetTemplate extends BaseTemplate<PasswordResetData> {
  getSubject(): string {
    return 'Reset your WellPulse password';
  }

  render(data: PasswordResetData): string {
    const { resetUrl } = data;

    return `
${this.getEmailHeader()}

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

${this.getEmailFooter('For security reasons, this link will expire after 1 hour. If you need assistance, please contact our support team.')}
    `.trim();
  }
}
