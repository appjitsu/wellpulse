# Infrastructure Services

This directory contains shared infrastructure services used across the application.

## EmailService

### Overview

Production-ready email service for sending transactional emails during authentication flows.

### Features

- **Professional HTML Templates**: Mobile-responsive email templates with inline CSS for maximum email client compatibility
- **Error Handling**: Graceful error handling with detailed logging - email failures don't break auth flow
- **Environment-Based Configuration**: Uses SMTP settings from environment variables
- **Development Support**: Works seamlessly with Mailpit for local development

### Configuration

Required environment variables (see `apps/api/.env.example`):

```env
SMTP_HOST=localhost              # SMTP server host
SMTP_PORT=1025                   # SMTP server port
SMTP_SECURE=false                # Use TLS (true for port 465, false for others)
SMTP_USER=                       # SMTP username (optional for Mailpit)
SMTP_PASS=                       # SMTP password (optional for Mailpit)
SMTP_FROM=noreply@wellpulse.app  # Sender email address
```

### Usage

The EmailService is registered in `AuthModule` and automatically injected into command handlers:

```typescript
import { EmailService } from '../../infrastructure/services/email.service';

@Injectable()
export class SomeCommandHandler {
  constructor(private readonly emailService: EmailService) {}

  async execute(command: SomeCommand): Promise<void> {
    // Send verification email
    await this.emailService.sendVerificationEmail(email, code, tenantSlug);

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(email, token, tenantSlug);
  }
}
```

### Email Templates

#### Verification Email

- Subject: "Verify your WellPulse account"
- Includes 6-digit verification code
- Includes verification link with code pre-filled
- Mentions 24-hour expiration
- Professional WellPulse branding

#### Password Reset Email

- Subject: "Reset your WellPulse password"
- Includes password reset link with token
- Mentions 1-hour expiration
- Security notice if user didn't request reset
- Fallback link copy for accessibility

### Development

For local development, use [Mailpit](https://github.com/axllent/mailpit) (included in Docker Compose):

```bash
# Start Mailpit
docker-compose up mailpit

# View emails at
http://localhost:8025
```

### Production

For production, configure a production SMTP provider:

**Option 1: SendGrid**

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@wellpulse.app
```

**Option 2: AWS SES**

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=noreply@wellpulse.app
```

**Option 3: Azure Communication Services**

```env
SMTP_HOST=smtp.azurecomm.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-azure-comm-username
SMTP_PASS=your-azure-comm-password
SMTP_FROM=noreply@wellpulse.app
```

### Error Handling

The EmailService uses try-catch blocks and logs errors without throwing:

```typescript
try {
  await this.transporter.sendMail({...});
  this.logger.log(`Email sent to ${email}`);
} catch (error) {
  // Log error but don't throw - email failures shouldn't break auth flow
  this.logger.error(`Failed to send email: ${errorMessage}`, errorStack);
}
```

This ensures authentication flows continue even if email delivery fails (network issues, SMTP errors, etc.).

### Testing

The EmailService is tested indirectly through command handler integration tests. For unit testing:

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                SMTP_HOST: 'localhost',
                SMTP_PORT: 1025,
                SMTP_SECURE: false,
                SMTP_FROM: 'test@example.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## TenantProvisioningService

See [tenant provisioning documentation](../../application/tenants/README.md) for details.
