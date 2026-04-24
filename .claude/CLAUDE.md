## Knowledge Graph (RAG)

Before searching the codebase from scratch, check `graphify-out/graph.json` for pre-extracted architecture knowledge. Use `/graphify query "<question>"` to traverse the graph for answers about system architecture, component relationships, data flow, and design rationale. This is 45x cheaper in tokens than reading raw docs.

When to use:

- Understanding how components connect (e.g. "how does auth flow through services")
- Finding which design docs are relevant to a change
- Tracing cross-cutting concerns (security, error handling, data model)
- Answering "why was this designed this way" (rationale edges)

The graph covers `design/` docs (49 files, 135 nodes, 194 edges, 11 communities). Run `/graphify design --update` after design doc changes to keep it current.

## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for any non-trivial task (three or more steps, or involving architectural decisions).
- If something goes wrong, stop and re-plan immediately rather than continuing blindly.
- Use plan mode for verification steps, not just implementation.
- Write detailed specifications upfront to reduce ambiguity.

### 2. Subagent Strategy

- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, allocate more compute via subagents.
- Assign one task per subagent to ensure focused execution.

### 3. Self-Improvement Loop

- After any correction from the user, update tasks/lessons.md with the relevant pattern.
- Create rules for yourself that prevent repeating the same mistake.
- Iterate on these lessons rigorously until the mistake rate declines.
- Review lessons at the start of each session when relevant to the project.

### 4. Verification Before Done

- Never mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask: “Would a staff engineer approve this?”
- Run tests, check logs, and demonstrate correctness.

### 5. Demand Elegance (Balanced)

- For non-trivial changes, pause and ask whether there is a more elegant solution.
- If a fix feels hacky, implement the solution you would choose knowing everything you now know.
- Do not over-engineer simple or obvious fixes.
- Critically evaluate your own work before presenting it.

### 6. Autonomous Bug Fixing

- When given a bug report, fix it without asking for unnecessary guidance.
- Review logs, errors, and failing tests, then resolve them.
- Avoid requiring context switching from the user.
- Fix failing CI tests proactively.

### 7. When compacting, always preserve:

- Current file paths being edited
- Test failure messages
- Architecture decisions made this session

## Task Management

1. Plan First: Write the plan to tasks/todo.md with checkable items.
2. Verify Plan: Review before starting implementation.
3. Track Progress: Mark items complete as you go.
4. Explain Changes: Provide a high-level summary at each step.
5. Document Results: Add a review section to tasks/todo.md.
6. Capture Lessons: Update tasks/lessons.md after corrections.

## Core Principles

- Simplicity First: Make every change as simple as possible. Minimize code impact.
- No Laziness: Identify root causes. Avoid temporary fixes. Apply senior developer standards.
- Minimal Impact: Touch only what is necessary. Avoid introducing new bugs.
- Keep PR descriptions concise - summary + test plan only
- Write git commits consice - one-line messages without <<EOF>> etc.

<!-- code-review-graph MCP tools -->

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool                        | Use when                                               |
| --------------------------- | ------------------------------------------------------ |
| `detect_changes`            | Reviewing code changes — gives risk-scored analysis    |
| `get_review_context`        | Need source snippets for review — token-efficient      |
| `get_impact_radius`         | Understanding blast radius of a change                 |
| `get_affected_flows`        | Finding which execution paths are impacted             |
| `query_graph`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview` | Understanding high-level codebase structure            |
| `refactor_tool`             | Planning renames, finding dead code                    |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
