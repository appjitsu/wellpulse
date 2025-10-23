# Claude Code Quick Start Guide

Get productive with Claude Code in 5 minutes!

## 🎯 Most Used Commands

```bash
# Development Workflow
/quality              # Run all checks (format, lint, type-check, build, test)
/feature             # Implement a new feature with architecture guidance
/pr                  # Create pull request with auto-generated description

# Code Quality
/review              # Review changes for quality and patterns
/test                # Write comprehensive tests (80%+ coverage)
/refactor            # Improve code without changing behavior

# Debugging & Analysis
/debug               # Structured debugging workflow
/analyze             # Analyze codebase for understanding
/quick-fix           # Fast fixes for typos and simple issues

# Documentation & Database
/docs                # Update or create documentation
/migrate             # Plan and create database migrations
```

## ⚡ Quick Workflows

### 1. New Feature (5 steps)

```
You: /feature Add user profile editing
Claude: [Implements following architecture...]
You: /test
Claude: [Writes tests with 80%+ coverage]
You: /quality
Claude: [Runs all checks]
You: /pr
Claude: [Creates PR with description]
```

### 2. Bug Fix (3 steps)

```
You: /debug
Claude: What issue are you experiencing?
You: [Describe the bug]
Claude: [Investigates, fixes, runs tests]
```

### 3. Code Review (2 steps)

```
You: /review
Claude: [Reviews uncommitted changes, provides feedback]
```

## 🏗️ Architecture Quick Reference

### Backend (Hexagonal)

```
Controller → Command/Query → Entity/ValueObject ← Repository
```

**New Feature Order:**

1. Domain (entities, events)
2. Repository interface
3. Command/query handlers
4. Repository implementation
5. Controller + DTOs
6. Tests (80%+)

### Frontend (Layered)

```
Page → Hook → Repository → API
```

**New Feature Order:**

1. Types
2. Repository methods
3. React Query hooks
4. Components
5. Pages
6. Tests

## ✅ Pre-Commit Checklist

```bash
/quality  # This runs everything below automatically!

# Or run individually:
pnpm format       # ✓ Format code
pnpm lint         # ✓ Fix lint errors
pnpm type-check   # ✓ Check types
pnpm build        # ✓ Build succeeds
pnpm test         # ✓ Tests pass (80%+)
```

## 🎨 Patterns to Remember

Located in `docs/patterns/`:

- **Repository** - Data access abstraction
- **CQRS** - Separate reads and writes
- **DDD** - Entities, Value Objects, Aggregates
- **Strategy** - Algorithm selection at runtime
- **Factory** - Object creation
- **Observer** - Event-driven architecture

Start with: `docs/patterns/16-Pattern-Integration-Guide.md`

## 🚫 Common Mistakes

❌ **DON'T:**

- Use `any` types (use proper TypeScript types)
- Hard delete data (use soft delete with `deletedAt`)
- Skip tests (maintain 80%+ coverage)
- Put business logic in controllers (belongs in domain/application)
- Commit without running quality checks
- Mix layers (respect architecture boundaries)

✅ **DO:**

- Follow architecture patterns
- Use value objects for validation
- Implement RBAC permissions
- Add audit logging (createdBy, updatedBy)
- Write self-documenting code
- Use slash commands for consistency

## 📚 Essential Files

```
CLAUDE.md                                    # Project essentials
.claude/README.md                            # This configuration
docs/patterns/16-Pattern-Integration-Guide.md  # Pattern selection guide
docs/guides/style-guide.md                   # Code style
docs/guides/testing-guide.md                 # Testing practices
```

## 💡 Pro Tips

1. **Chain Commands**: `/feature` → `/test` → `/quality` → `/pr`
2. **Ask Questions**: "How does the RBAC system work?"
3. **Learn Patterns**: `/analyze the invoice feature`
4. **Get Context**: "Show me examples of Repository pattern"
5. **Iterate Fast**: Use `/quick-fix` for typos, `/feature` for logic

## 🔧 Customization

Create `.claude/settings.local.json` for personal preferences:

```json
{
  "outputStyle": "Concise"
}
```

## 🆘 Need Help?

- **Project Context**: Read `CLAUDE.md`
- **Architecture**: Check `docs/patterns/`
- **Commands**: Type `/` and tab to see all commands
- **Issues**: Use `/debug` for problem-solving

---

**Remember**: Claude Code is your pair programming partner. Ask questions, request explanations, and iterate together!

**Get Started Now**: Type `/feature` and describe what you want to build!
