/**
 * Weekly Production Summary Template
 * Used for sending weekly production reports to operators and managers
 */

import { BaseTemplate } from '../base.template';

export interface WellProductionData {
  wellName: string;
  apiNumber: string;
  oilProduction: number; // BBL
  gasProduction: number; // MCF
  waterProduction: number; // BBL
  averagePressure?: number; // PSI
  downtime?: number; // hours
  alerts?: number; // count
}

export interface WeeklyProductionSummaryData {
  recipientName: string;
  weekStartDate: string; // ISO date string
  weekEndDate: string; // ISO date string
  organizationName: string;
  totalOilProduction: number; // BBL
  totalGasProduction: number; // MCF
  totalWaterProduction: number; // BBL
  activeWellCount: number;
  totalWellCount: number;
  topPerformers: WellProductionData[]; // Top 5 wells by oil production
  alerts: Array<{
    wellName: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  comparisonToLastWeek?: {
    oilChange: number; // percentage
    gasChange: number; // percentage
    productionTrend: 'up' | 'down' | 'stable';
  };
}

export class WeeklyProductionSummaryTemplate extends BaseTemplate<WeeklyProductionSummaryData> {
  getSubject(data: WeeklyProductionSummaryData): string {
    const weekStart = new Date(data.weekStartDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const weekEnd = new Date(data.weekEndDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `Weekly Production Summary - ${weekStart} to ${weekEnd}`;
  }

  render(data: WeeklyProductionSummaryData): string {
    return `
${this.getEmailHeader()}

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 10px; color: #333333; font-size: 24px; font-weight: normal;">Weekly Production Summary</h2>

              <p style="margin: 0 0 20px; color: #666666; font-size: 14px;">
                ${this.formatDateRange(data.weekStartDate, data.weekEndDate)}
              </p>

              <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.5;">
                Hello ${data.recipientName}, here's your weekly production summary for ${data.organizationName}.
              </p>

              ${this.renderProductionSummary(data)}
              ${this.renderComparisonToLastWeek(data.comparisonToLastWeek)}
              ${this.renderTopPerformers(data.topPerformers)}
              ${this.renderAlerts(data.alerts)}
              ${this.renderCTA()}
            </td>
          </tr>

${this.getEmailFooter('You are receiving this weekly production summary as part of your WellPulse subscription.')}
    `.trim();
  }

  private formatDateRange(startDate: string, endDate: string): string {
    const start = new Date(startDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const end = new Date(endDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `${start} - ${end}`;
  }

  private renderProductionSummary(data: WeeklyProductionSummaryData): string {
    const utilizationRate = (
      (data.activeWellCount / data.totalWellCount) *
      100
    ).toFixed(1);

    return `
              <!-- Production Summary -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0;">
                <h3 style="margin: 0 0 20px; color: #333333; font-size: 18px; font-weight: 600;">Production Overview</h3>

                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; color: #666666; font-size: 14px; border-bottom: 1px solid #e0e0e0;">
                      <strong>Oil Production</strong>
                    </td>
                    <td style="padding: 12px 0; color: #333333; font-size: 18px; font-weight: 600; text-align: right; border-bottom: 1px solid #e0e0e0;">
                      ${data.totalOilProduction.toLocaleString()} BBL
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #666666; font-size: 14px; border-bottom: 1px solid #e0e0e0;">
                      <strong>Gas Production</strong>
                    </td>
                    <td style="padding: 12px 0; color: #333333; font-size: 18px; font-weight: 600; text-align: right; border-bottom: 1px solid #e0e0e0;">
                      ${data.totalGasProduction.toLocaleString()} MCF
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #666666; font-size: 14px; border-bottom: 1px solid #e0e0e0;">
                      <strong>Water Production</strong>
                    </td>
                    <td style="padding: 12px 0; color: #333333; font-size: 18px; font-weight: 600; text-align: right; border-bottom: 1px solid #e0e0e0;">
                      ${data.totalWaterProduction.toLocaleString()} BBL
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #666666; font-size: 14px;">
                      <strong>Active Wells</strong>
                    </td>
                    <td style="padding: 12px 0; color: #333333; font-size: 18px; font-weight: 600; text-align: right;">
                      ${data.activeWellCount} of ${data.totalWellCount} <span style="font-size: 14px; color: #666666;">(${utilizationRate}%)</span>
                    </td>
                  </tr>
                </table>
              </div>
    `;
  }

  private renderComparisonToLastWeek(
    comparison?: WeeklyProductionSummaryData['comparisonToLastWeek'],
  ): string {
    if (!comparison) return '';

    const trendIcon =
      comparison.productionTrend === 'up'
        ? '📈'
        : comparison.productionTrend === 'down'
          ? '📉'
          : '➡️';
    const trendText =
      comparison.productionTrend === 'up'
        ? 'Increasing'
        : comparison.productionTrend === 'down'
          ? 'Decreasing'
          : 'Stable';
    const trendColor =
      comparison.productionTrend === 'up'
        ? '#10b981'
        : comparison.productionTrend === 'down'
          ? '#ef4444'
          : '#6b7280';

    const oilChangeText =
      comparison.oilChange >= 0
        ? `+${comparison.oilChange.toFixed(1)}%`
        : `${comparison.oilChange.toFixed(1)}%`;
    const gasChangeText =
      comparison.gasChange >= 0
        ? `+${comparison.gasChange.toFixed(1)}%`
        : `${comparison.gasChange.toFixed(1)}%`;

    return `
              <!-- Comparison to Last Week -->
              <div style="background-color: #e7f3ff; border-left: 4px solid #0066cc; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 15px; color: #0066cc; font-size: 16px; font-weight: 600;">
                  ${trendIcon} Week-over-Week Comparison
                </h3>
                <table style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                      Oil Production:
                    </td>
                    <td style="padding: 8px 0; color: ${trendColor}; font-size: 14px; font-weight: 600; text-align: right;">
                      ${oilChangeText}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                      Gas Production:
                    </td>
                    <td style="padding: 8px 0; color: ${trendColor}; font-size: 14px; font-weight: 600; text-align: right;">
                      ${gasChangeText}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666666; font-size: 14px;">
                      Trend:
                    </td>
                    <td style="padding: 8px 0; color: ${trendColor}; font-size: 14px; font-weight: 600; text-align: right;">
                      ${trendText}
                    </td>
                  </tr>
                </table>
              </div>
    `;
  }

  private renderTopPerformers(topPerformers: WellProductionData[]): string {
    if (topPerformers.length === 0) return '';

    const rows = topPerformers
      .slice(0, 5)
      .map(
        (well, index) => `
                  <tr style="${index < topPerformers.length - 1 ? 'border-bottom: 1px solid #e0e0e0;' : ''}">
                    <td style="padding: 12px 0; color: #666666; font-size: 14px;">
                      <strong>${well.wellName}</strong><br />
                      <span style="font-size: 12px; color: #999999;">${well.apiNumber}</span>
                    </td>
                    <td style="padding: 12px 0; text-align: right;">
                      <div style="color: #333333; font-size: 16px; font-weight: 600;">${well.oilProduction.toLocaleString()} BBL</div>
                      <div style="color: #999999; font-size: 12px;">${well.gasProduction.toLocaleString()} MCF gas</div>
                    </td>
                  </tr>
    `,
      )
      .join('');

    return `
              <!-- Top Performers -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin: 20px 0;">
                <h3 style="margin: 0 0 20px; color: #333333; font-size: 18px; font-weight: 600;">🏆 Top Performing Wells</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  ${rows}
                </table>
              </div>
    `;
  }

  private renderAlerts(alerts: WeeklyProductionSummaryData['alerts']): string {
    if (alerts.length === 0) return '';

    const alertRows = alerts
      .slice(0, 5)
      .map((alert) => {
        const severityColor =
          alert.severity === 'high'
            ? '#ef4444'
            : alert.severity === 'medium'
              ? '#f59e0b'
              : '#6b7280';
        const severityIcon =
          alert.severity === 'high'
            ? '🚨'
            : alert.severity === 'medium'
              ? '⚠️'
              : 'ℹ️';

        return `
                  <tr style="border-bottom: 1px solid #e0e0e0;">
                    <td style="padding: 12px 0;">
                      <div style="color: ${severityColor}; font-size: 14px; font-weight: 600;">
                        ${severityIcon} ${alert.wellName}
                      </div>
                      <div style="color: #666666; font-size: 13px; margin-top: 4px;">
                        ${alert.message}
                      </div>
                    </td>
                  </tr>
        `;
      })
      .join('');

    return `
              <!-- Alerts -->
              <div style="background-color: #fff9e6; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 15px; color: #92400e; font-size: 16px; font-weight: 600;">
                  Alerts & Notifications (${alerts.length})
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                  ${alertRows}
                </table>
                ${alerts.length > 5 ? `<p style="margin: 15px 0 0; color: #92400e; font-size: 13px;">+ ${alerts.length - 5} more alerts</p>` : ''}
              </div>
    `;
  }

  private renderCTA(): string {
    return `
              <!-- Call to Action -->
              <div style="text-align: center; margin: 30px 0 10px;">
                <a href="https://app.wellpulse.io/dashboard" style="display: inline-block; padding: 14px 40px; background-color: #0066cc; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">View Full Report</a>
              </div>
              <p style="text-align: center; margin: 10px 0 0; color: #999999; font-size: 13px;">
                Log in to WellPulse to see detailed analytics and well-by-well breakdowns
              </p>
    `;
  }
}
