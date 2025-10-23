# Claude Code Commands Reference

Quick reference for all available slash commands.

## 🚀 Development Workflow

| Command    | Purpose                 | When to Use                                            |
| ---------- | ----------------------- | ------------------------------------------------------ |
| `/quality` | Run all quality checks  | Before committing, creating PR, or completing features |
| `/feature` | Implement new feature   | Starting any new functionality                         |
| `/pr`      | Create pull request     | Ready to merge changes                                 |
| `/setup`   | Project setup guide     | Onboarding new developers                              |
| `/status`  | Project status overview | Daily standup, quick check-in                          |

## 🔍 Code Quality & Review

| Command      | Purpose                   | When to Use                               |
| ------------ | ------------------------- | ----------------------------------------- |
| `/review`    | Review code changes       | Before committing or requesting review    |
| `/test`      | Write comprehensive tests | After implementing logic                  |
| `/refactor`  | Improve code quality      | Reducing complexity, removing duplication |
| `/quick-fix` | Fast simple fixes         | Typos, formatting, minor changes          |

## 🐛 Debugging & Analysis

| Command    | Purpose               | When to Use                                  |
| ---------- | --------------------- | -------------------------------------------- |
| `/debug`   | Structured debugging  | Investigating bugs or unexpected behavior    |
| `/analyze` | Codebase analysis     | Understanding features, finding improvements |
| `/explain` | Explain code/patterns | Learning how something works                 |

## 📚 Documentation & Data

| Command    | Purpose                 | When to Use                           |
| ---------- | ----------------------- | ------------------------------------- |
| `/docs`    | Update documentation    | Adding features, patterns, or guides  |
| `/migrate` | Database migrations     | Schema changes, adding tables/columns |
| `/clean`   | Clean project artifacts | Resolving build issues, fresh start   |

## 💡 Usage Tips

### Chain Commands

```
/feature → /test → /quality → /pr
```

### Ask for Help

```
/explain the invoice generation workflow
/analyze security vulnerabilities
/debug the authentication error
```

### Quick Checks

```
/status          # Quick overview
/quality         # Full check before commit
/review          # Pre-commit code review
```

## 📖 Command Details

For detailed information about each command, see the individual files in `.claude/commands/`.

For getting started, read `.claude/QUICKSTART.md`.

---

**Pro Tip**: Type `/` and press Tab to see all commands with autocomplete!
