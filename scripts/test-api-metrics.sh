#!/bin/bash

# Test API Metrics Script
#
# Generates API traffic to populate the admin metrics dashboard.
# Makes requests to different tenant subdomains to trigger connection pool creation.
#
# Usage: ./scripts/test-api-metrics.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   WellPulse API Metrics Test Script     ║${NC}"
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo ""

# API base URLs
API_URL="http://localhost:4000/api"
ADMIN_URL="http://localhost:4002"

echo -e "${YELLOW}📍 Testing API endpoints...${NC}"
echo ""

# Test 1: Health check (no tenant context needed)
echo -e "${GREEN}[1/6]${NC} Testing health endpoint..."
curl -s "${API_URL}/health" | jq '.' || echo "Health check failed"
echo ""

# Test 2: Global metrics endpoint
echo -e "${GREEN}[2/6]${NC} Testing metrics endpoint..."
curl -s "${API_URL}/metrics" | head -n 5
echo "... (metrics truncated)"
echo ""

# Test 3: ACME tenant - Wells endpoint (requires authentication)
echo -e "${GREEN}[3/6]${NC} Testing ACME tenant wells endpoint..."
echo "Making request to acme subdomain..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Host: acme.localhost" \
  "${API_URL}/wells" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${YELLOW}⚠️  Got ${HTTP_CODE} (expected - auth required). Connection pool created!${NC}"
elif [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Success (200)${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Got HTTP ${HTTP_CODE}${NC}"
fi
echo ""

# Test 4: WellPulse internal tenant - Wells endpoint
echo -e "${GREEN}[4/6]${NC} Testing WellPulse internal tenant wells endpoint..."
echo "Making request to wellpulse subdomain..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Host: wellpulse.localhost" \
  "${API_URL}/wells" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${YELLOW}⚠️  Got ${HTTP_CODE} (expected - auth required). Connection pool created!${NC}"
elif [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Success (200)${NC}"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Got HTTP ${HTTP_CODE}${NC}"
fi
echo ""

# Test 5: Make multiple requests to simulate traffic
echo -e "${GREEN}[5/6]${NC} Generating traffic (10 requests)..."
for i in {1..10}; do
  curl -s -H "Host: acme.localhost" "http://localhost:4000/api/health" > /dev/null
  echo -n "."
done
echo ""
echo -e "${GREEN}✅ Traffic generated${NC}"
echo ""

# Test 6: Check current metrics
echo -e "${GREEN}[6/6]${NC} Checking updated metrics..."
echo ""
echo "Connection pool metrics:"
curl -s "${API_URL}/metrics" | grep "tenant_connection_pool" | head -n 10
echo ""

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            Test Complete! ✅              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📊 View the metrics dashboard:${NC}"
echo -e "   ${ADMIN_URL}/metrics"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   • Dashboard auto-refreshes every 10 seconds"
echo -e "   • Connection pools show 2-10 connections after API calls"
echo -e "   • HTTP metrics increment with each request"
echo -e "   • Run this script multiple times to see metrics change"
echo ""
