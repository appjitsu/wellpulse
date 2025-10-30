/**
 * Field Alert SMS Template
 * Used for sending critical field alerts via SMS
 */

export interface FieldAlertSmsData {
  wellName: string;
  alertType: 'pressure' | 'temperature' | 'production' | 'equipment' | 'safety';
  value?: string;
  threshold?: string;
  message: string;
  timestamp: string;
  operatorName?: string;
}

export class FieldAlertSmsTemplate {
  /**
   * Render SMS message (160 characters max for single SMS)
   * Keep it concise but informative
   */
  render(data: FieldAlertSmsData): string {
    const { wellName, alertType, value, message } = data;

    // Format alert type with emoji for quick recognition
    const alertIcon = this.getAlertIcon(alertType);

    // SMS messages should be under 160 characters when possible
    // Format: [EMOJI] WELL: Alert message
    return `${alertIcon} ${wellName}: ${message}${value ? ` (${value})` : ''}`;
  }

  private getAlertIcon(alertType: FieldAlertSmsData['alertType']): string {
    const icons = {
      pressure: '⚠️',
      temperature: '🌡️',
      production: '📉',
      equipment: '🔧',
      safety: '🚨',
    };
    return icons[alertType] || '⚠️';
  }

  /**
   * Validate SMS length (160 chars for single SMS, 306 for concatenated)
   */
  validateLength(message: string): {
    valid: boolean;
    length: number;
    segmentCount: number;
  } {
    const length = message.length;
    const segmentCount = Math.ceil(length / 153); // 153 chars per segment for concatenated SMS

    return {
      valid: length <= 306, // Max 2 segments
      length,
      segmentCount: length <= 160 ? 1 : segmentCount,
    };
  }
}
