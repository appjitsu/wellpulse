Write comprehensive tests for a feature:

1. **Identify Test Scope:**
   - Determine what needs testing (entity, handler, repository, controller, component)
   - Review existing tests for patterns
   - Check current coverage: `pnpm test --coverage`

2. **Backend Tests (Jest):**
   - **Unit Tests**: Test entities, value objects, handlers in isolation
   - **Integration Tests**: Test with database, repositories, external services
   - **E2E Tests**: Test full API endpoints with authentication
   - Mock external dependencies properly
   - Use test builders/factories for data
   - Follow AAA pattern (Arrange, Act, Assert)

3. **Frontend Tests (Jest + React Testing Library):**
   - **Component Tests**: Test UI components in isolation
   - **Hook Tests**: Test custom React hooks
   - **Integration Tests**: Test component interactions
   - **Repository Tests**: Test API client methods with MSW
   - Mock API responses properly
   - Test loading, error, and success states

4. **Test Coverage Goals:**
   - Aim for 80%+ coverage minimum
   - Cover happy paths and edge cases
   - Test error handling thoroughly
   - Include validation tests
   - Test permission/RBAC enforcement

5. **Run Tests:**
   - Run specific test file during development
   - Run full suite before completion: `pnpm test`
   - Fix any failing tests
   - Ensure coverage meets requirements

Report test results, coverage percentage, and any gaps that need addressing.
