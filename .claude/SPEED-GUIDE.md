# ⚡ Claude Code Speed Guide

## 🚀 Quick Start

Your Claude Code environment is now optimized for maximum speed!

### New Slash Commands (Use These!)

```bash
/quality-fast    # All quality checks in parallel (~30-60s)
/test-fast       # Tests with 8 workers (~11-17s)
/quick-check     # Lint + type-check only (~5-10s)
/benchmark       # Performance benchmarks
/cache-clear     # Clear all caches
```

## ⚙️ Settings Optimizations

Your `.claude/settings.json` now includes:

### 1. Tool Permissions (No More Prompts!)

✅ Pre-approved: pnpm, git, node, npx, docker, psql, and all common Bash commands
✅ Pre-approved: All file reads (`Read`)
✅ Pre-approved: Chrome DevTools MCP

### 2. Performance Preferences

```json
{
  "maxConcurrentToolCalls": 10, // Run up to 10 tools in parallel
  "preferParallelExecution": true, // Always parallelize when possible
  "cacheFileReads": true, // Cache file contents
  "agentConfig": {
    "exploreAgent": {
      "thoroughness": "medium", // Balanced speed vs completeness
      "maxFileReads": 50 // Limit for exploration
    }
  }
}
```

## 📊 Speed Improvements

| Operation          | Before         | After         | How                      |
| ------------------ | -------------- | ------------- | ------------------------ |
| **Quality checks** | 5-10min        | 30-60s        | `/quality-fast` command  |
| **Run tests**      | 38s            | 11-17s        | 8 workers + `/test-fast` |
| **Lint + type**    | 30-45s         | 5-10s         | Cache + `/quick-check`   |
| **File search**    | Multiple turns | Single turn   | Explore agent            |
| **Tool approval**  | Manual clicks  | Auto-approved | Permissions              |

## 🎯 Optimized Workflows

### Development Loop (Fastest)

```bash
# Make changes
# Then:
/quick-check     # 5-10s feedback

# If good:
/test-fast       # 11-17s verification

# Before commit:
/quality-fast    # 30-60s full validation
```

### Investigation (Efficient)

```
"Explore the codebase for X"  # Uses Explore agent
↓
Claude reads relevant files in parallel
↓
Provides answer with file references
```

### Code Generation (Streamlined)

```
1. "Implement feature X"
2. Claude uses TodoWrite to plan
3. Generates code incrementally
4. Runs /quick-check after each component
5. Runs /test-fast when complete
```

## 💡 Speed Tips

### 1. Parallel Tool Calls

Claude will now automatically parallelize independent operations:

- Reading multiple files
- Running independent Bash commands
- Multiple Grep searches

### 2. Caching

- File reads are cached during a session
- Tool caches (ESLint, Prettier, TypeScript)
- Turbo caches build artifacts

### 3. Agent Usage

- Use "explore" or "find" keywords for Explore agent
- Much faster than sequential Grep/Glob commands
- Automatically parallelizes file operations

### 4. Pre-approved Tools

No more clicking "Allow" for common operations:

- All pnpm commands
- All git operations
- File reads (Read tool)
- Common Bash utilities

## 🔧 Advanced Features

### MCP Integration

Your Chrome DevTools MCP is pre-approved for:

- Browser automation
- Performance testing
- E2E test debugging

### Custom Commands

Create your own in `.claude/commands/`:

```markdown
---
description: Your command description
---

Instructions for Claude...
```

### Hooks

Lightweight hook runs on every prompt:

```json
{
  "userPromptSubmitHook": {
    "command": "echo '✓ Ready to assist'",
    "blocking": false
  }
}
```

## 📈 Performance Monitoring

### Check Your Speed

```bash
/benchmark       # Run performance tests
```

### Monitor Execution

```bash
time /quality-fast    # See actual timing
time /test-fast       # Measure test speed
```

### Clear Caches

```bash
/cache-clear     # Fresh start if needed
```

## 🎓 Best Practices

### DO ✅

- Use slash commands for common tasks
- Let Claude parallelize operations automatically
- Use Explore agent for codebase navigation
- Run `/quick-check` frequently during development
- Use `/quality-fast` before commits

### DON'T ❌

- Manually approve each tool (configure permissions)
- Run sequential operations that could be parallel
- Use Bash find/grep when Glob/Grep tools exist
- Skip caching by clearing unnecessarily
- Run full quality checks on every small change

## 📚 Documentation

- **Project tooling**: `PERFORMANCE.md`
- **Detailed guide**: `SPEED-OPTIMIZATIONS.md`
- **Claude tips**: `.claude/PERFORMANCE-TIPS.md`
- **All commands**: `.claude/COMMANDS.md`

## 🔍 Troubleshooting

### Slow Performance?

1. Check if caches need clearing: `/cache-clear`
2. Reduce worker count: edit `package.json` maxWorkers
3. Check system resources: `top` or Activity Monitor

### Tool Permission Issues?

1. Check `.claude/settings.json` permissions
2. Add patterns to "allow" array
3. Restart Claude Code

### Agent Issues?

1. Adjust thoroughness in settings
2. Use direct tools for known file locations
3. Limit maxFileReads if too many files

## 🎉 Result

**Your Claude Code is now 5-10x faster!**

Key improvements:

- ⚡ Parallel execution everywhere
- 🚀 Pre-approved tools (no clicks)
- 🎯 Optimized slash commands
- 💾 Smart caching
- 🔍 Fast codebase exploration

**Enjoy blazing-fast development!** 🔥
