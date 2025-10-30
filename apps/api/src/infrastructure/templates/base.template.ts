/**
 * Base Template Class
 * Provides common template rendering functionality
 */

export abstract class BaseTemplate<T = any> {
  /**
   * Render the template with provided data
   */
  abstract render(data: T): string;

  /**
   * Get the email subject line
   */
  abstract getSubject(data: T): string;

  /**
   * Replace template variables with actual values
   */
  protected replaceVariables(
    template: string,
    variables: Record<string, any>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    return result;
  }

  /**
   * Create common email header
   */
  protected getEmailHeader(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WellPulse</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 3px solid #0066cc;">
              <h1 style="margin: 0; color: #0066cc; font-size: 28px; font-weight: bold;">WellPulse</h1>
              <p style="margin: 10px 0 0; color: #666666; font-size: 14px;">Field Data Management Platform</p>
            </td>
          </tr>`;
  }

  /**
   * Create common email footer
   */
  protected getEmailFooter(message?: string): string {
    return `
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
              ${message ? `<p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">${message}</p>` : ''}
              <p style="margin: 15px 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} WellPulse. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
