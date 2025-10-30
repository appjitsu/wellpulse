/**
 * Field Entry Report Email Template
 * Used when sharing field data and photos via email
 */

import { BaseTemplate } from '../base.template';

export interface FieldEntryReportData {
  senderName: string;
  wellName?: string;
  photoCount: number;
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
  };
  checklist?: Array<{
    label: string;
    checked: boolean;
  }>;
}

export class FieldEntryReportTemplate extends BaseTemplate<FieldEntryReportData> {
  getSubject(data: FieldEntryReportData): string {
    return data.wellName
      ? `Field Entry Report - ${data.wellName}`
      : 'Field Entry Report';
  }

  render(data: FieldEntryReportData): string {
    const { senderName, wellName, photoCount, entryData, checklist } = data;

    return `
${this.getEmailHeader()}

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px; font-weight: normal;">Field Entry Report</h2>

              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.5;">
                ${senderName} has shared a field entry report with you${wellName ? ` for <strong>${wellName}</strong>` : ''}. This report includes ${photoCount} photo${photoCount > 1 ? 's' : ''} and field data captured during the inspection.
              </p>

              ${this.renderWellInfo(wellName)}
              ${this.renderEntryData(entryData)}
              ${this.renderChecklist(checklist)}
              ${this.renderPhotoNotice(photoCount)}
            </td>
          </tr>

${this.getEmailFooter(`You received this email because ${senderName} shared field entry data with you through WellPulse.`)}
    `.trim();
  }

  private renderWellInfo(wellName?: string): string {
    if (!wellName) return '';

    return `
              <div style="background-color: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #0066cc; font-size: 16px; font-weight: 600;">
                  <strong>Well:</strong> ${wellName}
                </p>
              </div>
    `;
  }

  private renderEntryData(
    entryData?: FieldEntryReportData['entryData'],
  ): string {
    if (!entryData) return '';

    const hasData =
      entryData.productionVolume !== undefined ||
      entryData.gasVolume !== undefined ||
      entryData.pressure !== undefined ||
      entryData.temperature !== undefined ||
      entryData.waterCut !== undefined;

    if (!hasData && !entryData.notes && !entryData.latitude) return '';

    return `
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px; color: #333333; font-size: 18px; font-weight: 600;">Field Entry Data</h3>

        ${this.renderRecordedTime(entryData.recordedAt)}
        ${this.renderDataTable(entryData)}
        ${this.renderGPS(entryData.latitude, entryData.longitude)}
        ${this.renderNotes(entryData.notes)}
      </div>
    `;
  }

  private renderRecordedTime(recordedAt?: string): string {
    if (!recordedAt) return '';

    const formattedDate = new Date(recordedAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return `
        <p style="margin: 0 0 15px; color: #666666; font-size: 14px;">
          <strong>Recorded:</strong> ${formattedDate}
        </p>
    `;
  }

  private renderDataTable(
    entryData: FieldEntryReportData['entryData'],
  ): string {
    if (!entryData) return '';

    const rows: string[] = [];

    if (entryData.productionVolume !== undefined) {
      rows.push(
        this.renderTableRow(
          'Oil Production:',
          `${entryData.productionVolume} BBL`,
        ),
      );
    }
    if (entryData.gasVolume !== undefined) {
      rows.push(
        this.renderTableRow('Gas Volume:', `${entryData.gasVolume} MCF`),
      );
    }
    if (entryData.pressure !== undefined) {
      rows.push(this.renderTableRow('Pressure:', `${entryData.pressure} PSI`));
    }
    if (entryData.temperature !== undefined) {
      rows.push(
        this.renderTableRow('Temperature:', `${entryData.temperature}°F`),
      );
    }
    if (entryData.waterCut !== undefined) {
      rows.push(
        this.renderTableRow('Water Cut:', `${entryData.waterCut}%`, true),
      );
    }

    if (rows.length === 0) return '';

    return `
        <table style="width: 100%; border-collapse: collapse;">
          ${rows.join('\n')}
        </table>
    `;
  }

  private renderTableRow(
    label: string,
    value: string,
    isLast: boolean = false,
  ): string {
    const borderStyle = isLast ? '' : 'border-bottom: 1px solid #e0e0e0;';
    return `
          <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px; ${borderStyle}"><strong>${label}</strong></td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right; ${borderStyle}">${value}</td>
          </tr>
    `;
  }

  private renderGPS(latitude?: number, longitude?: number): string {
    if (latitude === undefined || longitude === undefined) return '';

    return `
        <p style="margin: 15px 0 0; color: #666666; font-size: 13px;">
          <strong>GPS Location:</strong> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
        </p>
    `;
  }

  private renderNotes(notes?: string): string {
    if (!notes) return '';

    return `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0 0 5px; color: #666666; font-size: 14px; font-weight: 600;">Notes:</p>
          <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.5;">${notes}</p>
        </div>
    `;
  }

  private renderChecklist(
    checklist?: FieldEntryReportData['checklist'],
  ): string {
    if (!checklist || checklist.length === 0) return '';

    const items = checklist
      .map((item) => this.renderChecklistItem(item.label, item.checked))
      .join('\n');

    return `
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px; color: #333333; font-size: 18px; font-weight: 600;">Daily Checklist</h3>
        <table style="width: 100%;">
          ${items}
        </table>
      </div>
    `;
  }

  private renderChecklistItem(label: string, checked: boolean): string {
    const checkboxBgColor = checked ? '#10b981' : '#ffffff';
    const checkboxBorderColor = checked ? '#10b981' : '#d1d5db';
    const checkmark = checked ? '✓' : '';
    const textColor = checked ? '#333333' : '#999999';

    return `
          <tr>
            <td style="padding: 6px 0;">
              <span style="display: inline-block; width: 18px; height: 18px; border: 2px solid ${checkboxBorderColor}; background-color: ${checkboxBgColor}; border-radius: 3px; text-align: center; line-height: 14px; color: #ffffff; font-size: 12px; font-weight: bold; margin-right: 8px; vertical-align: middle;">
                ${checkmark}
              </span>
              <span style="color: ${textColor}; font-size: 14px; vertical-align: middle;">
                ${label}
              </span>
            </td>
          </tr>
    `;
  }

  private renderPhotoNotice(photoCount: number): string {
    return `
              <div style="background-color: #fff9e6; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>📎 Attached Photos:</strong> This email includes ${photoCount} photo${photoCount > 1 ? 's' : ''} as attachment${photoCount > 1 ? 's' : ''}. You can view them directly in your email client without logging in.
                </p>
              </div>
    `;
  }
}
