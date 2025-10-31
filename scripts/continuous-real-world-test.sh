#!/bin/bash

###############################################################################
# WellPulse Continuous Real-World Simulation
#
# Simulates a 24-hour oil & gas operation cycle with realistic patterns:
# - SCADA data streaming (continuous with varying frequency)
# - Pumper field data entry (morning and evening shifts)
# - Random anomalies and alarms
# - Low activity (night) vs peak activity (day)
#
# Time Compression: 1 hour = 2 minutes (12x speed)
# - Full 24-hour cycle = 48 minutes
# - Repeats continuously
###############################################################################

set -eo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:4000}"
TENANT_SUBDOMAIN="${1:-demo}"
CYCLE_DURATION_MINUTES=48  # 24 simulated hours
HOUR_DURATION_SECONDS=120  # 2 minutes per simulated hour

# Credentials
ADMIN_EMAIL="admin@wellpulse.app"
ADMIN_PASSWORD="WellPulse2025!"
TENANT_ADMIN_EMAIL="andy@demo.com"
TENANT_ADMIN_PASSWORD="demo123"
MANAGER_EMAIL="mandy@demo.com"
MANAGER_PASSWORD="demo123"
PUMPER_EMAIL="peter@demo.com"
PUMPER_PASSWORD="demo123"

# Global state
MASTER_ADMIN_TOKEN=""
TENANT_ID=""
TENANT_ADMIN_TOKEN=""
MANAGER_TOKEN=""
PUMPER_TOKEN=""
WELL_ID=""
SCADA_CONNECTION_ID=""
SIMULATION_START_TIME=0
CURRENT_SIMULATED_HOUR=0
TOTAL_SCADA_READINGS=0
TOTAL_FIELD_ENTRIES=0
TOTAL_ALARMS=0
ALARMS_ACKNOWLEDGED=0

###############################################################################
# Utility Functions
###############################################################################

log_info() {
  echo -e "${BLUE}[$(date +'%H:%M:%S')] ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

log_stat() {
  echo -e "${CYAN}[$(date +'%H:%M:%S')] 📊 $1${NC}"
}

log_time() {
  echo -e "${MAGENTA}[$(date +'%H:%M:%S')] 🕐 $1${NC}"
}

# Generate random value within range
random_in_range() {
  local min=$1
  local max=$2
  echo $((min + RANDOM % (max - min + 1)))
}

# Generate random float
random_float() {
  local min=$1
  local max=$2
  local decimals=$3
  python3 -c "import random; print(round(random.uniform($min, $max), $decimals))"
}

# Calculate simulated hour (0-23)
get_simulated_hour() {
  local elapsed=$(($(date +%s) - SIMULATION_START_TIME))
  echo $(((elapsed / HOUR_DURATION_SECONDS) % 24))
}

# Get activity level based on time of day
get_activity_level() {
  local hour=$1

  if [ $hour -ge 0 ] && [ $hour -lt 6 ]; then
    echo "NIGHT"  # Low activity, few alarms
  elif [ $hour -ge 6 ] && [ $hour -lt 8 ]; then
    echo "MORNING_SHIFT"  # Pumper arrives, field entry
  elif [ $hour -ge 8 ] && [ $hour -lt 17 ]; then
    echo "DAY_OPERATIONS"  # Normal activity, peak SCADA
  elif [ $hour -ge 17 ] && [ $hour -lt 19 ]; then
    echo "EVENING_SHIFT"  # Pumper end-of-day entry
  else
    echo "EVENING"  # Moderate activity
  fi
}

# Get SCADA reading frequency based on activity
get_scada_frequency() {
  local activity=$1

  case $activity in
    NIGHT)
      echo 10  # 1 reading every 10 seconds
      ;;
    MORNING_SHIFT|EVENING_SHIFT)
      echo 5   # 1 reading every 5 seconds
      ;;
    DAY_OPERATIONS)
      echo 2   # 1 reading every 2 seconds (peak)
      ;;
    EVENING)
      echo 7   # 1 reading every 7 seconds
      ;;
    *)
      echo 5
      ;;
  esac
}

###############################################################################
# Setup Functions
###############################################################################

