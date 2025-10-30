# Slack Notifications Setup Guide

**Version**: 1.0
**Last Updated**: October 25, 2025

---

## Overview

WellPulse can send important notifications to your Slack channel using Incoming Webhooks. This is particularly useful for:

- **Tenant Creation**: Receive tenant credentials (ID + Secret) immediately when new tenant is provisioned
- **Secret Rotation**: Get notified when tenant secrets are rotated with new credentials
- **System Alerts**: Critical errors, security events, or other important notifications

**Security Note**: Slack messages containing tenant secrets are the ONLY time these credentials are transmitted in plaintext. Ensure your Slack workspace is properly secured.

---

## Quick Setup (5 minutes)

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Name your app: **"WellPulse Notifications"**
5. Select your Slack workspace
6. Click **"Create App"**

### 2. Enable Incoming Webhooks

1. In your app settings, click **"Incoming Webhooks"** in the left sidebar
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Scroll down and click **"Add New Webhook to Workspace"**
4. Select the channel where notifications should be posted (e.g., `#wellpulse-admin`)
5. Click **"Allow"**

### 3. Copy Webhook URL

You'll see a webhook URL that looks like:

```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

**⚠️ Keep this URL secret!** Anyone with this URL can post to your Slack channel.

### 4. Configure WellPulse API

Add the webhook URL to your `.env` file:

```bash
# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### 5. Restart API Server

```bash
# If running in development
pnpm --filter=api dev

# If running in production
pm2 restart wellpulse-api
```

### 6. Test Notification

Create a new tenant via the admin portal or API:

```bash
POST /api/v1/tenants
{
  "name": "Test Company",
  "slug": "test-company",
  "subdomain": "test",
  "contactEmail": "admin@test.com",
  "subscriptionTier": "STARTER",
  "databaseType": "POSTGRESQL"
}
```

You should immediately receive a Slack notification with:
- Tenant name and subdomain
- Tenant ID (e.g., `TESTCOMPANY-A5L32W`)
- Tenant Secret (show once, store securely!)
- Contact email and subscription tier

---

## Notification Examples

### Tenant Created

```
🎉 New Tenant Created

Tenant Name: ACME Oil & Gas
Subdomain: acme.wellpulse.app
Contact Email: admin@acmeoil.com
Subscription: ENTERPRISE

🔐 Credentials (Mobile/Desktop Apps)
Tenant ID: `ACME-X7K9P2`
Tenant Secret: `dGVzdC1zZWNyZXQtZm9yLWRlbW8tcHVycG9zZXMtb25seQ==`

⚠️ IMPORTANT: Store tenant secret securely - it will never be shown again!

Created by: admin@wellpulse.app
```

### Secret Rotated

```
🔄 Tenant Secret Rotated

Tenant: ACME Oil & Gas
Tenant ID: `ACME-X7K9P2`

🔐 New Tenant Secret:
`bmV3LXNlY3JldC1hZnRlci1yb3RhdGlvbi1mb3ItZGVtbw==`

⚠️ Old secret has been invalidated. Update all mobile/desktop apps with new secret.

Rotated by: admin@wellpulse.app | Reason: Security audit
```

### System Alert

```
🚨 Critical Alert

Database connection pool exhausted on tenant: acme.wellpulse.app

WellPulse API • Today at 3:45 PM
```

---

## Security Best Practices

### 1. Use a Private Channel

Create a dedicated private channel like `#wellpulse-secrets` that only admin team members can access:

```
/create #wellpulse-secrets (private)
/invite @admin1 @admin2
```

### 2. Enable Slack Security Features

- **Two-Factor Authentication (2FA)**: Require 2FA for all workspace members
- **Session Duration**: Set session timeout to 8 hours or less
- **IP Whitelisting**: Restrict Slack access to office/VPN IPs if possible

### 3. Webhook URL Storage

- ✅ Store in environment variables (`.env` file, never committed to Git)
- ✅ Use secrets management (AWS Secrets Manager, Azure Key Vault, etc.)
- ❌ Never hardcode in source code
- ❌ Never commit to version control

### 4. Rotate Webhook URL Regularly

Every 90 days:
1. Generate new webhook URL in Slack app settings
2. Update `SLACK_WEBHOOK_URL` in production environment
3. Restart API server
4. Revoke old webhook URL

---

## Troubleshooting

### Notifications Not Appearing

**Check 1: Is Slack enabled?**

```bash
# Should see this in API logs on startup:
[SlackNotificationService] Slack notifications enabled
```

If you see `Slack notifications disabled: SLACK_WEBHOOK_URL not configured`, check your `.env` file.

**Check 2: Test webhook URL manually**

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test notification from WellPulse"}' \
  https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Check 3: Verify channel permissions**

The webhook URL is tied to a specific channel. If the channel was deleted or renamed, create a new webhook.

### Notifications Delayed

Slack webhooks are rate-limited to approximately 1 message per second. If you're creating multiple tenants rapidly, some notifications may be queued.

### Webhook URL Revoked

If you see `invalid_payload` or `channel_not_found` errors:
1. Create a new webhook URL in Slack app settings
2. Update `SLACK_WEBHOOK_URL` environment variable
3. Restart API server

---

## Disabling Slack Notifications

If you want to disable Slack notifications (fallback to console logs):

```bash
# Comment out or remove from .env
# SLACK_WEBHOOK_URL=
```

Restart API server. Tenant credentials will be logged to console instead.

---

## Advanced: Custom Slack Bot

For more advanced features (interactive messages, user lookups, etc.), consider upgrading from Incoming Webhooks to a full Slack Bot:

1. **Enable OAuth & Permissions** in your Slack app
2. **Add Bot Token Scopes**: `chat:write`, `chat:write.public`
3. **Install app to workspace** and get Bot User OAuth Token
4. **Use Slack Web API** instead of webhooks for richer formatting

---

## Related Documentation

- [Slack Incoming Webhooks Documentation](https://api.slack.com/messaging/webhooks)
- [Tenant Management Guide](../apps/admin-portal-specification.md)
- [Security Best Practices](./security-best-practices.md)
