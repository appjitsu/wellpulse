/**
 * Email Verification Template
 * Used for sending verification codes during user registration
 */

import { BaseTemplate } from '../base.template';

export interface EmailVerificationData {
  code: string;
  verificationUrl: string;
}

export class EmailVerificationTemplate extends BaseTemplate<EmailVerificationData> {
  getSubject(): string {
    return 'Verify your WellPulse account';
  }

  render(data: EmailVerificationData): string {
    const { code, verificationUrl } = data;

    return `
${this.getEmailHeader()}

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

${this.getEmailFooter("If you didn't create a WellPulse account, you can safely ignore this email.")}
    `.trim();
  }
}
