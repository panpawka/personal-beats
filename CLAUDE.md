# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a **Wasp 0.16+ / 0.23** fullstack app ("Claude Council"). Wasp generates all routing, client/server wiring, and Prisma boilerplate from `main.wasp`. The database is SQLite.

### Key files

| File | Role |
|------|------|
| `main.wasp` | Single source of truth — routes, pages, auth, jobs, queries, actions |
| `schema.prisma` | DB schema (Wasp reads this; do not run `prisma` CLI directly) |
| `src/MainPage.tsx` | Root UI page (currently placeholder) |

### Wasp conventions

- All queries/actions/jobs must be declared in `main.wasp` before they can be imported in TS.
- Import from `wasp/...` (e.g. `wasp/client/operations`) — never from `.wasp/out/` directly.
- Adding a new page: declare `route` + `page` in `main.wasp`, then create the component under `src/`.
- DB changes: edit `schema.prisma`, then run `wasp db migrate-dev`.

# Wasp Knowledge

Wasp knowledge can be found at @.claude/wasp/general-wasp-knowledge.md


## Key Libraries

- **UI**: ShadCN v2 (New York), Tailwind CSS 4, Radix UI
- **Charts**: Recharts
- **Forms**: React Hook Form
- **Tables**: TanStack React Table
- **Payments**: Stripe (webhook-based subscriptions: Mini, Premium)
- **Auth**: Email + GitHub Auth


## Design contract

See [`DESIGN.md`](DESIGN.md) at repo root — binding. Read it top-to-bottom
before any UI work and satisfy the §8 MUST checklist before marking the
task done.

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

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
