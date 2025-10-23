# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, security scanning, deployment, and maintenance.

## 📋 Workflow Overview

### Core CI/CD

#### 🔨 **ci.yml** - Continuous Integration

**Triggers:** Push, Pull Request
**Purpose:** Main CI pipeline
**Actions:**

- Lint code with ESLint
- Type check with TypeScript
- Run unit tests with Jest
- Build applications

---

#### 🚢 **deploy-railway.yml** - Railway Deployment

**Triggers:** Push to master/main
**Purpose:** Deploy to Railway production
**Actions:**

- Deploy API service
- Deploy Web service
- Update production environment

---

#### 🐳 **docker.yml** - Docker Build & Publish

**Triggers:** Push, Pull Request, Tags
**Purpose:** Build and publish Docker images
**Actions:**

- Build multi-arch images (amd64, arm64)
- Publish to GitHub Container Registry (ghcr.io)
- Tag with semantic versions
- Generate build attestations

**Images Published:**

- `ghcr.io/appjitsu/wellpulse/api:latest`
- `ghcr.io/appjitsu/wellpulse/web:latest`

---

### Security & Compliance

#### 🔒 **security.yml** - Security Scanning

**Triggers:** Push, Pull Request, Weekly schedule
**Purpose:** Comprehensive security scanning
**Scans:**

- **Semgrep** - SAST (Static Application Security Testing)
- **Trivy** - Dependency & container vulnerability scanning
- **Gitleaks** - Secret detection
- **NPM Audit** - Known npm vulnerabilities
- **OWASP Dependency Check** - Dependency vulnerabilities
- **License Check** - License compliance

**Reports:** SARIF files uploaded to GitHub Security tab

---

#### 🔍 **codeql.yml** - CodeQL Analysis

**Triggers:** Push, Pull Request, Weekly schedule
**Purpose:** Advanced security vulnerability detection
**Languages:** JavaScript, TypeScript
**Reports:** GitHub Security tab

---

### Testing

#### 🎭 **e2e.yml** - End-to-End Tests

**Triggers:** Push, Pull Request
**Purpose:** Run Playwright E2E tests
**Environment:**

- PostgreSQL 16
- Redis 7
- Full application stack

**Artifacts:** Test reports and videos on failure

---

### Quality & Performance

#### 📦 **bundle-size.yml** - Bundle Size Tracking

**Triggers:** Pull Request (when web code changes)
**Purpose:** Monitor bundle size impact
**Alerts:** Fails if bundle increases >5%
**Reports:** Commented on PR with size comparison

---

#### 🚦 **lighthouse.yml** - Lighthouse Performance

**Triggers:** Pull Request, Weekly schedule
**Purpose:** Track web performance metrics
**Metrics:**

- Performance
- Accessibility
- Best Practices
- SEO

**Reports:** Commented on PR with scores

---

### Preview & Testing

#### 🔬 **preview.yml** - Preview Deployments

**Triggers:** Pull Request opened/updated/closed
**Purpose:** Deploy PR preview environments
**Actions:**

- Create Railway PR environment (pr-{number})
- Comment PR with preview URLs
- Delete environment on PR close

**Preview URLs:**

- Web: `https://pr-{number}-web.up.railway.app`
- API: `https://pr-{number}-api.up.railway.app`

---

### Database

#### 🗃️ **migration-check.yml** - Database Migration Validation

**Triggers:** Pull Request (when schema changes)
**Purpose:** Validate database migrations
**Checks:**

- Detect destructive operations (DROP, TRUNCATE)
- Test migration on fresh database
- Verify schema integrity

**Alerts:** Comments on PR if destructive changes detected

---

### Automation

#### 🤖 **dependabot-auto-merge.yml** - Auto-merge Dependabot

**Triggers:** Dependabot PR opened/updated
**Purpose:** Automatically merge safe dependency updates
**Rules:**

