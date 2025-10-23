Implement a new feature following the project's architecture:

When implementing features in this WellPulse PSA monorepo:

**Backend (Hexagonal Architecture):**

1. Domain Layer: Create entities, value objects, events
2. Repository Interface: Define in domain/repositories
3. Application Layer: Implement CQRS commands/queries/handlers
4. Infrastructure: Create Drizzle schema and repository implementation
5. Presentation: Add controller with DTOs and validation
6. Tests: Write unit tests with 80%+ coverage

**Frontend (Layered Architecture):**

1. Types: Define TypeScript interfaces
2. Repository: Create API client methods
3. Hooks: Implement React Query hooks
4. Components: Build UI components
5. Pages: Create Next.js App Router pages
6. Tests: Write component and integration tests

**Always:**

- Follow patterns from `docs/patterns/`
- Run quality checks after implementation
- Use proper error handling and validation
- Implement RBAC/permissions where needed
- Add audit logging for mutations
- Use soft delete (deletedAt) not hard delete

Ask for clarification on the feature requirements before starting implementation.
