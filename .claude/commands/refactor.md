Refactor code to improve quality without changing behavior:

1. **Identify Refactoring Target:**
   - What code needs refactoring?
   - Why? (complexity, duplication, poor naming, architecture mismatch, etc.)
   - Verify there are tests for the code (if not, write them first!)

2. **Plan Refactoring:**
   - Review current implementation
   - Identify design patterns that could help (`docs/patterns/`)
   - Consider impact on other code
   - Ensure refactoring aligns with project architecture

3. **Common Refactoring Patterns:**
   - **Extract Method**: Break large functions into smaller ones
   - **Extract Class/Interface**: Separate concerns properly
   - **Move to Pattern**: Apply Repository, Strategy, Factory, etc.
   - **Rename**: Improve naming for clarity
   - **Remove Duplication**: DRY principle
   - **Simplify Conditionals**: Reduce complexity
   - **Type Safety**: Replace `any` with proper types

4. **Execute Refactoring:**
   - Make incremental changes
   - Run tests after each change to ensure behavior unchanged
   - Update tests if needed (but behavior should stay same)
   - Update documentation if architecture changes

5. **Verify:**
   - All tests still pass: `pnpm test`
   - Type check passes: `pnpm type-check`
   - Lint passes: `pnpm lint`
   - Build succeeds: `pnpm build`
   - Coverage maintained or improved

6. **Document:**
   - If new pattern introduced, add to `docs/patterns/`
   - Update CLAUDE.md if architecture changed
   - Add comments for complex refactored code

Report on what was refactored, why, and how it improves the codebase.
