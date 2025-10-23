#!/bin/bash
# Parallel test execution script

echo "🚀 Running all test suites in parallel..."
echo ""

# Run tests across all workspaces in parallel
pnpm --parallel --filter=api --filter=web test

echo ""
echo "✅ All test suites completed"
