Debug an issue in the codebase:

1. **Understand the Problem:**
   - Ask user for error message, stack trace, or behavior description
   - Identify which app (API/Web) and layer (domain/application/infrastructure/presentation)

2. **Gather Context:**
   - Read relevant files to understand current implementation
   - Check recent commits for related changes
   - Review tests to understand expected behavior

3. **Investigate:**
   - Check logs if available
   - Examine error stack trace
   - Look for common issues (type errors, null checks, async/await, etc.)
   - Review related code patterns in `docs/patterns/`

4. **Propose Solution:**
   - Explain root cause clearly
   - Suggest fix with code examples
   - Consider edge cases and potential side effects

5. **Implement Fix:**
   - Apply the fix following project conventions
   - Add/update tests to prevent regression
   - Run quality checks to ensure fix doesn't break anything

6. **Verify:**
   - Run relevant tests
   - Check that the issue is resolved
   - Report on what was fixed and how
