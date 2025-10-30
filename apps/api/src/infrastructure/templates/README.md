# WellPulse Communication Templates

This directory contains templates for emails and SMS messages used throughout the WellPulse platform.

## Structure

```
templates/
├── base.template.ts          # Base template class with common functionality
├── email/                    # Email templates
│   └── field-entry-report.template.ts
└── sms/                      # SMS templates
    └── field-alert.template.ts
```

## Creating New Templates

### Email Templates

1. **Extend BaseTemplate**:
```typescript
import { BaseTemplate } from '../base.template';

export interface MyEmailData {
  // Define your data structure
}

export class MyEmailTemplate extends BaseTemplate<MyEmailData> {
  getSubject(data: MyEmailData): string {
    return 'Your subject line';
  }

  render(data: MyEmailData): string {
    return `
${this.getEmailHeader()}
      <!-- Your content here -->
      <tr>
        <td style="padding: 40px;">
          <h2>Your email content</h2>
        </td>
      </tr>
${this.getEmailFooter('Your footer message')}
    `.trim();
  }
}
```

2. **Use in EmailService**:
```typescript
const template = new MyEmailTemplate();
const html = template.render(data);
const subject = template.getSubject(data);

await this.transporter.sendMail({
  from: this.configService.get<string>('SMTP_FROM'),
  to: recipientEmails.join(', '),
  subject,
  html,
});
```

### SMS Templates

1. **Create Template Class**:
```typescript
export interface MySmsData {
  message: string;
  // other fields
}

export class MySmsTemplate {
  render(data: MySmsData): string {
    // Keep under 160 characters for single SMS
    return `Your SMS message: ${data.message}`;
  }

  validateLength(message: string) {
    return {
      valid: message.length <= 160,
      length: message.length,
      segmentCount: Math.ceil(message.length / 153),
    };
  }
}
```

## Email Design Guidelines

