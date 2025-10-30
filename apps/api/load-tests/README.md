# WellPulse API Load Testing

Comprehensive load testing suite using Artillery for the WellPulse API.

## Overview

This load testing suite provides multiple test scenarios to validate API performance, scalability, and reliability under various load conditions.

## Test Types

### 1. Smoke Test (`smoke-test.yml`)

**Purpose**: Quick validation that critical paths work correctly

**Duration**: 1 minute
**Load**: 1 user per second
**Use Case**: Run after deployments to verify basic functionality

```bash
pnpm load:smoke
# or
./scripts/run-load-tests.sh smoke
```

### 2. Load Test (`artillery.yml`)

**Purpose**: Simulate realistic production load with gradual ramp-up

**Duration**: 7 minutes
**Load Profile**:

- Warm-up: 5 users/sec (1 min)
- Ramp-up: 5→20 users/sec (2 min)
- Sustained: 20 users/sec (3 min)
- Spike: 50 users/sec (1 min)
- Cool-down: 5 users/sec (1 min)

**Performance Thresholds**:

- P95 < 1000ms
- P99 < 3000ms
- Error rate < 5%

```bash
pnpm load:test
# or
./scripts/run-load-tests.sh load
```

### 3. Stress Test (`stress-test.yml`)

**Purpose**: Find system breaking points and performance limits

**Duration**: 10 minutes
**Load Profile**:

- Ramp-up: 1→200 users/sec (6 min)
- Peak: 200 users/sec (3 min)
- Cool-down: 200→10 users/sec (1 min)

**Performance Thresholds** (lenient):

- P99 < 5000ms
- Error rate < 10%

```bash
pnpm load:stress
# or
./scripts/run-load-tests.sh stress
```

### 4. Soak Test (`soak-test.yml`)

**Purpose**: Verify system stability under sustained load (endurance testing)

**Duration**: 1+ hour
**Load**: 15 users/sec sustained

**Use Case**: Find memory leaks, resource exhaustion, and degradation over time

```bash
pnpm load:soak
# or
./scripts/run-load-tests.sh soak
```

## Test Scenarios

### Authentication Flow

- User login
- Token validation
- Token refresh
- Protected endpoint access

**Weight**: 20%

### Wells CRUD Operations

- List wells with pagination
- Get individual well details
- Create/update operations
- Error handling

**Weight**: 30%

### Field Data Entry

- Login and authentication
- Field entry creation
- Production data submission
- Validation and error handling

**Weight**: 25%

### Dashboard Metrics

- Dashboard statistics
- Production analytics
- Alert retrieval
- Real-time updates

**Weight**: 15%

### Health Checks

- Health endpoint
- Metrics endpoint
- Performance status

**Weight**: 10%

## Prerequisites

1. **API Server Running**:

   ```bash
   pnpm --filter=api dev
   ```

2. **Test User Account**:
   - Email: `loadtest@wellpulse.io`
   - Password: `LoadTest123!@#`
   - Ensure this user exists in your database

3. **Database Ready**:
   - PostgreSQL running
   - Test tenant provisioned
   - Sample data seeded (optional)

## Running Tests

### Via npm Scripts (Recommended)

```bash
# Smoke test (quick validation)
pnpm load:smoke

# Standard load test
pnpm load:test

# Stress test (find limits)
pnpm load:stress

# Soak test (endurance)
pnpm load:soak

# Run all tests sequentially
pnpm load:all
```

### Via Shell Script

```bash
# Basic usage
./scripts/run-load-tests.sh <test-type>

# With options
./scripts/run-load-tests.sh --url http://localhost:4000 load

# Clean previous reports
./scripts/run-load-tests.sh --clean smoke

# Skip health check
./scripts/run-load-tests.sh --skip-health load

# Show help
./scripts/run-load-tests.sh --help
```

### Via Artillery CLI Directly

```bash
# Run with custom target
npx artillery run --target http://localhost:4000 artillery.yml

# Run with custom config
npx artillery run --config load-tests/smoke-test.yml

# Generate report
npx artillery report results.json --output report.html
```

## Reports

### HTML Reports

After each test run, detailed HTML reports are generated in:

```
./load-test-reports/
├── smoke_test_20241029_150000.html
├── load_test_20241029_150500.html
├── stress_test_20241029_151000.html
└── ...
```

**Metrics Included**:

- Request rate (requests per second)
- Response time percentiles (p50, p95, p99, max)
- Error rates and types
- Latency distribution
- Throughput graphs
- Request/response codes

