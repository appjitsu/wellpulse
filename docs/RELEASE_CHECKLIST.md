# WellPulse Release Checklist

**Version:** 2.0
**Last Updated:** October 24, 2025

This checklist ensures quality and performance standards are met before deploying to production.

---

## Pre-Release (1-2 Days Before)

### Code Quality

- [ ] **All tests passing**

  ```bash
  pnpm test
  ```

  - [ ] Unit tests (≥80% coverage required)
  - [ ] Integration tests
  - [ ] E2E tests

- [ ] **Linting clean**

  ```bash
  pnpm lint
  ```

  - [ ] Zero ESLint errors
  - [ ] Zero TypeScript errors

- [ ] **Type checking passed**

  ```bash
  pnpm type-check
  ```

- [ ] **Code formatting applied**

  ```bash
  pnpm format
  ```

- [ ] **Build successful**
  ```bash
  pnpm build
  ```

### Security

- [ ] **No secrets in code**
  - [ ] Check `.env` files not committed
  - [ ] Verify no hardcoded credentials
  - [ ] Run secret scanner (if available)

- [ ] **Dependencies updated**

  ```bash
  pnpm outdated
  pnpm audit
  ```

  - [ ] Review critical/high security vulnerabilities
  - [ ] Update vulnerable packages
  - [ ] Test after updates

- [ ] **RBAC policies reviewed**
  - [ ] No unintended permission grants
  - [ ] Admin routes properly protected
  - [ ] Tenant isolation verified

---

## Performance Testing (Required)

### 1. Quick Smoke Test

```bash
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/health \
  --requests 100 \
  --concurrency 10
```

**Expected Results:**

- ✅ P95 < 100ms
- ✅ No errors (except rate limiting)
- ✅ Response times stable

**Checklist:**

- [ ] Smoke test passed
- [ ] Response times within baseline
- [ ] No unexpected errors

### 2. Baseline Performance Tests

```bash
./scripts/baseline-performance-test.sh
```

**Review `baseline-results-YYYYMMDD-HHMMSS.txt` for:**

- [ ] Health endpoint: P95 < 50ms
- [ ] Metrics endpoint: P95 < 100ms
- [ ] Admin endpoints: P95 < 500ms
- [ ] Tenant endpoints: P95 < 200ms
- [ ] Connection pools: No waiting clients
- [ ] Rate limiting: Working correctly (>80% rejection at high concurrency)

**If any threshold exceeded:**

- ⚠️ Investigate cause
- ⚠️ Fix performance regression OR
- ⚠️ Update baselines with justification

### 3. Artillery Load Test (Optional but Recommended)

```bash
npx artillery run artillery-load-test.yml
```

**Expected Results:**

- ✅ P95 < 500ms
- ✅ P99 < 1000ms
- ✅ Error rate < 1%

**Checklist:**

- [ ] Artillery test passed thresholds
- [ ] No memory leaks detected
- [ ] Connection pools stable

### 4. Connection Pool Validation

```bash
# Terminal 1: Run stress test
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/wells \
  --tenant acmeoil \
  --requests 2000 \
  --concurrency 100

# Terminal 2: Monitor metrics
watch -n 1 'curl -s http://localhost:4000/api/metrics | grep tenant_connection_pool'
```

**Checklist:**

- [ ] Connection pools scale appropriately
- [ ] No waiting clients (pool exhaustion)
- [ ] Idle connections are reused
- [ ] Pool utilization 60-80%

---

## Database

### Schema Changes

- [ ] **Migrations created**

  ```bash
  pnpm --filter=api db:generate:master
  pnpm --filter=api db:generate:tenant
  ```

- [ ] **Migrations reviewed**
  - [ ] No destructive changes without backups
  - [ ] Rollback plan documented
  - [ ] Downgrade migrations tested

- [ ] **Migrations tested**

  ```bash
  # Test upgrade
  pnpm --filter=api db:migrate:all

  # Test rollback (in dev environment)
  pnpm --filter=api db:rollback
  ```

- [ ] **Schema changes documented**
  - [ ] Update `docs/database-schema.md` (if exists)
  - [ ] Document breaking changes

### Data Integrity

- [ ] **Database backups verified**
  - [ ] Recent backup exists
  - [ ] Backup restore tested (staging)

