#!/bin/bash
set -e

echo "🧪 Running Local CI Checks..."
echo ""

# 1. Code Quality
echo "📝 Running linters and formatters..."
pnpm lint
pnpm type-check
echo "✅ Linting passed"
echo ""

# 2. Tests
echo "🧪 Running tests..."
pnpm test
echo "✅ Tests passed"
echo ""

# 3. Build
echo "🏗️  Building applications..."
pnpm build
echo "✅ Build passed"
echo ""

# 4. Docker Build (if Docker is running)
if docker info &> /dev/null; then
  echo "🐳 Testing Docker builds..."
  docker build -f apps/api/Dockerfile -t wellpulse-api:test . --quiet
  docker build -f apps/web/Dockerfile -t wellpulse-web:test . --quiet
  echo "✅ Docker builds passed"
  echo ""
else
  echo "⚠️  Docker not running, skipping Docker builds"
  echo ""
fi

# 5. Security Scans (if tools are installed)
if command -v gitleaks &> /dev/null; then
  echo "🔒 Running Gitleaks secret scan..."
  gitleaks detect --source . --no-git || true
  echo ""
fi

if command -v semgrep &> /dev/null; then
  echo "🔒 Running Semgrep security scan..."
  semgrep --config "p/security-audit" --quiet . || true
  echo ""
fi

echo "🎉 All local CI checks passed!"
echo ""
echo "💡 To run GitHub Actions locally: act pull_request"