setup_system() {
  log_info "🚀 Initializing WellPulse Continuous Simulation..."

  # Wait for API
  log_info "Waiting for API to be ready..."
  local max_attempts=30
  local attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if curl -s "${API_URL}/api/health" > /dev/null 2>&1; then
      log_success "API is ready!"
      break
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  if [ $attempt -eq $max_attempts ]; then
    log_error "API failed to start"
    exit 1
  fi

  # Master admin login
  log_info "Authenticating as master admin..."
  local response=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Subdomain: wellpulse" \
    -d "{\"email\": \"${ADMIN_EMAIL}\", \"password\": \"${ADMIN_PASSWORD}\"}")
  MASTER_ADMIN_TOKEN=$(echo "$response" | jq -r '.accessToken // empty')

  if [ -z "$MASTER_ADMIN_TOKEN" ]; then
    log_error "Master admin login failed"
    exit 1
  fi
  log_success "Master admin authenticated"

  # Get or create tenant
  log_info "Setting up tenant: ${TENANT_SUBDOMAIN}..."
  local tenant_response=$(curl -s -X GET "${API_URL}/api/admin/tenants" \
    -H "Authorization: Bearer ${MASTER_ADMIN_TOKEN}")
  TENANT_ID=$(echo "$tenant_response" | jq -r ".tenants[] | select(.subdomain == \"${TENANT_SUBDOMAIN}\") | .id")

  if [ -z "$TENANT_ID" ]; then
    # Create tenant
    local create_response=$(curl -s -X POST "${API_URL}/api/admin/tenants" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${MASTER_ADMIN_TOKEN}" \
      -d "{
        \"name\": \"Real World Oil & Gas\",
        \"subdomain\": \"${TENANT_SUBDOMAIN}\",
        \"planTier\": \"ENTERPRISE\",
        \"billingEmail\": \"billing@${TENANT_SUBDOMAIN}.com\"
      }")
    TENANT_ID=$(echo "$create_response" | jq -r '.id // empty')
  fi
  log_success "Tenant ready: ${TENANT_ID}"

  # Authenticate users
  log_info "Authenticating tenant users..."

  local admin_response=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Subdomain: ${TENANT_SUBDOMAIN}" \
    -d "{\"email\": \"${TENANT_ADMIN_EMAIL}\", \"password\": \"${TENANT_ADMIN_PASSWORD}\"}")
  TENANT_ADMIN_TOKEN=$(echo "$admin_response" | jq -r '.accessToken')

  local manager_response=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Subdomain: ${TENANT_SUBDOMAIN}" \
    -d "{\"email\": \"${MANAGER_EMAIL}\", \"password\": \"${MANAGER_PASSWORD}\"}")
  MANAGER_TOKEN=$(echo "$manager_response" | jq -r '.accessToken')

  local pumper_response=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Subdomain: ${TENANT_SUBDOMAIN}" \
    -d "{\"email\": \"${PUMPER_EMAIL}\", \"password\": \"${PUMPER_PASSWORD}\"}")
  PUMPER_TOKEN=$(echo "$pumper_response" | jq -r '.accessToken')

  log_success "All users authenticated"

  # Get or create well
  log_info "Setting up well..."
  local well_response=$(curl -s -X GET "${API_URL}/api/wells" \
    -H "Authorization: Bearer ${TENANT_ADMIN_TOKEN}" \
    -H "X-Tenant-Subdomain: ${TENANT_SUBDOMAIN}")
  WELL_ID=$(echo "$well_response" | jq -r '.wells[] | select(.apiNumber == "42-501-12345") | .id')

  if [ -z "$WELL_ID" ]; then
    local create_well=$(curl -s -X POST "${API_URL}/api/wells" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TENANT_ADMIN_TOKEN}" \
      -H "X-Tenant-Subdomain: ${TENANT_SUBDOMAIN}" \
      -d '{
        "apiNumber": "42-501-12345",
        "name": "Anderson #1",
        "operator": "Real World Oil & Gas",
        "latitude": 31.8457,
        "longitude": -102.3676,
        "status": "ACTIVE",
        "field": "Permian Basin",
        "lease": "Anderson Lease"
      }')
    WELL_ID=$(echo "$create_well" | jq -r '.id')
  fi
  log_success "Well ready: Anderson #1 (${WELL_ID})"

  # Get or create SCADA connection
  log_info "Setting up SCADA connection..."
  local scada_response=$(curl -s -X GET "${API_URL}/api/scada/connections?wellId=${WELL_ID}" \
    -H "Authorization: Bearer ${TENANT_ADMIN_TOKEN}" \
    -H "X-Tenant-Subdomain: ${TENANT_SUBDOMAIN}")
  SCADA_CONNECTION_ID=$(echo "$scada_response" | jq -r '.[0].id // empty')

  if [ -z "$SCADA_CONNECTION_ID" ]; then
    local create_scada=$(curl -s -X POST "${API_URL}/api/scada/connections" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TENANT_ADMIN_TOKEN}" \
      -H "X-Tenant-Subdomain: ${TENANT_SUBDOMAIN}" \
      -d "{
        \"wellId\": \"${WELL_ID}\",
        \"name\": \"Anderson #1 SCADA\",
        \"description\": \"Emerson DeltaV SCADA system\",
        \"opcUaUrl\": \"opc.tcp://scada.realworld.local:4840\",
        \"securityMode\": \"SignAndEncrypt\",
        \"securityPolicy\": \"Basic256Sha256\",
        \"pollIntervalSeconds\": 5
      }")
    SCADA_CONNECTION_ID=$(echo "$create_scada" | jq -r '.connection.id // .id')

    # Create tag mappings
    curl -s -X POST "${API_URL}/api/scada/tag-mappings" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TENANT_ADMIN_TOKEN}" \
      -d "{
        \"scadaConnectionId\": \"${SCADA_CONNECTION_ID}\",
        \"tagMappings\": [
          {
            \"tagName\": \"CASING_PRESSURE\",
            \"opcUaNodeId\": \"ns=2;s=Anderson1.Pressure.Casing\",
            \"dataType\": \"number\",
            \"unit\": \"PSI\",
            \"minValue\": 0,
            \"maxValue\": 1500
          },
          {
            \"tagName\": \"TUBING_PRESSURE\",
            \"opcUaNodeId\": \"ns=2;s=Anderson1.Pressure.Tubing\",
            \"dataType\": \"number\",
            \"unit\": \"PSI\",
            \"minValue\": 0,
            \"maxValue\": 2000
          },
          {
            \"tagName\": \"OIL_TEMP\",
            \"opcUaNodeId\": \"ns=2;s=Anderson1.Temperature.Oil\",
            \"dataType\": \"number\",
            \"unit\": \"°F\",
            \"minValue\": 50,
            \"maxValue\": 200
          },
          {
            \"tagName\": \"FLOW_RATE\",
            \"opcUaNodeId\": \"ns=2;s=Anderson1.Flow.Oil\",
            \"dataType\": \"number\",
            \"unit\": \"BBL/DAY\",
            \"minValue\": 0,
            \"maxValue\": 200
          }
        ]
      }" > /dev/null
  fi
  log_success "SCADA connection ready: ${SCADA_CONNECTION_ID}"

  SIMULATION_START_TIME=$(date +%s)
  log_success "🎬 Simulation initialized! Starting 24-hour cycle..."
}

