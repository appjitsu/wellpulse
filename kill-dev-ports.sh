#!/bin/bash

# Kill all processes using development ports
# Usage: ./kill-dev-ports.sh

echo "🔍 Checking for processes using development ports..."

# Ports used by WellPulse
PORTS=(3000 3001 3003 5432)
PORT_NAMES=("Web (Next.js)" "API (NestJS)" "Mailpit" "PostgreSQL")

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
echo "🎉 All development ports should now be free!"
echo ""
echo "You can now run: pnpm dev"
