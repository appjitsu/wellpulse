# Contributing to WellPulse

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 8.0.0+
- Docker and Docker Compose

### Getting Started

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Copy environment files: `cp .env.example .env` (and for apps/api, apps/web)
4. Start Docker services: `docker compose up -d`
5. Run migrations: `pnpm --filter=api exec prisma migrate dev`
6. Start dev servers: `pnpm dev`

## Development Workflow

### Branch Naming

- `feat/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

feat(auth): add JWT refresh token rotation
fix(time-tracking): resolve duplicate timer entries
```

### Pattern-Driven Development

**IMPORTANT:** All features must follow patterns from `docs/patterns/`.

1. Review `docs/patterns/` to identify applicable patterns
2. Read `CLAUDE.md` for implementation guidelines
3. Follow layered architecture (Presentation → Application → Domain → Infrastructure)

### Code Quality Standards

- Code passes ESLint and Prettier
- All tests pass (`pnpm test`)
- Type checking passes (`pnpm exec turbo run type-check`)
- Test coverage ≥80% for new code
- No console.log statements
- No hardcoded secrets

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes following patterns
3. Write tests with ≥80% coverage
4. Run checks: `pnpm lint && pnpm test && pnpm build`
5. Commit with conventional commits
6. Open PR against `develop`
7. Fill out PR template completely

## Architecture

### Backend (NestJS)

```
src/
├── domain/           # Business logic and entities
├── application/      # Use cases and DTOs
├── infrastructure/   # External services, repositories
└── presentation/     # Controllers, guards, decorators
```

### Frontend (Next.js)

```
app/                  # Next.js app router
components/           # React components
lib/                  # Business logic
hooks/                # Custom React hooks
stores/               # Zustand stores
```

## Security

- Never commit secrets or API keys
- Use environment variables
- Follow OWASP Top 10 guidelines
- Validate all user inputs
- Implement proper RBAC with CASL

## Questions?

Open a [Discussion](https://github.com/your-org/wellpulse/discussions) or review existing [Issues](https://github.com/your-org/wellpulse/issues).
