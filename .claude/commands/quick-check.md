---
description: Quick validation (lint + type-check only, ~5-10s)
---

Run a quick code validation without running tests or builds:

1. Use the Bash tool in parallel to run:
   - `pnpm lint` (with cache)
   - `pnpm type-check` (incremental)

2. Report results concisely

This skips time-consuming tests and builds for ultra-fast feedback during development.

Expected time: 5-10 seconds
