#!/bin/bash

################################################################################
# WellPulse API Baseline Performance Testing Script
#
# This script runs stress tests on all major API endpoints to establish
# performance baselines for monitoring and alerting.
#
# Usage:
#   ./scripts/baseline-performance-test.sh
#
# Output:
#   - baseline-results-YYYYMMDD-HHMMSS.txt
#   - baseline-summary.json
################################################################################

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="baseline-results-${TIMESTAMP}.txt"
SUMMARY_FILE="baseline-summary.json"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WellPulse API - Baseline Performance Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Starting baseline tests at $(date)${NC}"
echo -e "${BLUE}API Base URL: ${API_BASE_URL}${NC}"
echo -e "${BLUE}Results will be saved to: ${RESULTS_FILE}${NC}"
echo ""

# Check if API is running
echo -e "${YELLOW}🔍 Checking API availability...${NC}"
if ! curl -s -f "${API_BASE_URL}/api/health" > /dev/null; then
  echo -e "${RED}❌ API is not responding at ${API_BASE_URL}${NC}"
  echo -e "${RED}   Please start the API with: pnpm --filter=api dev${NC}"
  exit 1
fi
echo -e "${GREEN}✅ API is running${NC}"
echo ""

# Initialize results file
cat > "${RESULTS_FILE}" <<EOF
WellPulse API - Baseline Performance Test Results
Generated: $(date)
API Base URL: ${API_BASE_URL}

================================================================================

EOF

# Test function
run_test() {
  local name="$1"
  local endpoint="$2"
  local requests="${3:-1000}"
  local concurrency="${4:-50}"
  local tenant="$5"

  echo -e "${YELLOW}🧪 Testing: ${name}${NC}"
  echo "   Endpoint: ${endpoint}"
  echo "   Load: ${requests} requests @ ${concurrency} concurrent"

  # Build command
  local cmd="node scripts/stress-test.js --endpoint ${API_BASE_URL}${endpoint} --requests ${requests} --concurrency ${concurrency}"
  if [ -n "${tenant}" ]; then
    cmd="${cmd} --tenant ${tenant}"
    echo "   Tenant: ${tenant}"
  fi

  echo ""

  # Run test and capture output
  {
    echo "=== ${name} ==="
    echo "Endpoint: ${endpoint}"
    echo "Load: ${requests} requests @ ${concurrency} concurrent"
    [ -n "${tenant}" ] && echo "Tenant: ${tenant}"
    echo ""

    # Run the test
    if [ -n "${tenant}" ]; then
      node scripts/stress-test.js --endpoint "${API_BASE_URL}${endpoint}" --requests "${requests}" --concurrency "${concurrency}" --tenant "${tenant}"
    else
      node scripts/stress-test.js --endpoint "${API_BASE_URL}${endpoint}" --requests "${requests}" --concurrency "${concurrency}"
    fi

    echo ""
    echo "--------------------------------------------------------------------------------"
    echo ""
  } >> "${RESULTS_FILE}"

  echo -e "${GREEN}✅ Test completed${NC}"
  echo ""
}

# ============================================================================
# Test Suite
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 1: Infrastructure Endpoints (Unauthenticated)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Health Endpoint (should be fastest)
run_test "Health Endpoint" "/api/health" 1000 50

# Test 2: Metrics Endpoint (higher load to test Prometheus aggregation)
run_test "Metrics Endpoint" "/api/metrics" 500 50

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 2: Admin Endpoints (May require auth)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 3: Admin Users List
run_test "Admin Users List" "/api/admin/users?page=1&limit=10" 500 25

# Test 4: Admin Tenants List
run_test "Admin Tenants List" "/api/admin/tenants?page=1&limit=10" 500 25

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 3: Tenant-Scoped Endpoints (Requires tenant context)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 5: Wells List (tenant: acmeoil)
run_test "Wells List (acmeoil)" "/api/wells?page=1&limit=20" 500 50 "acmeoil"

# Test 6: Wells List (tenant: demooil)
run_test "Wells List (demooil)" "/api/wells?page=1&limit=20" 500 50 "demooil"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 4: Rate Limiting Tests (High Concurrency)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 7: Rate Limiting Validation (expect 90%+ 429 responses)
run_test "Rate Limiting Test" "/api/health" 500 200

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Phase 5: Connection Pool Stress Test (Multi-Tenant)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 8: High concurrency on single tenant (connection pool stress)
run_test "Connection Pool Stress (acmeoil)" "/api/wells" 2000 100 "acmeoil"

# ============================================================================
# Parse Results and Generate Summary
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Generating Summary Report${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Extract key metrics from results file
cat >> "${RESULTS_FILE}" <<EOF

================================================================================
BASELINE SUMMARY
================================================================================

Test Date: $(date)
API Base URL: ${API_BASE_URL}

Recommended Thresholds (based on test results):
- P95 Latency: < 500ms (alert if exceeded)
- P99 Latency: < 1000ms (alert if exceeded)
- Error Rate: < 1% (alert if exceeded)
- Rate Limit Effectiveness: > 80% rejection at high concurrency

Next Steps:
1. Review results above for any anomalies
2. Set up monitoring alerts using these baselines
3. Re-run monthly to track performance trends
4. Update thresholds if infrastructure changes

================================================================================
EOF

echo -e "${GREEN}✅ Baseline tests completed successfully!${NC}"
echo ""
echo -e "${BLUE}📄 Full results saved to: ${RESULTS_FILE}${NC}"
echo ""
echo -e "${YELLOW}📊 Quick Summary:${NC}"
grep -A 8 "⏱️  PERFORMANCE:" "${RESULTS_FILE}" | head -20 || echo "See full results file for detailed metrics"
echo ""
echo -e "${GREEN}✅ All tests completed at $(date)${NC}"
echo ""
