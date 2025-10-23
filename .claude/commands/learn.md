# Cross-Sprint Learning Agent

Learn from past sprints to improve estimates and avoid repeated mistakes.

Analyzes sprint history to identify patterns, gotchas, and time-saving opportunities.

## What This Command Does

1. **Extract Sprint Patterns**
   - Common implementation approaches
   - Time estimates by feature type
   - Technologies and patterns used successfully

2. **Identify Gotchas**
   - Repeated mistakes across sprints
   - Unexpected delays and causes
   - Technical debt created

3. **Calculate Velocity**
   - Actual vs estimated hours
   - Productivity trends
   - Team performance metrics

4. **Generate Recommendations**
   - What to do differently
   - What to keep doing
   - Time estimates for similar work

## Usage

```bash
/learn sprint-5 sprint-6 sprint-7
/learn --all  # Analyze all completed sprints
/learn --compare sprint-5 sprint-9A  # Compare two sprints
/learn --velocity  # Calculate team velocity
```

## Example Output

````text
📚 Cross-Sprint Learning Analysis

Sprints Analyzed: Sprint 5, 6, 7, 8A, 8B, 8C
Total Features: 42
Total Hours: 856 hours (estimated), 1,024 hours (actual)
Accuracy: 83.6% (pretty good!)

════════════════════════════════════════════════════════════════

PATTERNS IDENTIFIED

1. New Entity Implementation Pattern (6 occurrences)

   Sprints: 5 (Invoice), 6 (Expense), 7 (Budget Alert), 8B (CRM Contacts), 9A (Estimate)

   Consistent Approach:
     Phase 1: Domain Layer (12-16h avg) ✅
       - Copy similar entity as template (invoice.entity.ts as baseline)
       - Adapt business rules and value objects
       - Write unit tests as you go (NOT at end)

     Phase 2: Infrastructure (16-20h avg) ✅
       - Schema creation (Drizzle)
       - Repository interface + implementation
       - Run db:push, seed data

     Phase 3: Application (24-32h avg) ✅
       - CQRS handlers (commands + queries)
       - Integration tests with test database
       - Event handlers if needed

     Phase 4: Presentation (12-16h avg) ✅
       - Controller + DTOs
       - RBAC permissions
       - E2E tests

     Phase 5: Frontend (24-32h avg) ✅
       - React Query hooks
       - Components (form, list, detail)
       - Page routes

   Total: 88-116 hours per new entity
   Actual average: 98 hours

   💡 Key Insight: Using invoice.entity.ts as template saves 30-40 hours
   consistently across sprints!

────────────────────────────────────────────────────────────────

2. PDF Generation Pattern (2 occurrences)

   Sprints: 5 (Invoice PDF), 9A (Estimate PDF)

   Learnings:
     - First implementation (Invoice PDF): 24 hours
     - Second implementation (Estimate PDF): 6 hours (75% faster!)
     - Reason: 90% code reuse from invoice-pdf.service.ts

   Approach:
     1. Copy invoice-pdf.service.ts
     2. Rename Invoice → Estimate
     3. Adjust metadata and watermarks
     4. Test with real data

   Gotcha (Sprint 5):
     - Initially forgot to stream PDF (loaded full PDF in memory)
     - For 100-page PDF = 50MB memory spike
     - Fixed by using PDFDocument streams
     - Lesson: Always stream large files!

────────────────────────────────────────────────────────────────

3. RBAC Permission Pattern (8 occurrences)

   Common Mistake (happened 3 times!):
     ❌ Forgot to add @RequirePermissions guard
     ❌ Forgot to add permission to enum
     ❌ Forgot to update canned roles seed data

     Result: Had to fix in separate commit, lost 2-4 hours each time

   ✅ Checklist Created (Sprint 6):
     - [ ] Add permission to permissions.enum.ts
     - [ ] Add to canned roles in canned-roles.constants.ts
     - [ ] Create SQL migration: add-{feature}-permissions.sql
     - [ ] Apply @RequirePermissions to all endpoints
     - [ ] Test with different roles (admin, manager, consultant)

   Time saved: Following checklist saves 2-4 hours per feature

   💡 Now automated in /feature command!

