---
description: Run all quality checks in maximum parallel mode (fastest)
---

Run all quality checks in MAXIMUM PARALLEL mode:

1. Use the Bash tool to run: `pnpm quality:fast`
2. Report the results to the user with timing information
3. If any check fails, show the relevant log files from /tmp/

This uses:

- Parallel execution for all tasks (lint, type-check, test, build, format)
- 8 Jest workers for testing
- ESLint cache for linting
- Prettier cache for formatting
- TypeScript incremental compilation
- Turbo parallel workspace execution

Expected time: 30-60 seconds
