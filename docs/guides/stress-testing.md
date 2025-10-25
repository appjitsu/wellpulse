# Stress Testing Guide

This guide explains how to perform load testing and stress testing on the WellPulse API using Artillery and custom Node.js scripts.

## Table of Contents

- [Overview](#overview)
- [Artillery Load Testing](#artillery-load-testing)
- [Custom Node.js Stress Testing](#custom-nodejs-stress-testing)
- [Testing Scenarios](#testing-scenarios)
- [Interpreting Results](#interpreting-results)
- [Best Practices](#best-practices)

---

## Overview

WellPulse provides two complementary stress testing tools:

1. **Artillery** - Professional load testing framework with YAML configuration
2. **Custom Node.js Script** - Flexible, targeted stress testing with detailed metrics

### When to Use Which Tool

**Use Artillery when:**

- You need comprehensive load testing with multiple scenarios
- You want realistic user behavior simulation
- You need professional reports and metrics
- You're testing sustained load over time

**Use Custom Script when:**

- You need quick, targeted endpoint hammering
- You want to test connection pool behavior
- You need custom metrics or logging
- You're doing exploratory stress testing

---

## Artillery Load Testing

### Installation

```bash
pnpm add -D artillery
```

### Quick Start

```bash
# Light load test (default configuration)
npx artillery run artillery-load-test.yml

# Generate HTML report
npx artillery run --output artillery-results.json artillery-load-test.yml
npx artillery report artillery-results.json
```

### Configuration

The `artillery-load-test.yml` file contains multiple test phases. Uncomment the scenario you want to run:

#### Light Load Test (5-10 RPS)

```yaml
phases:
  - duration: 60
    arrivalRate: 5
    name: 'Light load - warm up'
  - duration: 120
    arrivalRate: 10
    name: 'Light load - sustained'
```

#### Medium Load Test (20-50 RPS)

```yaml
phases:
  - duration: 60
    arrivalRate: 20
    name: 'Medium load - warm up'
  - duration: 180
    arrivalRate: 50
    name: 'Medium load - sustained'
```

#### Heavy Load Test (50-100 RPS)

```yaml
phases:
  - duration: 30
    arrivalRate: 50
    rampTo: 100
    name: 'Heavy load - ramp up'
  - duration: 120
    arrivalRate: 100
    name: 'Heavy load - sustained'
```

#### Spike Test (200 RPS burst)

```yaml
phases:
  - duration: 10
    arrivalRate: 200
    name: 'Spike test'
  - duration: 60
    arrivalRate: 10
    name: 'Recovery period'
```

### Test Scenarios

Artillery tests 5 different scenarios with varying traffic distribution:

1. **Health Check (10%)** - Baseline endpoint testing
2. **Metrics Endpoint (15%)** - Monitoring infrastructure stress
3. **Admin Endpoints (5%)** - Cross-tenant admin operations
4. **Wells Endpoints (30%)** - Tenant-scoped CRUD operations
5. **Multi-Tenant Load (40%)** - Mixed tenant operations

### Custom Functions

Edit `artillery-processor.js` to customize behavior:

```javascript
// Select random tenant
selectTenant: function (context, events, done) {
  const tenants = ['acmeoil', 'demooil', 'testoil'];
  context.vars.tenantSubdomain = tenants[Math.floor(Math.random() * tenants.length)];
  return done();
}

// Generate test data
generateWellData: function (context, events, done) {
  context.vars.wellData = {
    name: `Well-${Math.floor(Math.random() * 10000)}`,
    // ... more fields
  };
  return done();
}
```

### Payload Data

Edit `artillery-payloads.csv` to customize tenant credentials:

```csv
subdomain,email,password
acmeoil,admin@acme.com,Test123!@#
demooil,admin@demo.com,Test123!@#
```

### Performance Thresholds

Artillery checks these automatically:

```yaml
ensure:
  maxErrorRate: 1 # Max 1% error rate
  p95: 500 # 95th percentile < 500ms
  p99: 1000 # 99th percentile < 1000ms
```

If thresholds are exceeded, Artillery exits with non-zero status (useful for CI/CD).

---

## Custom Node.js Stress Testing

### Quick Start

```bash
# Hammer health endpoint with 10,000 requests (50 concurrent)
node scripts/stress-test.js --requests 10000 --concurrency 50

# Stress test for 60 seconds
node scripts/stress-test.js --endpoint http://localhost:4000/api/metrics --duration 60

# Test connection pool behavior
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/wells \
  --tenant acmeoil \
  --requests 5000 \
  --concurrency 100
```

### Command-Line Options

| Option                   | Description                              | Default                            |
| ------------------------ | ---------------------------------------- | ---------------------------------- |
| `--endpoint <url>`       | API endpoint to test                     | `http://localhost:4000/api/health` |
| `--requests <number>`    | Total number of requests                 | `1000`                             |
| `--concurrency <number>` | Concurrent requests                      | `50`                               |
| `--duration <seconds>`   | Run for specified duration               | `null` (uses request count)        |
| `--tenant <subdomain>`   | Tenant subdomain for tenant-scoped tests | `null`                             |
| `--method <GET\|POST>`   | HTTP method                              | `GET`                              |
| `--body <json>`          | JSON body for POST requests              | `null`                             |
| `--delay <ms>`           | Delay between request batches            | `0`                                |
| `--verbose`              | Log each request                         | `false`                            |
| `--help`                 | Show help message                        | -                                  |

### Example Usage

#### Test Health Endpoint

```bash
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/health \
  --requests 10000 \
  --concurrency 50
```

#### Test Metrics Endpoint (Duration-Based)

```bash
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/metrics \
  --duration 120 \
  --concurrency 100
```

#### Test Tenant-Scoped Wells Endpoint

```bash
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/wells \
  --tenant acmeoil \
  --requests 5000 \
  --concurrency 100 \
  --verbose
```

#### Test Admin Users Endpoint with High Concurrency

```bash
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/admin/users \
  --requests 2000 \
  --concurrency 200
```

#### Test POST Requests (Create Wells)

```bash
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/wells \
  --tenant acmeoil \
  --method POST \
  --body '{"name":"Test Well","apiNumber":"API-12345","status":"ACTIVE"}' \
  --requests 100 \
  --concurrency 10
```

### Output Metrics

The script provides detailed statistics:

```
📊 TEST CONFIGURATION:
   Endpoint:       http://localhost:4000/api/health
   Method:         GET
   Total Requests: 10000
   Concurrency:    50

⏱️  PERFORMANCE:
   Total Duration:   45.32s
   Requests/Second:  220.65
   Avg Response Time: 12.45ms
   Min Response Time: 5ms
   Max Response Time: 234ms
   P50 (Median):      10ms
   P95:               25ms
   P99:               45ms

📈 REQUEST STATISTICS:
   Total Sent:     10000
   Completed:      10000
   Succeeded:      9987 (99.9%)
   Failed:         13 (0.1%)

📡 STATUS CODES:
   ✅ 200: 9987 (99.9%)
   ⚠️ 429: 13 (0.1%)
```

---

## Testing Scenarios

### 1. Connection Pool Stress Test

**Goal:** Test connection pool behavior under heavy load

```bash
# Test single tenant with high concurrency
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/wells \
  --tenant acmeoil \
  --requests 10000 \
  --concurrency 200

# Monitor connection pool metrics
watch -n 1 'curl -s http://localhost:4000/api/metrics | grep tenant_connection_pool'
```

**Expected Behavior:**

- Connection pool should scale up to handle load
- Idle connections should be reused
- No waiting clients (pool exhaustion)
- Response times should remain consistent

### 2. Rate Limiting Test

**Goal:** Verify rate limiting is working correctly

```bash
# Hammer endpoint to trigger rate limiting
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/health \
  --requests 1000 \
  --concurrency 500

# Look for 429 status codes in results
```

**Expected Behavior:**

- Initial requests succeed (200 OK)
- Rate limit kicks in (429 Too Many Requests)
- Error rate increases as concurrency rises

### 3. Multi-Tenant Load Test

**Goal:** Test tenant isolation under concurrent load

```bash
# Run multiple tests in parallel (different terminals)
node scripts/stress-test.js --tenant acmeoil --requests 5000 --concurrency 50 &
node scripts/stress-test.js --tenant demooil --requests 5000 --concurrency 50 &
node scripts/stress-test.js --tenant testoil --requests 5000 --concurrency 50 &

# Monitor per-tenant metrics
watch -n 1 'curl -s http://localhost:4000/api/metrics | grep tenant_connection_pool'
```

**Expected Behavior:**

- Each tenant should have independent connection pool
- No cross-tenant interference
- Connection pools should scale independently

### 4. Sustained Load Test

**Goal:** Test system stability over extended period

```bash
# Run for 10 minutes with moderate load
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/metrics \
  --duration 600 \
  --concurrency 50

# Monitor system metrics
watch -n 5 'curl -s http://localhost:4000/api/metrics | grep -E "(memory|cpu)"'
```

**Expected Behavior:**

- Memory usage should stabilize (no leaks)
- CPU usage should remain consistent
- Response times should not degrade over time
- No database connection leaks

### 5. Spike Test

**Goal:** Test system resilience to sudden traffic spikes

```bash
# Sudden burst of 500 concurrent requests
node scripts/stress-test.js \
  --endpoint http://localhost:4000/api/health \
  --requests 5000 \
  --concurrency 500

# Observe recovery time
```

**Expected Behavior:**

- System should handle spike gracefully
- Connection pools should scale up quickly
- Response times may spike initially but should stabilize
- No crashes or errors after spike

---

## Interpreting Results

### Key Metrics to Monitor

#### 1. Response Time Percentiles

- **P50 (Median):** Typical user experience
- **P95:** Most users' experience
- **P99:** Worst case (but not outliers)

**Thresholds:**

- P50 < 100ms: Excellent
- P95 < 500ms: Good
- P99 < 1000ms: Acceptable

#### 2. Error Rate

- **< 0.1%:** Excellent
- **< 1%:** Acceptable
- **> 5%:** Requires investigation

#### 3. Requests Per Second (RPS)

- Measure of throughput
- Compare to target load (e.g., 100 RPS for production)
- Higher is better (if error rate remains low)

#### 4. Connection Pool Utilization

Watch for:

- **High utilization (>80%):** May need to increase pool size
- **Waiting clients > 0:** Pool exhaustion, increase `max` setting
- **Idle connections consistently low:** May need to increase `min` setting

### Common Issues and Solutions

#### Issue: High P99 Latency

**Possible Causes:**

- Database connection pool exhaustion
- Long-running queries
- GC pauses

**Solutions:**

- Increase connection pool size
- Add database indexes
- Optimize slow queries

#### Issue: High Error Rate

**Possible Causes:**

- Rate limiting triggered
- Database connection failures
- Application crashes

**Solutions:**

- Reduce concurrency
- Check database connection settings
- Review application logs

#### Issue: Memory Leaks

**Symptoms:**

- Memory usage increases over time
- No stabilization after warm-up
- Eventual crash

**Solutions:**

- Check for unclosed connections
- Review event listeners
- Profile with Chrome DevTools

---

## Best Practices

### 1. Start Small, Scale Up

```bash
# Start with light load
node scripts/stress-test.js --requests 100 --concurrency 10

# Gradually increase
node scripts/stress-test.js --requests 1000 --concurrency 50

# Finally, stress test
node scripts/stress-test.js --requests 10000 --concurrency 200
```

### 2. Monitor System Metrics

Run stress tests while monitoring:

```bash
# Terminal 1: Run stress test
node scripts/stress-test.js --duration 300 --concurrency 100

# Terminal 2: Watch metrics
watch -n 2 'curl -s http://localhost:4000/api/metrics | grep -E "(pool|memory|cpu|http)"'

# Terminal 3: Watch connection pools
watch -n 1 'curl -s http://localhost:4000/api/metrics | grep tenant_connection_pool'
```

### 3. Test Realistic Scenarios

**Bad:**

```bash
# Unrealistic: All requests to same endpoint
node scripts/stress-test.js --endpoint /api/health --requests 100000
```

**Good:**

```bash
# Realistic: Mixed operations via Artillery
npx artillery run artillery-load-test.yml
```

### 4. Test Different Tenant Scenarios

```bash
# Single tenant (typical usage)
node scripts/stress-test.js --tenant acmeoil --requests 5000

# Multi-tenant (production simulation)
npx artillery run artillery-load-test.yml  # Uses multiple tenants
```

### 5. Use Duration-Based Tests for Stability

```bash
# Run for 5 minutes to detect memory leaks
node scripts/stress-test.js --duration 300 --concurrency 50

# Compare memory at start vs end
```

### 6. Save Results for Comparison

```bash
# Artillery: Save JSON results
npx artillery run --output results-$(date +%Y%m%d-%H%M%S).json artillery-load-test.yml

# Custom script: Redirect output
node scripts/stress-test.js --requests 10000 > results-$(date +%Y%m%d-%H%M%S).txt
```

### 7. Test in Isolation

- Stop dev servers before stress testing
- Close other applications
- Use dedicated database (not shared dev DB)
- Test on production-like hardware

### 8. Set Realistic Thresholds

For WellPulse (small/medium operators):

```yaml
# Expected production load (per hour)
- 50-500 active users
- ~10-100 requests per second
- P95 < 500ms
- Error rate < 0.1%
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  stress-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - name: Install dependencies
        run: pnpm install

      - name: Start API
        run: pnpm --filter=api dev &

      - name: Wait for API
        run: sleep 10

      - name: Run Artillery load test
        run: npx artillery run artillery-load-test.yml

      - name: Run custom stress test
        run: node scripts/stress-test.js --requests 1000 --concurrency 50

      - name: Check thresholds
        run: |
          # Parse results and fail if thresholds exceeded
          node scripts/check-performance-thresholds.js
```

---

## Troubleshooting

### Artillery Not Found

```bash
# Install Artillery locally
pnpm add -D artillery

# Or use npx
npx artillery@latest run artillery-load-test.yml
```

### Custom Script Errors

```bash
# Make script executable
chmod +x scripts/stress-test.js

# Run with node explicitly
node scripts/stress-test.js --help
```

### Connection Refused

```bash
# Ensure API is running
pnpm --filter=api dev

# Check port
lsof -i :4000

# Test endpoint manually
curl http://localhost:4000/api/health
```

### High Error Rates

```bash
# Check API logs for errors
pnpm --filter=api dev  # Watch console output

# Reduce concurrency
node scripts/stress-test.js --concurrency 10  # Start low

# Check rate limiting
curl -s http://localhost:4000/api/metrics | grep rate_limit
```

---

## Next Steps

1. **Baseline Testing:** Run light load test to establish baseline metrics
2. **Incremental Stress:** Gradually increase load to find breaking point
3. **Optimize:** Based on results, optimize connection pools, add indexes, etc.
4. **Re-test:** Verify optimizations improved performance
5. **Production Monitoring:** Set up alerts based on stress test thresholds

---

## References

- [Artillery Documentation](https://www.artillery.io/docs)
- [Node.js HTTP Module](https://nodejs.org/api/http.html)
- [WellPulse API Rate Limiting](./api-rate-limiting.md)
- [Connection Pool Pattern](../patterns/69-Database-Per-Tenant-Multi-Tenancy-Pattern.md)
