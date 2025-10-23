Explain how a specific part of the codebase works:

1. **Identify What to Explain:**
   - Ask user what they want to understand:
     - Specific feature (e.g., "time entry approval workflow")
     - Architecture pattern (e.g., "CQRS implementation")
     - File or function (e.g., "apps/api/src/domain/invoice/invoice.entity.ts")
     - Technology integration (e.g., "how React Query works with repositories")

2. **Gather Context:**
   - Read relevant files
   - Check related patterns in `docs/patterns/`
   - Review tests to understand behavior
   - Look at data flow between layers

3. **Provide Explanation:**
   - **Overview**: What it does at a high level
   - **Architecture**: Which layers/patterns are involved
   - **Data Flow**: How data moves through the system
   - **Key Components**: Main files and their responsibilities
   - **Example**: Concrete example with code snippets
   - **Patterns**: Which design patterns are used and why

4. **Visual Aids (ASCII Art):**
   - Sequence diagrams for workflows
   - Component diagrams for architecture
   - Data flow diagrams
   - Layer interactions

5. **Code Walkthrough:**
   - Show key code sections with line numbers
   - Explain each section's purpose
   - Point out important patterns or techniques
   - Highlight anything unusual or noteworthy

6. **Related Concepts:**
   - Link to similar implementations
   - Reference pattern documentation
   - Suggest areas to explore next

Focus on being educational and clear. Use examples and diagrams liberally.
