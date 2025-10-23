Clean up the project to resolve common issues:

1. **Identify Cleanup Target:**
   - What needs cleaning? (dependencies, build artifacts, cache, database)
   - Full clean or targeted clean?

2. **Safe Cleanup (Recommended First):**

   ```bash
   # Clear build artifacts
   pnpm clean
   # Or manually:
   rm -rf apps/*/dist apps/*/.next apps/*/out

   # Clear test artifacts
   rm -rf coverage test-results playwright-report

   # Clear turbo cache
   rm -rf .turbo
   ```

3. **Dependency Cleanup:**

   ```bash
   # Remove node_modules
   rm -rf node_modules apps/*/node_modules

   # Clear pnpm cache (nuclear option)
   pnpm store prune

   # Reinstall
   pnpm install
   ```

4. **Database Reset (CAUTION):**

   ```bash
   # Drop and recreate database
   dropdb wellpulse_dev && createdb wellpulse_dev

   # Push fresh schema
   pnpm --filter=api db:push

   # Reseed if needed
   ```

5. **After Cleanup:**
   - Rebuild: `pnpm build`
   - Run tests: `pnpm test`
   - Verify everything works: `pnpm dev`

**IMPORTANT:**

- Always commit/stash changes before cleaning
- Database reset will DELETE ALL DATA
- Ask user for confirmation before destructive operations

Provide clear warnings and confirmation prompts for destructive actions.
