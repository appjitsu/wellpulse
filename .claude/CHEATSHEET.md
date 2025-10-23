# Claude Code Cheat Sheet

Quick reference for the most common tasks.

## 🚀 Essential Commands

```bash
/quality              # Run all quality checks (most used!)
/feature             # Implement new feature
/test                # Write tests
/pr                  # Create pull request
/review              # Code review
```

## ⚡ Quick Tasks

### Start New Feature

```
/feature → describe feature → implement → /test → /quality → /pr
```

### Fix Bug

```
/debug → describe issue → fix → /quality
```

### Before Commit

```
/quality
```

### Create PR

```
/pr
```

## 🏗️ Architecture Quick Ref

### Backend Layers (Inside → Out)

```
Domain → Application → Infrastructure → Presentation
```

### Frontend Layers (Top → Bottom)

```
UI → State → Logic → Data Access
```

## 📝 Quality Checklist

```bash
✓ pnpm format       # Via /quality
✓ pnpm lint         # Via /quality
✓ pnpm type-check   # Via /quality
✓ pnpm build        # Via /quality
✓ pnpm test         # Via /quality (80%+ coverage)
```

## 🎯 Pattern Quick Select

| Need               | Use                   |
| ------------------ | --------------------- |
| Basic CRUD         | Repository + CQRS     |
| Complex business   | DDD + Value Objects   |
| External API       | Anti-Corruption Layer |
| Dynamic behavior   | Strategy Pattern      |
| Multi-entity save  | Unit of Work          |
| Complex validation | Specification Pattern |

## 🚫 Don'ts

- ❌ Use `any` types
- ❌ Hard delete (use soft delete)
- ❌ Business logic in controllers
- ❌ Skip tests
- ❌ Mix architecture layers

## ✅ Do's

- ✅ Use slash commands
- ✅ Run /quality before commit
- ✅ Follow architecture patterns
- ✅ Write 80%+ test coverage
- ✅ Use proper TypeScript types

## 📚 Quick Links

- Full guide: `.claude/README.md`
- Quick start: `.claude/QUICKSTART.md`
- Main docs: `CLAUDE.md`
- Patterns: `docs/patterns/`

## 🔥 Pro Tips

1. Type `/` then Tab to see all commands
2. Chain commands for workflows
3. Ask questions: "How does X work?"
4. Use `/analyze` to understand code
5. Use `/review` before PRs

---

**Stuck?** Type `/help` or read `.claude/README.md`