- **Inline CSS Only**: Email clients strip `<style>` tags and external CSS
- **Table-Based Layout**: Use tables for layout (email clients don't support modern CSS)
- **Mobile-First**: Design for small screens (max-width: 600px)
- **Test Across Clients**: Gmail, Outlook, Apple Mail have different rendering
- **Plain Text Alternative**: Always provide a plain text version

## SMS Guidelines

- **160 Characters**: Single SMS limit (use 153 for concatenated messages)
- **Critical Information First**: Most important info at the start
- **Use Emojis Sparingly**: For quick recognition (⚠️, 🚨, etc.)
- **Include Well Name**: Always identify the well in alerts
- **Actionable**: Tell recipient what to do

## Available Templates

### Email Templates

#### EmailVerificationTemplate
**Purpose**: Send verification codes during user registration
**Used By**: Authentication flow
**Features**:
- 6-digit verification code
- Click-through verification link
- 24-hour expiration notice

**Example**:
```typescript
const template = new EmailVerificationTemplate();
const html = template.render({
  code: '123456',
  verificationUrl: 'https://tenant.wellpulse.app/verify-email?code=123456',
});
const subject = template.getSubject(); // 'Verify your WellPulse account'
```

#### PasswordResetTemplate
**Purpose**: Send password reset links
**Used By**: Password reset flow
**Features**:
- Secure reset link
- 1-hour expiration notice
- Security notice for unwanted requests

**Example**:
```typescript
const template = new PasswordResetTemplate();
const html = template.render({
  resetUrl: 'https://tenant.wellpulse.app/reset-password?token=abc123',
});
const subject = template.getSubject(); // 'Reset your WellPulse password'
```

#### FieldEntryReportTemplate
**Purpose**: Share field entry data and photos via email
**Used By**: Field operators sharing inspection reports
**Features**:
- Well information
- Production data (oil, gas, pressure, temperature, water cut)
- GPS coordinates
- Daily checklist
- Notes section
- Photo attachments

**Example**:
```typescript
const template = new FieldEntryReportTemplate();
const html = template.render({
  senderName: 'John Doe',
  wellName: 'Smith #1',
  photoCount: 3,
  entryData: {
    productionVolume: 50,
    pressure: 1200,
    temperature: 145,
  },
  checklist: [
    { label: 'Check pressure', checked: true },
    { label: 'Inspect pump', checked: true },
  ],
});
const subject = template.getSubject(data); // 'Field Entry Report - Smith #1'
```

#### WeeklyProductionSummaryTemplate
**Purpose**: Send weekly production summary reports
**Used By**: Automated scheduling system
**Features**:
- Total production metrics (oil, gas, water)
- Active well utilization rate
- Week-over-week comparison with trend indicators
- Top 5 performing wells
- Alerts and notifications summary
- Call-to-action to view full report

**Example**:
```typescript
const template = new WeeklyProductionSummaryTemplate();
const html = template.render({
  recipientName: 'John Doe',
  weekStartDate: '2024-01-01',
  weekEndDate: '2024-01-07',
  organizationName: 'Acme Oil Co',
  totalOilProduction: 5000,
  totalGasProduction: 10000,
  totalWaterProduction: 2000,
  activeWellCount: 15,
  totalWellCount: 20,
  topPerformers: [
    { wellName: 'Smith #1', apiNumber: '12-345-67890', oilProduction: 500, gasProduction: 1000, waterProduction: 100 }
  ],
  alerts: [
    { wellName: 'Smith #2', message: 'Pressure exceeds threshold', severity: 'high' }
  ],
  comparisonToLastWeek: {
    oilChange: 5.2,
    gasChange: -2.1,
    productionTrend: 'up'
  }
});
const subject = template.getSubject(data); // 'Weekly Production Summary - Jan 1 to Jan 7, 2024'
```

#### MaintenanceReminderTemplate
**Purpose**: Send equipment maintenance reminders
**Used By**: Automated scheduling system, managers
**Features**:
- Overdue and upcoming maintenance counts
- Detailed maintenance item cards with priority badges
- Equipment type icons for quick recognition
- Due date and last maintenance tracking
- Maintenance best practices section
- Call-to-action to maintenance schedule

**Example**:
```typescript
const template = new MaintenanceReminderTemplate();
const html = template.render({
  recipientName: 'Jane Smith',
  maintenanceItems: [
    {
      equipmentName: 'Pump #3',
      equipmentType: 'pump',
      wellName: 'Smith #1',
      maintenanceType: 'Oil Change',
      dueDate: '2024-01-15',
      lastMaintenance: '2023-10-15',
      priority: 'high',
      estimatedDuration: '2 hours',
      notes: 'Requires synthetic oil'
    }
  ],
  organizationName: 'Acme Oil Co',
  overdueCount: 2,
  upcomingCount: 5
});
const subject = template.getSubject(data); // '⚠️ 2 Overdue Maintenance Items - Action Required'
```

#### TeamInvitationTemplate
**Purpose**: Invite new users to join organization
**Used By**: Admins and managers inviting team members
**Features**:
- Personalized greeting (with or without name)
- Role information with descriptions
- Optional personal message from inviter
- WellPulse platform overview
- Expiration notice (configurable days)
- Invitation link fallback

**Example**:
```typescript
const template = new TeamInvitationTemplate();
const html = template.render({
  inviteeName: 'John Doe',
  inviteeEmail: 'john@example.com',
  inviterName: 'Jane Smith',
  inviterRole: 'Manager',
  organizationName: 'Acme Oil Co',
  invitationToken: 'abc123',
  invitationUrl: 'https://app.wellpulse.io/accept-invite?token=abc123',
  roleAssigned: 'Operator',
  expiresInDays: 7,
  personalMessage: 'Looking forward to having you on the team!'
});
const subject = template.getSubject(data); // 'You've been invited to join Acme Oil Co on WellPulse'
```

### SMS Templates

#### FieldAlertSmsTemplate
**Purpose**: Send critical field alerts via SMS
**Used By**: Automated monitoring systems, field operators
**Features**:
- Alert type indicators (emojis)
- Well identification
- Critical values
- Concise messaging

**Example**:
```typescript
const template = new FieldAlertSmsTemplate();
const sms = template.render({
  wellName: 'Smith #1',
  alertType: 'pressure',
  value: '1500 PSI',
  message: 'Pressure exceeded threshold',
  timestamp: new Date().toISOString(),
});
// Output: "⚠️ Smith #1: Pressure exceeded threshold (1500 PSI)"
```

## Future Templates

Consider adding templates for:
- **Compliance Reports** - Automated regulatory reporting summaries
- **Invoice Notifications** - Billing and payment reminders
- **Safety Alerts** - Critical safety incident notifications
- **Well Completion Reports** - New well onboarding summaries
- **Production Anomaly Alerts** - Automated alerts for unusual production patterns
- **Downtime Reports** - Equipment downtime tracking and analysis

## Testing

When adding new templates:
1. Test with real data
2. Check email rendering in multiple clients
3. Verify SMS length (use `validateLength()`)
4. Ensure mobile responsiveness
5. Test with empty/null optional fields
