# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of WellPulse seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Where to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **<security@wellpulse.app>**

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Best effort

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, and service interruption
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a vulnerability beyond what is necessary to confirm its existence
- Report vulnerabilities as soon as discovered
- Keep vulnerability details confidential until we've had a chance to address it

## Security Best Practices

### For Developers

- Never commit secrets, API keys, or credentials to the repository
- Use environment variables for all sensitive configuration
- Follow OWASP Top 10 guidelines
- Implement proper input validation and sanitization
- Use parameterized queries to prevent SQL injection
- Implement proper RBAC with CASL
- Enable audit logging for sensitive operations
- Keep dependencies up to date (Dependabot enabled)
- Run security scans before merging (CodeQL enabled)

### For Users

- Use strong, unique passwords
- Enable two-factor authentication (when available)
- Review audit logs regularly
- Report suspicious activity immediately
- Keep your browser and OS up to date
- Be cautious of phishing attempts

## Security Features

WellPulse implements the following security measures:

- **Authentication**: JWT with refresh token rotation
- **Authorization**: Role-based access control (RBAC) with CASL
- **Data Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Input Validation**: Server-side validation on all inputs
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **XSS Prevention**: Content Security Policy (CSP) headers
- **CSRF Protection**: SameSite cookies and CSRF tokens
- **Rate Limiting**: API rate limiting to prevent abuse
- **Audit Logging**: Comprehensive audit trail for compliance
- **Dependency Scanning**: Automated vulnerability scanning
- **Code Scanning**: CodeQL security analysis

## Compliance

WellPulse is designed to support compliance with:

- SOC 2 Type II
- GDPR (EU General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- PCI DSS (for payment processing)
- HIPAA (for healthcare consulting clients)

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. We recommend:

- Subscribe to GitHub notifications for this repository
- Monitor our release notes for security advisories
- Enable Dependabot alerts
- Keep your deployment up to date

## Acknowledgments

We appreciate the security research community's efforts in responsibly disclosing vulnerabilities. Security researchers who report valid vulnerabilities will be acknowledged in our release notes (with permission).

## Contact

For security-related questions or concerns, contact: **<security@wellpulse.app>**

For general questions, please use GitHub Discussions or Issues.