- [ ] **Indexes reviewed**
  - [ ] New queries have indexes
  - [ ] No N+1 query issues
  - [ ] EXPLAIN ANALYZE results acceptable

---

## Frontend

### Build & Deploy

- [ ] **Production build successful**

  ```bash
  pnpm --filter=web build
  pnpm --filter=admin build
  ```

- [ ] **Bundle size acceptable**
  - [ ] Check bundle analyzer output
  - [ ] No unexpected large dependencies

- [ ] **Environment variables set**
  - [ ] `NEXT_PUBLIC_API_URL` correct
  - [ ] Feature flags configured
  - [ ] Analytics keys set (if applicable)

### Manual Testing

- [ ] **Critical user flows tested**
  - [ ] Login/logout
  - [ ] Create/edit/delete operations
  - [ ] Search and filtering
  - [ ] Pagination
  - [ ] File uploads (if applicable)

- [ ] **Cross-browser compatibility** (if UI changes)
  - [ ] Chrome/Edge
  - [ ] Firefox
  - [ ] Safari

- [ ] **Mobile responsiveness** (if UI changes)
  - [ ] iPhone
  - [ ] Android
  - [ ] Tablet

---

## API

### Endpoint Validation

- [ ] **API documentation updated**
  - [ ] Swagger/OpenAPI spec current
  - [ ] New endpoints documented
  - [ ] Breaking changes noted

- [ ] **Rate limiting tested**

  ```bash
  node scripts/stress-test.js \
    --endpoint http://localhost:4000/api/health \
    --requests 500 \
    --concurrency 200
  ```

  - [ ] Rate limiting triggers correctly
  - [ ] HTTP 429 responses returned
  - [ ] Redis connectivity working

- [ ] **Error handling tested**
  - [ ] 404 responses for invalid routes
  - [ ] 401 for unauthenticated requests
  - [ ] 403 for unauthorized requests
  - [ ] 500 errors logged properly

### Multi-Tenancy

- [ ] **Tenant isolation verified**
  - [ ] Cross-tenant data access blocked
  - [ ] Tenant middleware working
  - [ ] Connection pools per tenant

- [ ] **Tenant creation tested**
  ```bash
  # Test tenant provisioning flow
  curl -X POST http://localhost:4000/api/admin/tenants \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Tenant","subdomain":"testcorp",...}'
  ```

---

## Monitoring & Observability

### Metrics

- [ ] **Prometheus metrics accessible**

  ```bash
  curl http://localhost:4000/api/metrics
  ```

- [ ] **Key metrics present**
  - [ ] HTTP request duration histogram
  - [ ] Connection pool gauges
  - [ ] Tenant metrics
  - [ ] System metrics (memory, CPU)

- [ ] **Admin dashboard working**
  - [ ] Visit `http://localhost:4002/dashboard/metrics`
  - [ ] Charts rendering correctly
  - [ ] Real-time data updating

### Alerts (Production Only)

- [ ] **Alert rules deployed**
  - [ ] Prometheus alert rules updated
  - [ ] Thresholds reviewed
  - [ ] Notification channels configured

- [ ] **Alert runbooks updated**
  - [ ] High latency runbook
  - [ ] Connection pool exhaustion runbook
  - [ ] Error rate spike runbook

---

## Documentation

- [ ] **CHANGELOG.md updated**
  - [ ] New features listed
  - [ ] Bug fixes documented
  - [ ] Breaking changes highlighted

- [ ] **README.md current**
  - [ ] Installation instructions accurate
  - [ ] Environment variables documented

- [ ] **API documentation updated**
  - [ ] Swagger UI accessible
  - [ ] Examples updated

- [ ] **Pattern documentation current**
  - [ ] New patterns documented
  - [ ] Pattern catalog updated

---

## Deployment

### Pre-Deployment

- [ ] **Staging deployment successful**
  - [ ] Deployed to staging environment
  - [ ] Smoke tests passed on staging
  - [ ] Performance acceptable on staging

- [ ] **Rollback plan documented**
  - [ ] Previous version tagged
  - [ ] Rollback steps documented
  - [ ] Database rollback plan ready

- [ ] **Communication prepared**
  - [ ] Release notes drafted
  - [ ] Team notified of deployment window
  - [ ] Customers notified (if breaking changes)

