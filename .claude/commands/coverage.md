Report current test coverage for the entire project:

1. **Backend Coverage (API):**
   - Run: `pnpm --filter=api test:cov`
   - Extract coverage summary (Statements, Branches, Functions, Lines)
   - Identify files below 80% coverage
   - Note any untested critical paths

2. **Frontend Coverage (Web):**
   - Run: `pnpm --filter=web test:coverage`
   - Extract coverage summary (Statements, Branches, Functions, Lines)
   - Identify components/hooks below 80% coverage
   - Note any untested user flows

3. **Coverage Analysis:**
   - Compare against 80% minimum requirement
   - Highlight areas needing attention
   - Suggest specific files/modules to prioritize for testing
   - Report on overall project health

4. **Summary Report:**
   - **API Coverage**: X% statements, Y% branches, Z% functions, W% lines
   - **Web Coverage**: X% statements, Y% branches, Z% functions, W% lines
   - **Status**: ✅ Meets 80% requirement / ⚠️ Needs improvement
   - **Action Items**: List specific files/components needing tests

**Note:** If tests fail, report the failures and suggest fixes before calculating coverage.
