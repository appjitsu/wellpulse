Quickly fix a simple issue without full quality checks:

This command is for **minor, isolated fixes only** like:

- Fixing a typo
- Updating a comment
- Adjusting spacing/formatting
- Fixing an obvious import
- Updating a simple constant

**Process:**

1. Identify the issue location
2. Make the minimal change needed
3. Run only relevant check:
   - For TypeScript: `pnpm type-check`
   - For lint: `pnpm lint`
   - If touching logic: run specific test file
4. Report the fix

**Do NOT use this command for:**

- Business logic changes (use `/feature` instead)
- Multiple file changes (use `/refactor` instead)
- Anything that needs testing (use `/test` instead)
- Architecture changes (use `/feature` or `/refactor`)

When in doubt, use the full `/quality` command to be safe.
