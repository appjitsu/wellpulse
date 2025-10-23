---
description: Clear all tool caches (ESLint, Prettier, TypeScript, Turbo, Jest)
---

Clear all caches for a fresh start:

1. Run: `rm -rf .cache .turbo apps/*/.cache apps/*/.tsbuildinfo /tmp/jest-cache`
2. Run: `pnpm clean`
3. Confirm caches have been cleared
4. Suggest running `pnpm install` to rebuild

Use this when experiencing cache-related issues or stale builds.