###############################################################################
# SCADA Data Generation
###############################################################################

generate_scada_reading() {
  local tag_name=$1
  local base_value=$2
  local variance=$3
  local min=$4
  local max=$5
  local activity=$6

  # Add variance based on activity level
  local activity_factor=1.0
  case $activity in
    NIGHT)
      activity_factor=0.5  # Stable at night
      ;;
    DAY_OPERATIONS)
      activity_factor=1.5  # More variation during day
      ;;
  esac

  # Generate value with variance
  local raw_value=$(python3 -c "import random; print(int($base_value + random.uniform(-$variance, $variance) * $activity_factor))")

  # Randomly generate anomalies (5% chance during day, 1% at night)
  local anomaly_chance=$((RANDOM % 100))
  local threshold=5
  [ "$activity" = "NIGHT" ] && threshold=1

  if [ $anomaly_chance -lt $threshold ]; then
    # Create anomaly
    if [ $((RANDOM % 2)) -eq 0 ]; then
      raw_value=$((max + RANDOM % 100))  # Above max
    else
      raw_value=$((min - RANDOM % 50))  # Below min
    fi
  fi

  # Clamp to realistic range
  [ $raw_value -lt $((min - 100)) ] && raw_value=$((min - 100))
  [ $raw_value -gt $((max + 100)) ] && raw_value=$((max + 100))

  echo $raw_value
}