- Auto-merge: patch and minor updates (after CI passes)
- Manual review: major version updates
- Labels PRs by update type

---

#### 🧹 **stale.yml** - Stale Issue/PR Management

**Triggers:** Daily schedule
**Purpose:** Close inactive issues and PRs
**Rules:**

- Issues: Stale after 60 days, close after 7 more
- PRs: Stale after 30 days, close after 14 more
- Exempt: pinned, security, dependencies labels

---

## 🔐 Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret          | Description             | Used By                         |
| --------------- | ----------------------- | ------------------------------- |
| `RAILWAY_TOKEN` | Railway API token       | deploy-railway.yml, preview.yml |
| `GITHUB_TOKEN`  | Auto-provided by GitHub | All workflows                   |

## 📊 Security Reports

View security findings in:

- **Security → Code scanning alerts** - SARIF uploads from security scanners
- **Security → Dependabot alerts** - Dependency vulnerabilities
- **Pull Requests** - Inline security comments

## 🎯 Workflow Status Badges

Add to README.md:

```markdown
![CI](https://github.com/appjitsu/wellpulse/workflows/CI/badge.svg)
![Security](https://github.com/appjitsu/wellpulse/workflows/Security%20Scanning/badge.svg)
![E2E Tests](https://github.com/appjitsu/wellpulse/workflows/E2E%20Tests/badge.svg)
```

## 🛠️ Local Development

### Run E2E Tests Locally

```bash
pnpm --filter=web run test:e2e
pnpm --filter=web run test:e2e:ui      # Interactive mode
pnpm --filter=web run test:e2e:debug   # Debug mode
```

### Run Security Scans Locally

```bash
# Semgrep
docker run --rm -v $(pwd):/src semgrep/semgrep semgrep --config=auto

# Trivy
docker run --rm -v $(pwd):/workspace aquasec/trivy fs /workspace

# Gitleaks
docker run --rm -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path"
```

### Test Docker Builds Locally

```bash
# Build API
docker build -f apps/api/Dockerfile -t wellpulse-api:local .

# Build Web
docker build -f apps/web/Dockerfile -t wellpulse-web:local .
```

## 📝 Workflow Maintenance

### Adding New Workflows

1. Create `.github/workflows/your-workflow.yml`
2. Test locally using [act](https://github.com/nektos/act)
3. Document in this README
4. Update required secrets if needed

### Modifying Existing Workflows

1. Make changes to workflow file
2. Test on feature branch first
3. Monitor workflow runs in Actions tab
4. Update documentation

### Debugging Failed Workflows

1. Check **Actions** tab for logs
2. Re-run with debug logging: `Re-run jobs → Enable debug logging`
3. Use `actions/upload-artifact` for file inspection
4. Test locally with `act`

## 🔄 Workflow Dependencies

```
┌─────────────┐
│   Push      │
└──────┬──────┘
       │
       ├─→ CI ────────────────────┐
       ├─→ Security Scanning      │
       ├─→ CodeQL                 ├─→ Docker Build & Push
       └─→ E2E Tests              │
                                  └─→ Deploy to Railway
┌─────────────┐
│ Pull Request│
└──────┬──────┘
       │
       ├─→ CI
       ├─→ Security Scanning
       ├─→ E2E Tests
       ├─→ Bundle Size Check
       ├─→ Migration Check
       ├─→ Lighthouse
       └─→ Preview Deployment
```

## 🎓 Best Practices

1. **Always run CI locally** before pushing
2. **Review security alerts** in Security tab weekly
3. **Keep secrets secure** - never commit to repo
4. **Monitor workflow runs** - fix failures quickly
5. **Update workflows** when dependencies change
6. **Test PRs** in preview environments before merging
7. **Review Dependabot PRs** before auto-merge (especially major updates)

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Railway Deployment Guide](https://docs.railway.app/)
- [Playwright Documentation](https://playwright.dev/)
- [Semgrep Rules](https://semgrep.dev/r)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
