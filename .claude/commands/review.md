Review code changes for quality, patterns, and best practices:

1. **Check Git Status:**
   - Review uncommitted changes: `git status`
   - View diff: `git diff`
   - Check recent commits if needed

2. **Review Criteria:**
   - **Architecture**: Follows Hexagonal (API) or Layered (Web) architecture
   - **Patterns**: Uses patterns from `docs/patterns/` correctly
   - **TypeScript**: No `any` types, proper type safety
   - **Error Handling**: Comprehensive error handling and validation
   - **Security**: RBAC enforcement, input validation, no SQL injection
   - **Performance**: No N+1 queries, proper indexing, efficient queries
   - **Testing**: Adequate test coverage (80%+), tests pass
   - **Documentation**: Code is self-documenting, complex logic explained
   - **Consistency**: Follows project conventions and style guide

3. **Provide Feedback:**
   - List strengths of the implementation
   - Identify issues by severity (critical, major, minor)
   - Suggest improvements with specific examples
   - Reference relevant patterns or documentation

4. **Quality Checks:**
   - Run `pnpm lint` and `pnpm type-check`
   - Verify tests pass: `pnpm test`
   - Ensure build succeeds: `pnpm build`

Provide constructive, educational feedback focused on teaching best practices.
