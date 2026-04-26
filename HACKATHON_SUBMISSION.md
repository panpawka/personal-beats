# Personal Beats - Hackathon Submission

For the [Built with Opus 4.7: a Claude Code hackathon](https://cerebralvalley.ai/events/~/e/built-with-4-7-hackathon).

---

## Selected Hackathon Problem Statement

**Build For What's Next.**

Personal Beats is a newsroom-of-one: one sentence in, a personalized newsletter out, on your cadence. No category page, no algorithmic feed, no editor - your own editorial agent reads the live web, applies rules it learned from your brief, and ships an issue to your inbox.

The interface does not have a name yet. It is not a digest, not a search alert, not a chatbot. It is closer to hiring a journalist who only covers your beat, except the journalist is three coordinated agents with persistent memory and a shared sandbox.

This workflow was unbuildable until two months ago. It needs long-horizon reasoning across many tool calls, real code execution against a live web, and memory that survives across runs - Claude Managed Agents ships all three as primitives. Two years ago you could fake the demo; you could not ship the product.

Same orchestration covers wildly different briefs. *"Wrocław weekends with the kids, every Friday at 7am"* and *"Iran–Israel daily briefing, primary sources, deep"* run the same three-agent pipeline - both verified, both shipped before breakfast.

---

## Project Description

**Personal Beats - your own editorial agent.**

You describe what you want covered in one sentence: *"Wrocław weekends with the kids, every Friday at 7am"* or *"Iran–Israel daily briefing, primary sources, deep"*. A Beat Designer agent (Sonnet 4.6) turns the brief into a structured spec, asking at most one or two clarifying questions only when a dimension is genuinely ambiguous. A Sources Scout agent (Sonnet 4.6) discovers and verifies 10–25 sources spanning at least six distinct domains, leaning on a recipe catalogue (Google News RSS, Reddit JSON, HN Algolia, RSS feedparser) before resorting to generic web search. On the cadence you set, an Editor agent (**Opus 4.7**) reads the latest content, applies your beat's learned relevance rules, and drafts a polished issue that ships to your inbox via Mailgun.

The whole editorial loop runs inside Claude Managed Agents - three sub-agents, two memory stores per beat plus one global, an environment with python3.12 + node20 + feedparser + beautifulsoup4 + requests. Wasp owns auth, the dashboard, scheduling (pg-boss), email dispatch, and a live transcript view that polls `agent.events` so you can watch the Designer think. The split is deliberate: Wasp's Postgres holds product data; memory stores hold the agent's brain.

Three example beats - a hyper-local one, a topical-global one, and a crossed beat - prove the personalisation is real and not a wrapper.

*~195 words.*

---

## Public GitHub Repository

<https://github.com/panpawka/personal-beats>

License: MIT (see `LICENSE`).

Live deployment: <https://pb.lemonode.pl> or <https://personalbeats-production-client-production.up.railway.app>

---

## Demo Video

3-minute canonical demo: **TODO - paste YouTube/Loom URL after upload.**

Authoring tree: `tools/demo-video/` - HyperFrames compositions, GSAP animation, the same `src/App.css` that ships in production (no separate brand for the video).

---

## Thoughts and feedback on building with Opus 4.7

**Where 4.7 earned its keep.** The Editor is the model the user actually reads, and Opus 4.7 is the difference between a polished, opinionated newsletter and a list of bullet points. Synthesising 10–25 mixed-language sources, applying a beat's relevance rules, deciding what to cut, writing prose with a voice - this is exactly the long-horizon judgment work where the gap between Sonnet and Opus shows up in the artefact. I A/B'd issues for the Wrocław weekends beat; Opus's drafts had a recognisable editorial register, Sonnet's read like a digest. The price is real but for the user-visible product it's the right call.

**Long-running stability.** Managed Agent sessions for the SCOUT phase routinely run 6–12 minutes, with dozens of tool calls (`web_search`, `bash python -c "..."`, `glob`, `read`, `write`). Opus 4.7 inside a multi-step loop with custom tools (`needs_clarification`, `finalize_beat_spec`, `publish_issue`) was reliable in a way that materially shortened our debugging - I did not spend the hackathon fighting model regressions on tool-call shape.

**Surprises.** The clarification gate was the moment that taught me most. An earlier prompt told the Designer to "ask if anything is unclear"; the model asked too much, and the product felt like an interview. Flipping the prompt to *lean toward proceeding, only ask if two reasonable answers would produce substantially different newsletters* - and showing concrete *DO/DO-NOT-ASK* examples - produced markedly better behaviour on Opus 4.7 than on earlier Opuses I'd worked with. The model takes calibration instructions and applies them with taste.

**Friction.** Running everything in research-preview betas (managed-agents, multi-agent, memory) means brittle SDK boundaries. I hit one bug where a `session.status_idle` event did not fire after a custom tool returned `is_error: false` with an empty result - the `driveAgentJob` reenqueueCount counter exists exactly because of that. Documenting these edges as I hit them was a real cost, but the betas were stable enough to ship a hackathon project on; that itself is a strong signal.

**Context engineering wins.** Per-agent system prompts that explicitly say *"narrate in the beat's `output_language`, not English by default"* fixed a class of mixed-language UI bugs in one go. Opus 4.7 follows that kind of cross-cutting discipline rule instead of needing it repeated per turn.

---

## Did you use Claude Managed Agents? If so, how?

**Yes - Managed Agents is the editorial spine of the product.** Three agents, one shared environment, two memory stores per beat plus one global.

### Agents

| Agent | Model | Role | Custom tools |
|---|---|---|---|
| Beat Designer | `claude-sonnet-4-6` | Brief → `spec.yaml` + `relevance.md` in the beat's spec memory store. Runs a *clarification gate* before proceeding. | `needs_clarification`, `finalize_beat_spec` |
| Sources Scout | `claude-sonnet-4-6` | Reads `spec.yaml`, produces a verified, ranked `sources.yaml` (10–25 URLs, ≥6 distinct eTLD+1 domains). | `scout_complete` |
| Editor | **`claude-opus-4-7`** | Reads spec + sources + history + relevance rules, fetches latest content, drafts the issue HTML + plaintext, returns the structured payload. | `publish_issue` |

All three have the agent toolset (`web_search`, `read`, `write`, `bash`, `glob`) selectively enabled.

### Environment

One shared environment provisioned once via `POST /v1/environments` (script: `scripts/provision-agents.ts`). Packages: `python3.12` + `node20` + `feedparser` + `beautifulsoup4` + `requests` + `dateparser` + `pyyaml` + `lxml`. Open egress so the Scout and Editor can hit arbitrary publishers.

### Memory (research preview)

Two stores per beat plus one global, well under the 8-store limit:

- `<beat>_spec` (read+write) - `spec.yaml`, `relevance.md`, `sources.yaml`. The Designer writes; the Scout reads and writes; the Editor reads.
- `<beat>_history` (read+write) - published items + dedup fingerprints, so the Editor never reships a story.
- `global_patterns` (read-only) - recipes (Google News RSS, Reddit JSON, HN Algolia), language hints (Polish-press gotchas, query translations). Seeded once from `scripts/seeds/`.

Memory mounts are real directories under `/mnt/memory/<store>/`. The system prompts spell this out so the agents `bash ls` before reading and never write at the container root.

### Sessions and the driver

Wasp does not stream. I have used a *bounded-poll* driver pattern that fits inside pg-boss jobs cleanly:

- `driveAgentJob` (`src/server/jobs/driveAgent.ts`) acquires the singleton lock for a beat, runs one bounded tick of `src/server/agents/drive.ts`:
  1. Ensure a session exists for the phase (`POST /v1/agents/:id/sessions`).
  2. Drain pending `AgentMessage` rows into the session via `client.beta.sessions.events.create`.
  3. List new events with a stored `lastEventId` cursor; persist each into the durable `AgentEvent` table.
  4. Dispatch tool-handlers (`needs_clarification` → flips the beat to `AWAITING_CLARIFICATION` and surfaces questions; `finalize_beat_spec` → transitions to SCOUT phase; `scout_complete` → transitions to EDITOR; `publish_issue` → writes the `Issue` row + dispatches the email).
  5. Return one of `reenqueue` / `waiting_for_user` / `phase_done` / `failed`.
- `scheduleSweeperJob` runs every minute, fanning out `generateIssueJob` for any active `TIME_BASED` beat whose cron next-fire is due.
- The UI polls `getAgentEvents` and renders the live transcript while you watch the Designer reason.

This split - Wasp owns product data, Managed Agents owns the agent brain - is what let me ship something more ambitious than a chat wrapper inside a hackathon week.

### Ship-worthy bits I'd actually keep

- Per-agent **system prompts** in `src/server/agents/definitions.ts` that codify the clarification policy, output-language discipline, recipe-first source discovery, and the domain-diversity hard constraint (≥6 distinct domains).
- A **provisioning script** (`scripts/provision-agents.ts`) that is idempotent, persists IDs/versions to `.env.server`, and seeds `global_patterns` from on-disk recipe files.
- A **resumable driver** (`src/server/agents/drive.ts`) that survives crashes - `Beat.{currentSessionId, currentPhase, lastEventId}` is the entire checkpoint.

Code references:

- `src/server/agents/definitions.ts` - three agent definitions and prompts
- `src/server/agents/client.ts` - Anthropic SDK wrapper for the beta
- `src/server/agents/drive.ts` - the bounded-poll driver
- `src/server/jobs/{scheduleSweeper,driveAgent,generateIssue}.ts` - the job pipeline
- `scripts/provision-agents.ts` - one-shot provisioning
- `PRD_cma.md` - full Managed Agents spec
