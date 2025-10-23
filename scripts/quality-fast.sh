#!/bin/bash
# Fast Quality Checks with Maximum Parallelism

set -e

echo "🚀 Running ALL quality checks in PARALLEL..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Record start time
start_time=$(date +%s)

# Run all checks in parallel using background jobs
echo "Starting parallel tasks..."

# Format check
(
  echo "📝 Format check..."
  pnpm format:check > /tmp/format.log 2>&1 && echo "✅ Format: PASSED" || echo "❌ Format: FAILED"
) &

# Lint (all workspaces)
(
  echo "🔍 Linting..."
  pnpm lint > /tmp/lint.log 2>&1 && echo "✅ Lint: PASSED" || echo "❌ Lint: FAILED"
) &

# Type check (all workspaces)
(
  echo "🔷 Type checking..."
  pnpm type-check > /tmp/typecheck.log 2>&1 && echo "✅ Type-check: PASSED" || echo "❌ Type-check: FAILED"
) &

# Tests (all workspaces)
(
  echo "🧪 Testing..."
  pnpm test:max > /tmp/test.log 2>&1 && echo "✅ Tests: PASSED" || echo "❌ Tests: FAILED"
) &

# Build (all workspaces)
(
  echo "🏗️  Building..."
  pnpm build > /tmp/build.log 2>&1 && echo "✅ Build: PASSED" || echo "❌ Build: FAILED"
) &

# Wait for all background jobs
wait

# Calculate elapsed time
end_time=$(date +%s)
elapsed=$((end_time - start_time))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏱️  Total time: ${elapsed}s"
echo ""
echo "📊 Detailed logs:"
echo "  Format: /tmp/format.log"
echo "  Lint: /tmp/lint.log"
echo "  Type-check: /tmp/typecheck.log"
echo "  Test: /tmp/test.log"
echo "  Build: /tmp/build.log"
echo ""
echo "✨ Quality check complete!"
