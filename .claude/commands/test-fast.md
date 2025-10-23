---
description: Run tests with maximum parallel workers (8 workers, fastest)
---

Run the test suite with maximum parallel execution:

1. Use the Bash tool to run: `pnpm --filter=api test`
2. Show the test results summary (suites, tests, time)
3. Report any failures with file paths and line numbers

This uses 8 parallel Jest workers (67% of CPU cores) for optimal performance.

Expected time: 11-17 seconds for API tests
