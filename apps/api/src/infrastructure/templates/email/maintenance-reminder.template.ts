/**
 * Maintenance Reminder Template
 * Used for sending equipment maintenance reminders to operators
 */

import { BaseTemplate } from '../base.template';

export interface MaintenanceItem {
  equipmentName: string;
  equipmentType: string; // 'pump', 'compressor', 'separator', 'tank', 'valve', 'meter'
  wellName?: string;
  maintenanceType: string; // 'Routine Inspection', 'Oil Change', 'Filter Replacement', etc.
  dueDate: string; // ISO date string
  lastMaintenance?: string; // ISO date string
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration?: string; // '2 hours', '1 day', etc.
  notes?: string;
}

export interface MaintenanceReminderData {
  recipientName: string;
  maintenanceItems: MaintenanceItem[];
  organizationName: string;
  overdueCount: number;
  upcomingCount: number;
}

export class MaintenanceReminderTemplate extends BaseTemplate<MaintenanceReminderData> {
  getSubject(data: MaintenanceReminderData): string {
    if (data.overdueCount > 0) {
      return `⚠️ ${data.overdueCount} Overdue Maintenance Item${data.overdueCount > 1 ? 's' : ''} - Action Required`;
    }
    return `Upcoming Maintenance Reminders (${data.maintenanceItems.length} item${data.maintenanceItems.length > 1 ? 's' : ''})`;
  }

  render(data: MaintenanceReminderData): string {
    const { recipientName, maintenanceItems, overdueCount, upcomingCount } =
      data;

    return `
${this.getEmailHeader()}

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px; font-weight: normal;">Maintenance Reminders</h2>

              <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.5;">
                Hello ${recipientName}, you have ${maintenanceItems.length} maintenance item${maintenanceItems.length > 1 ? 's' : ''} that require${maintenanceItems.length === 1 ? 's' : ''} attention.
              </p>

              ${this.renderSummaryBanner(overdueCount, upcomingCount)}
              ${this.renderMaintenanceItems(maintenanceItems)}
              ${this.renderBestPractices()}
              ${this.renderCTA()}
            </td>
          </tr>

${this.getEmailFooter('You are receiving this maintenance reminder to help ensure optimal equipment performance and safety.')}
    `.trim();
  }

  private renderSummaryBanner(
    overdueCount: number,
    upcomingCount: number,
  ): string {
    if (overdueCount === 0 && upcomingCount === 0) return '';

    const hasCritical = overdueCount > 0;
    const bannerColor = hasCritical ? '#fef2f2' : '#e7f3ff';
    const borderColor = hasCritical ? '#ef4444' : '#0066cc';
    const textColor = hasCritical ? '#991b1b' : '#1e40af';
    const icon = hasCritical ? '🚨' : '📅';

    return `
              <!-- Summary Banner -->
              <div style="background-color: ${bannerColor}; border-left: 4px solid ${borderColor}; padding: 20px; margin: 0 0 30px; border-radius: 4px;">
                <h3 style="margin: 0 0 10px; color: ${textColor}; font-size: 16px; font-weight: 600;">
                  ${icon} Maintenance Summary
                </h3>
                <table style="width: 100%;">
                  ${
                    overdueCount > 0
                      ? `
                  <tr>
                    <td style="padding: 5px 0; color: ${textColor}; font-size: 14px;">
                      <strong>Overdue:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #ef4444; font-size: 16px; font-weight: 600; text-align: right;">
                      ${overdueCount} item${overdueCount > 1 ? 's' : ''}
                    </td>
                  </tr>
                  `
                      : ''
                  }
                  ${
                    upcomingCount > 0
                      ? `
                  <tr>
                    <td style="padding: 5px 0; color: ${textColor}; font-size: 14px;">
                      <strong>Due Soon:</strong>
                    </td>
                    <td style="padding: 5px 0; color: #f59e0b; font-size: 16px; font-weight: 600; text-align: right;">
                      ${upcomingCount} item${upcomingCount > 1 ? 's' : ''}
                    </td>
                  </tr>
                  `
                      : ''
                  }
                </table>
              </div>
    `;
  }

  private renderMaintenanceItems(items: MaintenanceItem[]): string {
    const itemsHtml = items
      .map((item) => this.renderMaintenanceItem(item))
      .join('');

    return `
              <!-- Maintenance Items -->
              <div style="margin: 20px 0;">
                ${itemsHtml}
              </div>
    `;
  }

