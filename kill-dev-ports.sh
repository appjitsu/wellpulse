#!/bin/bash

# Kill WellPulse application processes (API, Web, Admin, ML)
# Infrastructure services (PostgreSQL, Redis, Mailpit, Azurite) remain running in Docker
#
# Usage: ./kill-dev-ports.sh
#
# To stop infrastructure services: docker compose down

echo "🔍 Checking for processes using development ports..."

# Only kill application ports (4000-4003)
# Infrastructure services (PostgreSQL, Redis, Mailpit, Azurite) run in Docker and should stay running
PORTS=(4000 4001 4002 4003)
PORT_NAMES=("API (NestJS)" "Web (Next.js)" "Admin (Next.js)" "ML Service (Python)")

for i in "${!PORTS[@]}"; do
  PORT="${PORTS[$i]}"
  NAME="${PORT_NAMES[$i]}"

  # Find PIDs using this port
  PIDS=$(lsof -ti:$PORT 2>/dev/null)

  if [ -z "$PIDS" ]; then
    echo "✅ Port $PORT ($NAME) is free"
  else
    echo "❌ Port $PORT ($NAME) in use by PIDs: $PIDS"

    # Show what processes are running
    echo "   Processes:"
    for PID in $PIDS; do
      PROCESS=$(ps -p $PID -o command= 2>/dev/null)
      echo "   - PID $PID: $PROCESS"
    done

    # Kill the processes
    echo "   💀 Killing processes..."
    kill -9 $PIDS 2>/dev/null

    # Verify they're dead
    sleep 0.5
    REMAINING=$(lsof -ti:$PORT 2>/dev/null)
    if [ -z "$REMAINING" ]; then
      echo "   ✅ Port $PORT freed successfully"
    else
      echo "   ⚠️  Some processes still alive, trying harder..."
      kill -9 $REMAINING 2>/dev/null
    fi
  fi
  echo ""
done

# Also kill any orphaned node/next processes related to this project
echo "🔍 Checking for orphaned WellPulse processes..."

# Find node processes in the wellpulse directory
CATALYST_PIDS=$(ps aux | grep -i wellpulse | grep -E "(node|next|nest)" | grep -v grep | awk '{print $2}')

if [ -z "$CATALYST_PIDS" ]; then
  echo "✅ No orphaned WellPulse processes found"
else
  echo "❌ Found orphaned processes: $CATALYST_PIDS"
  echo "💀 Killing..."
  kill -9 $CATALYST_PIDS 2>/dev/null
  echo "✅ Orphaned processes killed"
fi

echo ""
echo "🎉 All application ports should now be free!"
echo ""
echo "Infrastructure services (PostgreSQL, Redis, Mailpit, Azurite) remain running in Docker."
echo "To stop infrastructure: docker compose down"
echo ""
echo "You can now run: pnpm dev"
