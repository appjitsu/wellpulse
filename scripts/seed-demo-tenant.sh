#!/bin/bash

###############################################################################
# WellPulse Demo Tenant Seed Script
#
# Populates the demo tenant with initial test data:
# - Wells
# - SCADA connections and readings
# - Alerts
# - Field entries
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="http://demo.localhost:4000"
ADMIN_EMAIL="admin@wellpulse.app"
ADMIN_PASSWORD="Admin123!@#"

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

###############################################################################
# Step 1: Login
###############################################################################

log_info "Logging in as ${ADMIN_EMAIL}..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  -c /tmp/demo-cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  log_error "Login failed (HTTP $HTTP_CODE): $BODY"
fi

ACCESS_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -z "$ACCESS_TOKEN" ]; then
  log_error "Failed to extract access token from response"
fi

log_success "Logged in successfully"

###############################################################################
# Step 2: Create Test Wells
###############################################################################

log_info "Creating test wells..."

# Well 1: High producer
WELL1_RESPONSE=$(curl -s -X POST "${API_URL}/api/wells" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d '{
    "apiNumber": "42-123-12345",
    "wellName": "Permian Star #1",
    "latitude": 31.8457,
    "longitude": -102.3676,
    "status": "ACTIVE",
    "wellType": "beam-pump",
    "fieldName": "West Texas Field"
  }')

