Help a new developer set up the project:

1. **Prerequisites Check:**
   - Node.js version (v18+ required)
   - pnpm installed (if not, provide install command)
   - PostgreSQL running
   - Redis running (optional but recommended)

2. **Installation:**
   - Clone the repository (show commands)
   - Install dependencies: `pnpm install`
   - Copy environment files: `.env.example` → `.env`
   - Guide through environment variable setup

3. **Database Setup:**
   - Create database: `createdb wellpulse_dev`
   - Push schema: `pnpm --filter=api db:push`
   - (Optional) Seed data if available

4. **Start Development:**
   - Start API: `pnpm --filter=api dev`
   - Start Web: `pnpm --filter=web dev`
   - Or both: `pnpm dev`
   - Access at http://localhost:3000

5. **Verify Setup:**
   - Run tests: `pnpm test`
   - Run build: `pnpm build`
   - Check lint: `pnpm lint`

6. **Next Steps:**
   - Read `CLAUDE.md` for project context
   - Review `.claude/QUICKSTART.md` for Claude Code usage
   - Check `docs/patterns/` to understand architecture
   - Try creating a feature with `/feature`

Provide step-by-step guidance with commands ready to copy-paste.