### JSON Results

Raw JSON data is also saved for programmatic analysis:

```
./load-test-reports/
├── smoke_test_20241029_150000.json
└── ...
```

## Custom Processor Functions

The `processor.js` file provides custom functions for test scenarios:

### Data Generation

- `generateProductionData()` - Random production volumes, pressures
- `generateWellName()` - Realistic well naming
- `generatePermianLocation()` - GPS coordinates in Permian Basin
- `generateFieldNotes()` - Realistic field notes

### Utilities

- `customThink()` - Random pause (1-5 seconds) between requests
- `logScenarioStart()` - Log when scenarios begin
- `logResponseTime()` - Log slow responses (>1s)
- `validateResponse()` - Validate JSON structure
- `setTenantHeaders()` - Add tenant context headers

### Lifecycle Hooks

- `beforeScenario()` - Setup before each virtual user
- `afterScenario()` - Cleanup after completion

## Performance Baselines

### Expected Performance (Development)

| Metric            | Target      | Degraded    | Critical    |
| ----------------- | ----------- | ----------- | ----------- |
| P95 Response Time | < 500ms     | < 1000ms    | > 1000ms    |
| P99 Response Time | < 1000ms    | < 3000ms    | > 3000ms    |
| Error Rate        | < 1%        | < 5%        | > 5%        |
| Throughput        | > 50 req/s  | > 20 req/s  | < 20 req/s  |
| Memory Usage      | < 500MB     | < 1GB       | > 1GB       |
| CPU Usage         | < 50%       | < 80%       | > 80%       |

### Expected Performance (Production - Azure)

| Metric            | Target      | Degraded    | Critical    |
| ----------------- | ----------- | ----------- | ----------- |
| P95 Response Time | < 200ms     | < 500ms     | > 500ms     |
| P99 Response Time | < 500ms     | < 1000ms    | > 1000ms    |
| Error Rate        | < 0.1%      | < 1%        | > 1%        |
| Throughput        | > 200 req/s | > 100 req/s | < 100 req/s |

## Troubleshooting

### API Not Responding

```bash
# Check if API is running
curl http://localhost:4000/health

# Restart API
pnpm --filter=api dev
```

### High Error Rates

- Verify test user exists and credentials are correct
- Check database connections
- Ensure sufficient database connection pool size
- Review API logs for errors

### Slow Response Times

- Check database query performance
- Verify connection pool settings
- Monitor memory/CPU usage
- Review slow query logs

### Memory Leaks

- Run soak test to identify leaks over time
- Monitor memory usage: `GET /health/performance`
- Check for unclosed database connections
- Review long-running async operations

## Integration with Monitoring

Load test results integrate with:

1. **Prometheus Metrics** (`/metrics` endpoint)
2. **Performance Monitoring Service** (`/health/performance`)
3. **Application Insights** (if configured)

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Load Testing
  run: |
    pnpm --filter=api dev &
    sleep 10
    pnpm load:smoke
    pnpm load:test
```

### Pre-Deployment Validation

```bash
# Run before deploying to production
./scripts/run-load-tests.sh --url https://staging.wellpulse.io all
```

## Advanced Usage

### Custom Target URL

```bash
export API_URL=https://staging.wellpulse.io
./scripts/run-load-tests.sh load
```

### Environment Variables

```bash
# Artillery environment variables
export TARGET=http://localhost:4000
export ARTILLERY_WORKERS=4  # Parallel workers

# Run test
npx artillery run artillery.yml
```

### Custom Scenario

Create a new YAML file in `load-tests/`:

```yaml
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Custom Scenario"
    flow:
      # Your test steps
```

## Best Practices

1. **Start Small**: Begin with smoke tests, then progress to load/stress/soak
2. **Baseline First**: Establish performance baselines before making changes
3. **Isolate Tests**: Run tests on isolated environments when possible
4. **Monitor Resources**: Watch CPU, memory, database connections during tests
5. **Clean Data**: Consider cleaning test data between runs
6. **Realistic Scenarios**: Use realistic data and user behavior patterns
7. **Document Baselines**: Record expected performance metrics
8. **Schedule Regular Tests**: Run load tests on a schedule (e.g., nightly)

## References

- [Artillery Documentation](https://www.artillery.io/docs)
- [Performance Monitoring Service](../src/infrastructure/monitoring/README.md)
- [API Documentation](../../docs/apps/api-feature-specification.md)