════════════════════════════════════════════════════════════════

GOTCHAS & LESSONS LEARNED

1. Database Migrations (Sprint 5, 6, 8B)

   Gotcha: Missing audit fields in new tables
     - Sprint 5: Invoice table missing deletedBy (had to add in migration)
     - Sprint 6: Expense table missing deletedAt (same issue)
     - Sprint 8B: Learned! All new tables include full audit fields from start

   Solution: Standard audit fields template:
     ```typescript
     createdAt: timestamp('created_at').notNull().defaultNow(),
     updatedAt: timestamp('updated_at').notNull().defaultNow(),
     createdBy: text('created_by').notNull().references(() => usersTable.id),
     updatedBy: text('updated_by').notNull().references(() => usersTable.id),
     deletedAt: timestamp('deleted_at'),
     deletedBy: text('deleted_by').references(() => usersTable.id),
     ```

   Time saved: 1-2 hours per table (no migrations to fix later)

────────────────────────────────────────────────────────────────

2. Testing Strategy (Sprint 6, 7)

   Gotcha: Writing all tests at end of sprint
     - Sprint 6: Wrote tests after implementation (last 2 days)
     - Result: Found 12 bugs, had to fix + re-test
     - Total time: 24 hours for tests + fixes

   Improvement (Sprint 7 onwards):
     - Write unit tests immediately after each method
     - Write integration tests after each handler
     - E2E tests after controller done
     - Result: Only 2 bugs found, 16 hours total (33% faster!)

   💡 Lesson: Test-as-you-go saves time and prevents bugs

────────────────────────────────────────────────────────────────

3. Frontend Type Mismatches (Sprint 5, 6, 7)

   Gotcha: Date serialization (happened 3 times!)
     - Backend sends Date objects
     - JSON serializes to string
     - Frontend expects Date but gets string
     - Result: Runtime errors in date formatting

   Solution (Sprint 8A):
     - Created ApiProject type pattern
     - Repository maps strings → Date objects
     - Documented in project.repository.ts
     - All new features follow this pattern

   Time saved: 3-4 hours per feature (no debugging date issues)

════════════════════════════════════════════════════════════════

VELOCITY TRENDS

Sprint 5 (Invoicing):
  Estimated: 120 hours
  Actual: 148 hours
  Accuracy: 81%
  Overrun: +28 hours (mostly PDF generation learning curve)

Sprint 6 (Expenses):
  Estimated: 100 hours
  Actual: 112 hours
  Accuracy: 89%
  Overrun: +12 hours (much better!)

Sprint 7 (Budget Alerts):
  Estimated: 80 hours
  Actual: 76 hours
  Accuracy: 105% (under-budget!)
  Reason: Reused patterns from Sprint 5 & 6

Sprint 8A (Time Entry Polish):
  Estimated: 40 hours
  Actual: 38 hours
  Accuracy: 105%

Sprint 8B (CRM):
  Estimated: 140 hours
  Actual: 152 hours
  Accuracy: 92%
  Overrun: +12 hours (new domain, expected)

Sprint 8C (Subscriptions):
  Estimated: 60 hours
  Actual: 58 hours
  Accuracy: 103%

Trend: Accuracy improving! 81% → 103%
Average velocity: 102 hours/sprint (actual)

════════════════════════════════════════════════════════════════

RECOMMENDATIONS FOR SPRINT 9A (Estimates & Proposals)

Based on learnings from Sprints 5-8C:

1. Time Estimate Adjustments

   Original estimate: 108-148 hours

   Adjustments based on history:
     + 10% for unknown complexity (new client portal auth)
     - 30 hours code reuse (invoice entity + PDF service)
     + 8 hours for RBAC setup (learned to budget this separately)

   Revised estimate: 106-146 hours (very close to original!)

   Confidence: HIGH (95% based on similar work in Sprint 5)

────────────────────────────────────────────────────────────────

