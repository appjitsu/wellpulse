#!/bin/bash

###############################################################################
# WellPulse API Load Testing Runner
#
# Runs Artillery load tests with various configurations.
# Generates HTML reports and performance analysis.
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:4000}"
REPORT_DIR="./load-test-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create report directory
mkdir -p "$REPORT_DIR"

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_api_health() {
    print_info "Checking API health..."

    if curl -s -f "$API_URL/health" > /dev/null; then
        print_success "API is healthy and ready for load testing"
        return 0
    else
        print_error "API is not responding at $API_URL"
        print_error "Please start the API server before running load tests"
        return 1
    fi
}

run_test() {
    local test_type=$1
    local config_file=$2
    local report_name="${test_type}_${TIMESTAMP}"

    print_header "Running $test_type"

    # Run Artillery with HTML report
    npx artillery run \
        --config "$config_file" \
        --output "$REPORT_DIR/${report_name}.json" \
        2>&1 | tee "$REPORT_DIR/${report_name}.log"

    # Generate HTML report
    if [ -f "$REPORT_DIR/${report_name}.json" ]; then
        npx artillery report \
            "$REPORT_DIR/${report_name}.json" \
            --output "$REPORT_DIR/${report_name}.html"

        print_success "Report generated: $REPORT_DIR/${report_name}.html"
    fi
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [TEST_TYPE]

Run Artillery load tests for WellPulse API

TEST_TYPE:
    smoke       Quick smoke test (1 minute, low load)
    load        Standard load test (7 minutes, medium load)
    stress      Stress test (10 minutes, high load to find limits)
    soak        Endurance test (1+ hour, sustained load)
    all         Run all test types sequentially

OPTIONS:
    -h, --help          Show this help message
    -u, --url URL       API base URL (default: http://localhost:4000)
    -s, --skip-health   Skip API health check
    -c, --clean         Clean previous reports before running

EXAMPLES:
    # Run smoke test
    $0 smoke

    # Run load test against staging
    $0 --url https://staging.wellpulse.io load

    # Run all tests
    $0 all

    # Clean reports and run stress test
    $0 --clean stress

REPORTS:
    HTML reports are saved to: $REPORT_DIR/
    Open the .html files in a browser to view detailed metrics

EOF
}

clean_reports() {
    print_info "Cleaning previous reports..."
    rm -rf "$REPORT_DIR"
    mkdir -p "$REPORT_DIR"
    print_success "Reports cleaned"
}

###############################################################################
# Main Script
###############################################################################

# Parse arguments
SKIP_HEALTH=false
TEST_TYPE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -u|--url)
            API_URL="$2"
            shift 2
            ;;
        -s|--skip-health)
            SKIP_HEALTH=true
            shift
            ;;
        -c|--clean)
            clean_reports
            shift
            ;;
        smoke|load|stress|soak|all)
            TEST_TYPE="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate test type
if [ -z "$TEST_TYPE" ]; then
    print_error "No test type specified"
    show_usage
    exit 1
fi

# Check API health (unless skipped)
if [ "$SKIP_HEALTH" = false ]; then
    if ! check_api_health; then
        exit 1
    fi
fi

print_info "API URL: $API_URL"
print_info "Report directory: $REPORT_DIR"
echo ""

# Run tests based on type
case $TEST_TYPE in
    smoke)
        run_test "Smoke Test" "./load-tests/smoke-test.yml"
        ;;

    load)
        run_test "Load Test" "./artillery.yml"
        ;;

    stress)
        run_test "Stress Test" "./load-tests/stress-test.yml"
        ;;

    soak)
        print_warning "Soak test will run for over 1 hour"
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            run_test "Soak Test" "./load-tests/soak-test.yml"
        else
            print_info "Soak test cancelled"
        fi
        ;;

    all)
        print_header "Running All Load Tests"

        run_test "Smoke Test" "./load-tests/smoke-test.yml"
        sleep 30  # Cool-down between tests

        run_test "Load Test" "./artillery.yml"
        sleep 30

        run_test "Stress Test" "./load-tests/stress-test.yml"
        sleep 30

        print_warning "All quick tests completed. Soak test requires manual execution."
        ;;

    *)
        print_error "Unknown test type: $TEST_TYPE"
        show_usage
        exit 1
        ;;
esac

print_success "Load testing complete!"
print_info "View reports in: $REPORT_DIR/"