send_scada_reading() {
  local tag_name=$1
  local value=$2
  local unit=$3
  local min=$4
  local max=$5

  local quality="GOOD"
  [ $value -lt $min ] && quality="OUT_OF_RANGE"
  [ $value -gt $max ] && quality="OUT_OF_RANGE"

  curl -s -X POST "${API_URL}/api/scada/readings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TENANT_ADMIN_TOKEN}" \
    -d "{
      \"wellId\": \"${WELL_ID}\",
      \"scadaConnectionId\": \"${SCADA_CONNECTION_ID}\",
      \"tagName\": \"${tag_name}\",
      \"value\": ${value},
      \"unit\": \"${unit}\",
      \"minValue\": ${min},
      \"maxValue\": ${max},
      \"quality\": \"${quality}\"
    }" > /dev/null 2>&1

  TOTAL_SCADA_READINGS=$((TOTAL_SCADA_READINGS + 1))

  if [ "$quality" != "GOOD" ]; then
    TOTAL_ALARMS=$((TOTAL_ALARMS + 1))
    log_warning "🚨 Anomaly detected: ${tag_name}=${value} ${unit} (${quality})"
  fi
}

###############################################################################
# Pumper Field Entry
###############################################################################

create_field_entry() {
  local hour=$1
  local shift=$2

  # Generate realistic production data with daily variation
  local oil_volume=$(random_float 75 95 1)
  local gas_volume=$(random_in_range 1000 1400)
  local water_volume=$(random_float 8 15 1)
  local hours_on=24
  local pump_strokes=1440
  local tubing_pressure=$(random_in_range 1100 1300)
  local casing_pressure=$(random_in_range 800 900)

  local notes="$shift shift - Normal operations."
  [ $((RANDOM % 10)) -eq 0 ] && notes="$shift shift - Minor equipment vibration noted."
  [ $((RANDOM % 15)) -eq 0 ] && notes="$shift shift - Routine maintenance performed."

  local response=$(curl -s -X POST "${API_URL}/api/field-data/entries" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${PUMPER_TOKEN}" \
    -d "{
      \"wellId\": \"${WELL_ID}\",
      \"entryDate\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"oilVolume\": ${oil_volume},
      \"gasVolume\": ${gas_volume},
      \"waterVolume\": ${water_volume},
      \"hoursOn\": ${hours_on},
      \"pumpStrokes\": ${pump_strokes},
      \"tubingPressure\": ${tubing_pressure},
      \"casingPressure\": ${casing_pressure},
      \"chokeSize\": 32,
      \"notes\": \"${notes}\",
      \"status\": \"NORMAL\"
    }")

  local entry_id=$(echo "$response" | jq -r '.id // empty')
  if [ -n "$entry_id" ]; then
    TOTAL_FIELD_ENTRIES=$((TOTAL_FIELD_ENTRIES + 1))
    log_success "📝 Pumper field entry: Oil=${oil_volume} bbl, Gas=${gas_volume} mcf, Water=${water_volume} bbl"
  fi
}

###############################################################################
# Alarm Management
###############################################################################

acknowledge_alarms() {
  local response=$(curl -s -X GET "${API_URL}/api/alarms?wellId=${WELL_ID}" \
    -H "Authorization: Bearer ${MANAGER_TOKEN}")

  local count=$(echo "$response" | jq 'length')

  if [ "$count" -gt 0 ]; then
    local alarm_id=$(echo "$response" | jq -r '.[0].id')
    if [ -n "$alarm_id" ] && [ "$alarm_id" != "null" ]; then
      curl -s -X PATCH "${API_URL}/api/alarms/${alarm_id}/acknowledge" \
        -H "Authorization: Bearer ${MANAGER_TOKEN}" > /dev/null 2>&1
      ALARMS_ACKNOWLEDGED=$((ALARMS_ACKNOWLEDGED + 1))
      log_success "✓ Manager acknowledged alarm: ${alarm_id}"
    fi
  fi
}

###############################################################################
# Statistics Display
###############################################################################

print_statistics() {
  local hour=$1
  local activity=$2
  local elapsed=$(($(date +%s) - SIMULATION_START_TIME))
  local cycle_number=$((elapsed / (HOUR_DURATION_SECONDS * 24) + 1))

  echo ""
  log_stat "═══════════════════════════════════════════════════════"
  log_time "Simulated Time: ${hour}:00 (Cycle #${cycle_number}) - Activity: ${activity}"
  log_stat "SCADA Readings: ${TOTAL_SCADA_READINGS} | Field Entries: ${TOTAL_FIELD_ENTRIES}"
  log_stat "Alarms Generated: ${TOTAL_ALARMS} | Acknowledged: ${ALARMS_ACKNOWLEDGED}"
  log_stat "═══════════════════════════════════════════════════════"
  echo ""
}

###############################################################################
# Main Simulation Loop
###############################################################################

run_simulation_cycle() {
  local hour=$1
  local activity=$(get_activity_level $hour)
  local frequency=$(get_scada_frequency $activity)

  log_time "⏰ Hour ${hour}:00 - ${activity} (SCADA frequency: ${frequency}s)"

  # Pumper field entries (morning and evening shifts)
  if [ $hour -eq 7 ]; then
    create_field_entry $hour "Morning"
  elif [ $hour -eq 18 ]; then
    create_field_entry $hour "Evening"
  fi

  # Manager acknowledges alarms during business hours
  if [ $hour -ge 8 ] && [ $hour -lt 17 ] && [ $((RANDOM % 5)) -eq 0 ]; then
    acknowledge_alarms
  fi

  # SCADA readings for the hour
  local readings_per_hour=$((HOUR_DURATION_SECONDS / frequency))
  local reading=0

  while [ $reading -lt $readings_per_hour ]; do
    # Generate readings for all sensors
    local casing_pressure=$(generate_scada_reading "CASING_PRESSURE" 850 50 0 1500 $activity)
    local tubing_pressure=$(generate_scada_reading "TUBING_PRESSURE" 1200 100 0 2000 $activity)
    local oil_temp=$(generate_scada_reading "OIL_TEMP" 125 15 50 200 $activity)
    local flow_rate=$(generate_scada_reading "FLOW_RATE" 85 10 0 200 $activity)

    send_scada_reading "CASING_PRESSURE" $casing_pressure "PSI" 0 1500
    send_scada_reading "TUBING_PRESSURE" $tubing_pressure "PSI" 0 2000
    send_scada_reading "OIL_TEMP" $oil_temp "°F" 50 200
    send_scada_reading "FLOW_RATE" $flow_rate "BBL/DAY" 0 200

    reading=$((reading + 1))
    sleep $frequency
  done
}

main() {
  echo ""
  echo "🛢️  WellPulse Continuous Real-World Simulation"
  echo "=============================================="
  echo ""
  echo "📅 Simulation: 24-hour cycle compressed to 48 minutes"
  echo "⏱️  Time Scale: 1 hour = 2 minutes (12x speed)"
  echo "🔄 Mode: Continuous (Ctrl+C to stop)"
  echo ""

  setup_system

  echo ""
  log_success "🎯 Simulation running! Watch the real-time activity..."
  echo ""

  # Continuous simulation loop
  while true; do
    CURRENT_SIMULATED_HOUR=$(get_simulated_hour)
    local activity=$(get_activity_level $CURRENT_SIMULATED_HOUR)

    # Print statistics every 6 hours (12 minutes real-time)
    if [ $((CURRENT_SIMULATED_HOUR % 6)) -eq 0 ]; then
      print_statistics $CURRENT_SIMULATED_HOUR $activity
    fi

    run_simulation_cycle $CURRENT_SIMULATED_HOUR
  done
}

# Handle Ctrl+C gracefully
trap 'echo ""; log_info "🛑 Simulation stopped by user"; print_statistics $CURRENT_SIMULATED_HOUR $(get_activity_level $CURRENT_SIMULATED_HOUR); exit 0' INT

main