2. Risk Mitigation

   High Risk Areas (based on past sprints):
     ⚠️ Client portal authentication (NEW domain)
       Mitigation: Allocate 12h, not 8h (buffer for unknowns)
       Reference: Sprint 8A auth refactor took 10h (similar complexity)

     ⚠️ Template system (NEW feature)
       Mitigation: Keep MVP (3 hardcoded templates)
       Reference: Avoid feature creep (Sprint 6 budget alerts went over due to scope)

     ⚠️ Estimate → Project conversion (Complex factory)
       Mitigation: Write tests FIRST (TDD approach)
       Reference: Sprint 8B contact conversion worked well with TDD

────────────────────────────────────────────────────────────────

3. Efficiency Boosters

   Copy These Patterns (Proven to save time):
     ✓ Copy invoice.entity.ts → estimate.entity.ts (30 hours saved)
     ✓ Copy invoice-pdf.service.ts → estimate-pdf.service.ts (18 hours saved)
     ✓ Use RBAC checklist from Sprint 6 (4 hours saved)
     ✓ Use audit fields template (2 hours saved)
     ✓ Use ApiEstimate type pattern (3 hours saved)

   Total time saved: 57 hours! 🚀

────────────────────────────────────────────────────────────────

4. Sprint Execution Order (Optimized)

   Based on Sprint 7's success (came in under budget):

   Day 1-3: Domain Layer
     - Copy invoice.entity.ts
     - Write unit tests AS YOU GO
     - Focus on business rules first

   Day 4-5: Infrastructure Layer
     - Schema + migrations
     - Repository (copy invoice repository)
     - Test with seed data

   Day 6-9: Application Layer
     - CQRS handlers
     - Client portal auth (allocate full 12h)
     - Integration tests

   Day 10-11: Presentation Layer
     - Controllers + DTOs
     - RBAC permissions (use checklist!)
     - E2E tests

   Day 12-16: Frontend
     - React hooks + components
     - Pages
     - Manual testing

   Day 17-18: Quality & Polish
     - Full test suite
     - Coverage report
     - Bug fixes
     - Documentation

   Day 19: Buffer (unknowns, scope creep)

════════════════════════════════════════════════════════════════

SUMMARY

Key Learnings:
  1. Code reuse is POWERFUL (30-40 hours savings per sprint)
  2. Test-as-you-go prevents bugs and saves time (8+ hours)
  3. Checklists prevent repeated mistakes (RBAC, audit fields)
  4. Velocity improving (81% → 103% accuracy)
  5. Buffer 10-15% for unknowns (always materializes!)

Apply to Sprint 9A:
  - Follow proven patterns (don't reinvent)
  - Use templates and copy-paste (invoice entity, PDF service)
  - Test continuously (not at end)
  - Use checklists (RBAC, audit fields, API types)
  - Budget for unknowns (client portal auth)

Confidence Level: 95% (very high)
Reason: Sprint 9A is 85% similar to Sprint 5 (invoicing)

Estimated Duration: 14-19 working days
Actual Prediction: 16-17 days (based on velocity trend)
````

## Sprint Comparison

```bash
/learn --compare sprint-5 sprint-9A

Output:

Sprint 5 (Invoicing) vs Sprint 9A (Estimates & Proposals)

Similarities (85%):
  ✓ New aggregate with line items
  ✓ PDF generation requirement
  ✓ Client-facing feature
  ✓ Status state machine
  ✓ Multi-step workflow
  ✓ RBAC permissions needed

Differences (15%):
  ✗ Client approval workflow (9A new)
  ✗ Client portal authentication (9A new)
  ✗ Estimate → Project conversion (9A new)
  ✗ Template system (9A new)

Time Estimate Correlation:
  Sprint 5 actual: 148 hours
  Sprint 9A estimate: 108-148 hours

  Difference: Client auth (+12h), Templates (+8h), Conversion (+6h)
  Similarity savings: -30h (invoice entity reuse)

  Net: Similar total effort (140-150 hours expected)
```

## After Learning Analysis

1. **Apply learnings** to current sprint planning
2. **Update estimate** based on velocity trends
3. **Create checklists** for common gotchas
4. **Identify risks** early
5. **Document patterns** that worked well
6. **Share learnings** with team
7. **Continuous improvement** - review after each sprint