  private renderMaintenanceItem(item: MaintenanceItem): string {
    const isOverdue = new Date(item.dueDate) < new Date();
    const dueDate = new Date(item.dueDate);
    const formattedDueDate = dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const priorityConfig = this.getPriorityConfig(item.priority, isOverdue);
    const equipmentIcon = this.getEquipmentIcon(item.equipmentType);

    return `
              <!-- Maintenance Item -->
              <div style="background-color: #f8f9fa; border-left: 4px solid ${priorityConfig.color}; padding: 20px; margin: 0 0 15px; border-radius: 4px;">
                <table style="width: 100%;">
                  <tr>
                    <td style="vertical-align: top;">
                      <div style="color: #333333; font-size: 16px; font-weight: 600; margin-bottom: 8px;">
                        ${equipmentIcon} ${item.equipmentName}
                      </div>
                      <div style="color: #666666; font-size: 14px; margin-bottom: 4px;">
                        <strong>Type:</strong> ${item.maintenanceType}
                      </div>
                      ${item.wellName ? `<div style="color: #666666; font-size: 13px; margin-bottom: 4px;"><strong>Location:</strong> ${item.wellName}</div>` : ''}
                      ${item.estimatedDuration ? `<div style="color: #666666; font-size: 13px; margin-bottom: 4px;"><strong>Duration:</strong> ${item.estimatedDuration}</div>` : ''}
                      ${item.lastMaintenance ? `<div style="color: #999999; font-size: 12px; margin-top: 8px;">Last maintained: ${new Date(item.lastMaintenance).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>` : ''}
                      ${item.notes ? `<div style="color: #666666; font-size: 13px; margin-top: 8px; padding: 10px; background-color: #ffffff; border-radius: 4px;"><strong>Notes:</strong> ${item.notes}</div>` : ''}
                    </td>
                    <td style="vertical-align: top; text-align: right; width: 120px;">
                      <div style="background-color: ${priorityConfig.bgColor}; color: ${priorityConfig.color}; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">
                        ${priorityConfig.label}
                      </div>
                      <div style="color: ${isOverdue ? '#ef4444' : '#666666'}; font-size: 14px; font-weight: ${isOverdue ? '600' : '500'};">
                        ${isOverdue ? 'Overdue' : 'Due'}
                      </div>
                      <div style="color: ${isOverdue ? '#ef4444' : '#333333'}; font-size: 13px; font-weight: ${isOverdue ? '600' : '400'};">
                        ${formattedDueDate}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
    `;
  }

  private getPriorityConfig(
    priority: MaintenanceItem['priority'],
    isOverdue: boolean,
  ): { color: string; bgColor: string; label: string } {
    if (isOverdue || priority === 'critical') {
      return {
        color: '#ef4444',
        bgColor: '#fef2f2',
        label: 'Critical',
      };
    }

    switch (priority) {
      case 'high':
        return {
          color: '#f59e0b',
          bgColor: '#fffbeb',
          label: 'High',
        };
      case 'medium':
        return {
          color: '#3b82f6',
          bgColor: '#eff6ff',
          label: 'Medium',
        };
      case 'low':
        return {
          color: '#10b981',
          bgColor: '#f0fdf4',
          label: 'Low',
        };
      default:
        return {
          color: '#6b7280',
          bgColor: '#f9fafb',
          label: 'Normal',
        };
    }
  }

  private getEquipmentIcon(equipmentType: string): string {
    const icons: Record<string, string> = {
      pump: '⚙️',
      compressor: '🔧',
      separator: '⚗️',
      tank: '🛢️',
      valve: '🔩',
      meter: '📊',
    };
    return icons[equipmentType.toLowerCase()] || '🔧';
  }

  private renderBestPractices(): string {
    return `
              <!-- Best Practices -->
              <div style="background-color: #e7f3ff; border-left: 4px solid #0066cc; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 15px; color: #1e40af; font-size: 16px; font-weight: 600;">
                  💡 Maintenance Best Practices
                </h3>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #334155; font-size: 14px; line-height: 1.8;">
                  <li>Complete maintenance tasks before the due date to prevent equipment failure</li>
                  <li>Document all maintenance activities in WellPulse for compliance tracking</li>
                  <li>Keep spare parts inventory up to date for critical equipment</li>
                  <li>Report any unusual equipment behavior immediately</li>
                </ul>
              </div>
    `;
  }

  private renderCTA(): string {
    return `
              <!-- Call to Action -->
              <div style="text-align: center; margin: 30px 0 10px;">
                <a href="https://app.wellpulse.io/maintenance" style="display: inline-block; padding: 14px 40px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">View Maintenance Schedule</a>
              </div>
              <p style="text-align: center; margin: 10px 0 0; color: #999999; font-size: 13px;">
                Log in to WellPulse to mark items as complete and schedule technicians
              </p>
    `;
  }
}