### Deployment Steps

1. [ ] **Create release tag**

   ```bash
   git tag -a v1.2.3 -m "Release v1.2.3: [Brief description]"
   git push origin v1.2.3
   ```

2. [ ] **Trigger deployment pipeline**
   - [ ] CI/CD pipeline green
   - [ ] All checks passed

3. [ ] **Monitor deployment**
   - [ ] Watch deployment logs
   - [ ] Check health endpoints
   - [ ] Verify metrics dashboard

4. [ ] **Verify production**
   - [ ] Health endpoint responding
   - [ ] Login working
   - [ ] Critical features functional
   - [ ] Performance within baselines

### Post-Deployment

- [ ] **Monitor for 30 minutes**
  - [ ] Error rates normal (< 1%)
  - [ ] Response times acceptable (P95 < 500ms)
  - [ ] No memory leaks
  - [ ] Connection pools healthy

- [ ] **Verify monitoring**
  - [ ] Metrics flowing to dashboard
  - [ ] Alerts configured correctly
  - [ ] Logs aggregated properly

- [ ] **Update status page** (if applicable)
  - [ ] Mark deployment complete
  - [ ] Update version number

---

## Rollback Procedure

**If issues detected during monitoring:**

1. [ ] **Assess severity**
   - [ ] Critical issue requiring immediate rollback?
   - [ ] Can be fixed with hotfix?
   - [ ] Acceptable to monitor?

2. [ ] **Execute rollback** (if needed)

   ```bash
   # Revert to previous deployment
   git revert HEAD
   git push

   # OR use deployment platform rollback
   # Railway: Use dashboard to rollback
   # Azure: Use deployment slots to swap back
   ```

3. [ ] **Rollback database** (if schema changes)

   ```bash
   pnpm --filter=api db:rollback
   ```

4. [ ] **Verify rollback**
   - [ ] Previous version deployed
   - [ ] Functionality restored
   - [ ] Metrics normalized

5. [ ] **Communicate**
   - [ ] Notify team of rollback
   - [ ] Update status page
   - [ ] Document issue for post-mortem

---

## Checklist Completion

**Sign-off:**

- [ ] **Technical Lead:** ********\_******** (Date: **\_\_**)
- [ ] **QA Engineer:** ********\_******** (Date: **\_\_**) _(if applicable)_
- [ ] **DevOps:** ********\_******** (Date: **\_\_**) _(if applicable)_

**Performance Test Results:**

```
Baseline Tests Completed: [Yes/No]
Date: YYYY-MM-DD
Results File: baseline-results-YYYYMMDD-HHMMSS.txt

Key Metrics:
- Health P95: _____ ms (threshold: < 50ms)
- Metrics P95: _____ ms (threshold: < 100ms)
- Error Rate: _____ % (threshold: < 1%)
- Connection Pools: [Healthy/Issues]

Sign-off: _________________ (Date: ______)
```

**Notes:**

```
[Any additional notes, concerns, or observations]
```

---

## Quick Reference

### Essential Commands

```bash
# Quality checks
pnpm lint && pnpm type-check && pnpm test && pnpm build

# Quick smoke test
node scripts/stress-test.js --endpoint http://localhost:4000/api/health --requests 100 --concurrency 10

# Full baseline tests
./scripts/baseline-performance-test.sh

# Artillery load test
npx artillery run artillery-load-test.yml

# Database migrations
pnpm --filter=api db:migrate:all

# Start services
pnpm dev
```

### Performance Thresholds

| Endpoint | P95 Target | P99 Target | Error Rate |
| -------- | ---------- | ---------- | ---------- |
| Health   | < 50ms     | < 100ms    | < 1%       |
| Metrics  | < 100ms    | < 500ms    | < 1%       |
| Admin    | < 500ms    | < 1000ms   | < 1%       |
| Tenant   | < 200ms    | < 500ms    | < 1%       |

### Support Contacts

- **On-Call Engineer:** [Contact info]
- **DevOps Team:** [Contact info]
- **Product Lead:** [Contact info]

---

**Remember:** Performance testing is not optional. Regression in production affects all users and is expensive to fix. Take the time to verify before deploying. 🚀
