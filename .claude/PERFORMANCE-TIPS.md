# ⚡ Claude Code Performance Tips

This document contains tips for maximizing Claude Code's speed and efficiency.

## 🚀 General Performance Tips

### 1. Use Parallel Tool Calls

When tasks are independent, call multiple tools in a single message for parallel execution.

### 2. Use Agents for Complex Searches

Instead of running multiple Grep/Glob commands sequentially, use the Task tool with Explore agent.

### 3. Leverage Slash Commands

Use custom commands for common workflows to save typing and ensure consistency.

### 4. Enable Tool Permissions

Pre-approve common tool patterns in settings.json to avoid confirmation prompts.

### 5. Use Caching

- Read files once and reference them in context
- Avoid re-reading unchanged files
- Use TodoWrite to track what's been done

## 🎯 Optimized Slash Commands

We've created optimized commands for this project:

- `/quality-fast` - Run all quality checks in parallel (~30-60s)
- `/test-fast` - Run tests with 8 workers (~11-17s)
- `/quick-check` - Lint + type-check only (~5-10s)

## ⚙️ Settings Optimization

Your `.claude/settings.json` is optimized with:

- **Output Style**: Explanatory (provides context and insights)
- **Permissions**: Pre-approved common tools (Bash, Read, MCP)
- **Hooks**: Lightweight user prompt hook

### Additional Optimizations

Add to `settings.json`:

```json
{
  "maxConcurrentAgents": 3,
  "preferAgentsFor": ["codebase-exploration", "multi-file-search"],
  "cacheFileReads": true
}
```

## 🔧 Workflow Optimizations

### Development Workflow

1. Make changes
2. Run `/quick-check` for fast feedback (5-10s)
3. Fix any issues
4. Run `/test-fast` before commit (11-17s)
5. Run `/quality-fast` before PR (30-60s)

### Investigation Workflow

1. Use Task tool with Explore agent for codebase navigation
2. Read specific files only after narrowing down
3. Use parallel Read calls for multiple related files

### Code Generation Workflow

1. Use TodoWrite to plan the implementation
2. Generate code incrementally
3. Run `/quick-check` after each component
4. Run `/test-fast` after completion

## 📊 Performance Comparison

| Workflow       | Before   | After  | Improvement  |
| -------------- | -------- | ------ | ------------ |
| Quality checks | 5-10 min | 30-60s | 5-10x faster |
| Tests only     | 38s      | 11-17s | 2-3x faster  |
| Lint + type    | 30-45s   | 5-10s  | 3-5x faster  |

## 💡 Advanced Tips

### 1. Batch Similar Operations

Instead of multiple sequential edits, plan all edits and execute together.

### 2. Use Glob for File Discovery

Glob is faster than Bash find commands for file pattern matching.

### 3. Use Grep for Content Search

Grep is optimized for code search - faster than Bash grep.

### 4. Minimize Context Switching

Keep related operations in the same message/turn.

### 5. Pre-filter with Glob, Then Read

Use Glob to find files, then Read only relevant ones.

## 🎓 Best Practices

1. **Plan before acting**: Use TodoWrite to organize complex tasks
2. **Parallel execution**: Use multiple tool calls when possible
3. **Incremental validation**: Run quick checks frequently
4. **Leverage caching**: Tools and project both use caching
5. **Use the right tool**: Agents for exploration, direct tools for known operations

## 📚 Related Documentation

- `PERFORMANCE.md` - Project tooling performance optimizations
- `SPEED-OPTIMIZATIONS.md` - Complete speed optimization guide
- `.claude/commands/` - Custom slash commands
