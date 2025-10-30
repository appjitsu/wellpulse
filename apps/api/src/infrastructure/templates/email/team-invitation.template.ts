/**
 * Team Invitation Template
 * Used for inviting new users to join an organization
 */

import { BaseTemplate } from '../base.template';

export interface TeamInvitationData {
  inviteeName?: string; // May be unknown if inviting by email only
  inviteeEmail: string;
  inviterName: string;
  inviterRole: string; // 'Manager', 'Admin', etc.
  organizationName: string;
  invitationToken: string;
  invitationUrl: string;
  roleAssigned: string; // 'Operator', 'Manager', 'Admin'
  expiresInDays: number;
  personalMessage?: string;
}

export class TeamInvitationTemplate extends BaseTemplate<TeamInvitationData> {
  getSubject(data: TeamInvitationData): string {
    return `You've been invited to join ${data.organizationName} on WellPulse`;
  }

  render(data: TeamInvitationData): string {
    const {
      inviteeName,
      inviterName,
      inviterRole,
      organizationName,
      invitationUrl,
      roleAssigned,
      expiresInDays,
      personalMessage,
    } = data;

    const greeting = inviteeName ? `Hello ${inviteeName}` : 'Hello';

    return `
${this.getEmailHeader()}

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px; font-weight: normal;">You're Invited!</h2>

              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5;">
                ${greeting}, <strong>${inviterName}</strong> (${inviterRole}) has invited you to join <strong>${organizationName}</strong> on WellPulse.
              </p>

              ${this.renderRoleInfo(roleAssigned)}
              ${this.renderPersonalMessage(personalMessage)}
              ${this.renderInvitationDetails(organizationName)}
              ${this.renderCTA(invitationUrl)}
              ${this.renderExpirationNotice(expiresInDays)}
            </td>
          </tr>

${this.getEmailFooter('This invitation was sent by a member of your organization. If you believe this was sent in error, you can safely ignore this email.')}
    `.trim();
  }

  private renderRoleInfo(roleAssigned: string): string {
    const roleDescriptions: Record<string, string> = {
      Operator:
        'Field operators can enter production data, upload photos, and track well activities.',
      Manager:
        'Managers have full access to production data, reports, and can manage team members.',
      Admin:
        'Administrators have complete system access including billing, settings, and user management.',
    };

    const roleDescription =
      roleDescriptions[roleAssigned] ||
      'You will have access to the WellPulse platform based on your assigned role.';

    return `
              <!-- Role Information -->
              <div style="background-color: #e7f3ff; border-left: 4px solid #0066cc; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 10px; color: #0066cc; font-size: 16px; font-weight: 600;">
                  Your Role: ${roleAssigned}
                </h3>
                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.5;">
                  ${roleDescription}
                </p>
              </div>
    `;
  }

  private renderPersonalMessage(personalMessage?: string): string {
    if (!personalMessage) return '';

    return `
              <!-- Personal Message -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6b7280;">
                <h3 style="margin: 0 0 10px; color: #333333; font-size: 15px; font-weight: 600;">
                  💬 Message from your inviter:
                </h3>
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6; font-style: italic;">
                  "${personalMessage}"
                </p>
              </div>
    `;
  }

  private renderInvitationDetails(organizationName: string): string {
    return `
              <!-- Platform Features -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px; color: #333333; font-size: 18px; font-weight: 600;">
                  What is WellPulse?
                </h3>
                <p style="margin: 0 0 15px; color: #666666; font-size: 14px; line-height: 1.5;">
                  WellPulse is a modern field data management platform used by ${organizationName} to:
                </p>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                  <li>Track production data in real-time from any device</li>
                  <li>Monitor well performance and identify issues quickly</li>
                  <li>Collaborate with team members and share field reports</li>
                  <li>Access historical data and generate compliance reports</li>
                  <li>Work offline in the field with automatic sync</li>
                </ul>
              </div>
    `;
  }

  private renderCTA(invitationUrl: string): string {
    return `
              <!-- Call to Action -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationUrl}" style="display: inline-block; padding: 16px 48px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold;">Accept Invitation</a>
              </div>
              <p style="text-align: center; margin: 10px 0 0; color: #999999; font-size: 13px;">
                Click the button above to create your account and get started
              </p>
    `;
  }

  private renderExpirationNotice(expiresInDays: number): string {
    return `
              <!-- Expiration Notice -->
              <div style="background-color: #fff9e6; border-left: 4px solid #f59e0b; padding: 15px; margin: 30px 0 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                  <strong>⏰ This invitation expires in ${expiresInDays} day${expiresInDays > 1 ? 's' : ''}.</strong> Accept soon to join your team on WellPulse.
                </p>
              </div>
    `;
  }
}