WELL1_ID=$(echo "$WELL1_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
log_success "Created well: Permian Star #1 (ID: ${WELL1_ID})"

# Well 2: Medium producer
WELL2_RESPONSE=$(curl -s -X POST "${API_URL}/api/wells" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d '{
    "apiNumber": "42-123-12346",
    "wellName": "Midland Pride #2",
    "latitude": 32.0015,
    "longitude": -102.0778,
    "status": "ACTIVE",
    "wellType": "pcp",
    "fieldName": "Midland Field"
  }')

WELL2_ID=$(echo "$WELL2_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
log_success "Created well: Midland Pride #2 (ID: ${WELL2_ID})"

# Well 3: Low producer with issues
WELL3_RESPONSE=$(curl -s -X POST "${API_URL}/api/wells" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d '{
    "apiNumber": "42-123-12347",
    "wellName": "Desert Fox #3",
    "latitude": 31.9234,
    "longitude": -102.5432,
    "status": "ACTIVE",
    "wellType": "beam-pump",
    "fieldName": "West Texas Field"
  }')

WELL3_ID=$(echo "$WELL3_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
log_success "Created well: Desert Fox #3 (ID: ${WELL3_ID})"

# Well 4: Inactive
WELL4_RESPONSE=$(curl -s -X POST "${API_URL}/api/wells" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d '{
    "apiNumber": "42-123-12348",
    "wellName": "Sunset Valley #4",
    "latitude": 31.7890,
    "longitude": -102.4321,
    "status": "INACTIVE",
    "wellType": "beam-pump",
    "fieldName": "West Texas Field"
  }')

WELL4_ID=$(echo "$WELL4_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
log_success "Created well: Sunset Valley #4 (ID: ${WELL4_ID})"

###############################################################################
# Step 3: Create SCADA Connection for Well 1
###############################################################################

log_info "Creating SCADA connection for Permian Star #1..."

SCADA_RESPONSE=$(curl -s -X POST "${API_URL}/api/scada/connections" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d "{
    \"connectionName\": \"Permian Star SCADA\",
    \"connectionType\": \"MQTT\",
    \"host\": \"mqtt.wellpulse.local\",
    \"port\": 1883,
    \"protocol\": \"mqtt\",
    \"wellId\": \"${WELL1_ID}\",
    \"isActive\": true
  }")

SCADA_ID=$(echo "$SCADA_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')
log_success "Created SCADA connection (ID: ${SCADA_ID})"

###############################################################################
# Step 4: Create Tag Mappings
###############################################################################

log_info "Creating tag mappings..."

# Tag 1: Tubing Pressure
curl -s -X POST "${API_URL}/api/scada/tag-mappings" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d "{
    \"scadaConnectionId\": \"${SCADA_ID}\",
    \"scadaTagName\": \"TUBING_PRESSURE\",
    \"dataType\": \"number\",
    \"unit\": \"PSI\",
    \"minValue\": 0,
    \"maxValue\": 1000
  }" > /dev/null

log_success "Created tag mapping: TUBING_PRESSURE"

# Tag 2: Casing Pressure
curl -s -X POST "${API_URL}/api/scada/tag-mappings" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d "{
    \"scadaConnectionId\": \"${SCADA_ID}\",
    \"scadaTagName\": \"CASING_PRESSURE\",
    \"dataType\": \"number\",
    \"unit\": \"PSI\",
    \"minValue\": 0,
    \"maxValue\": 1500
  }" > /dev/null

log_success "Created tag mapping: CASING_PRESSURE"

# Tag 3: Flow Rate
curl -s -X POST "${API_URL}/api/scada/tag-mappings" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d "{
    \"scadaConnectionId\": \"${SCADA_ID}\",
    \"scadaTagName\": \"FLOW_RATE\",
    \"dataType\": \"number\",
    \"unit\": \"BBL/DAY\",
    \"minValue\": 0,
    \"maxValue\": 200
  }" > /dev/null

log_success "Created tag mapping: FLOW_RATE"

###############################################################################
# Step 5: Generate SCADA Readings
###############################################################################

log_info "Generating SCADA readings..."

# Generate 50 readings over the past 24 hours
for i in {1..50}; do
  HOURS_AGO=$((24 - (i * 24 / 50)))
  TIMESTAMP=$(date -u -v-${HOURS_AGO}H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "${HOURS_AGO} hours ago" +"%Y-%m-%dT%H:%M:%SZ")

  TUBING_PRESSURE=$((300 + RANDOM % 200))
  CASING_PRESSURE=$((500 + RANDOM % 400))
  FLOW_RATE=$((80 + RANDOM % 60))

  curl -s -X POST "${API_URL}/api/scada/readings" \
    -H "Content-Type: application/json" \
    -H "Host: demo.localhost:4000" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -b /tmp/demo-cookies.txt \
    -d "{
      \"scadaConnectionId\": \"${SCADA_ID}\",
      \"readings\": [
        {\"tagName\": \"TUBING_PRESSURE\", \"value\": ${TUBING_PRESSURE}, \"unit\": \"PSI\", \"timestamp\": \"${TIMESTAMP}\"},
        {\"tagName\": \"CASING_PRESSURE\", \"value\": ${CASING_PRESSURE}, \"unit\": \"PSI\", \"timestamp\": \"${TIMESTAMP}\"},
        {\"tagName\": \"FLOW_RATE\", \"value\": ${FLOW_RATE}, \"unit\": \"BBL/DAY\", \"timestamp\": \"${TIMESTAMP}\"}
      ]
    }" > /dev/null

  if [ $((i % 10)) -eq 0 ]; then
    log_success "Generated ${i}/50 readings..."
  fi
done

log_success "Generated 50 SCADA readings"

###############################################################################
# Step 6: Create Field Entries
###############################################################################

log_info "Creating field entries..."

# Entry 1: Yesterday morning
YESTERDAY=$(date -u -v-1d +"%Y-%m-%dT08:00:00Z" 2>/dev/null || date -u -d "1 day ago" +"%Y-%m-%dT08:00:00Z")

curl -s -X POST "${API_URL}/api/wells/${WELL1_ID}/field-entries" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d "{
    \"wellId\": \"${WELL1_ID}\",
    \"entryDate\": \"${YESTERDAY}\",
    \"oilVolume\": 125.5,
    \"gasVolume\": 450.2,
    \"waterVolume\": 15.3,
    \"runTime\": 23.5,
    \"chokeSize\": \"24/64\",
    \"notes\": \"Normal operations. Pressure stable.\"
  }" > /dev/null

log_success "Created field entry for yesterday"

# Entry 2: Today morning
TODAY=$(date -u +"%Y-%m-%dT08:00:00Z")

curl -s -X POST "${API_URL}/api/wells/${WELL1_ID}/field-entries" \
  -H "Content-Type: application/json" \
  -H "Host: demo.localhost:4000" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/demo-cookies.txt \
  -d "{
    \"wellId\": \"${WELL1_ID}\",
    \"entryDate\": \"${TODAY}\",
    \"oilVolume\": 130.2,
    \"gasVolume\": 465.8,
    \"waterVolume\": 14.1,
    \"runTime\": 24.0,
    \"chokeSize\": \"24/64\",
    \"notes\": \"Production increased slightly. All systems normal.\"
  }" > /dev/null

log_success "Created field entry for today"

###############################################################################
# Summary
###############################################################################

echo ""
log_success "✨ Demo tenant seeded successfully!"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Created:${NC}"
echo -e "  • 4 wells (3 active, 1 inactive)"
echo -e "  • 1 SCADA connection with 3 tag mappings"
echo -e "  • 50 SCADA readings (24-hour history)"
echo -e "  • 2 field entries"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Dashboard should now load with data!${NC}"
echo -e "${BLUE}   URL: http://demo.localhost:4001${NC}"
echo ""

# Cleanup
rm -f /tmp/demo-cookies.txt
