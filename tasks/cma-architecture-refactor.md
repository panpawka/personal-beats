# CMA Architecture Refactor Plan

Bulletproof plan to align Personal Newsroom's CMA integration with the
vercel-labs/claude-managed-agents-starter reference (`cma-vercel-example/`).

## 1. What the reference actually teaches

Strip the platform-specific tooling (Next.js 16, Drizzle, Workflow SDK,
Better Auth) and two load-bearing properties remain:

1. **Agent execution decoupled from any client HTTP connection.** The
   Workflow runs on the server, polls CMA, and persists events. Clients
   attach/detach freely.
2. **Durable event log.** `managedAgentEvent` row per CMA event, unique
   on `(sessionId, eventId)`. Transcript is a DB read; reloads are free;
   dedup is trivial.

Secondary lessons worth copying:

- Use `@anthropic-ai/sdk` beta sessions API directly (no hand-rolled HTTP,
  no manual SSE parsing).
- Clients **poll** the transcript table, they do not stream CMA. SSE/streamText
  is explicitly avoided (see `docs/streaming-long-running-agents.md`).
- Message injection into a running workflow via `messageHook.resume(token,
  {text})`.

## 2. What's wrong with the current design

`src/server/streaming.ts` + `src/server/agents/orchestrator.ts` couple:

| Concern                       | Current home                             | Problem                                                              |
| ----------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Driving the CMA session       | SSE handler async-gen                    | Tab close kills run; reload races `activeDrivers` mutex              |
| Transcript persistence        | **none**                                 | Reload = blank event list until next agent message                   |
| Reattach after disconnect     | `designSessionId`/`scoutSessionId` + ad-hoc `continueXPhase` | 3 reattach columns, duplicated drive loops                           |
| Phase serialization           | `chainScoutIfReady` inline in SSE        | Sequence only advances while a client is connected (except Editor)   |
| Concurrency control           | Process-local `Set<string>`              | Breaks on HMR + multi-pod                                            |
| Editor job status             | `editorSessionId = "pending"` sentinel + `PENDING_STALE_MS` | Workarounds for missing durable job state                            |
| SDK drift                     | Hand-rolled fetch with `managed-agents-2026-04-01` header + SSE parser | Silent break on beta bumps                                           |

Editor phase (`generateIssueJob`) is already on pg-boss and works. The
Designer/Scout phases should follow the same shape.

## 3. Platform mismatch (read before planning changes)

The reference uses `useworkflow.dev`. This project uses **pg-boss via Wasp**.
Two concrete gaps:

### 3.1. pg-boss `expireInMinutes` cap

`generateIssueJob` is `expireInMinutes: 30`. Designer and Scout sessions
can legitimately run longer (multi-clarification loops, slow web search).
A naive port dies mid-run.

Mitigations (choose **one**; see §5.A):

- **Bounded-poll + re-enqueue cursor**: job fetches ≤200 events (3 s polling),
  writes `lastEventId` + `pendingMessage` to DB, enqueues itself for the
  next tick. Matches the reference's `MAX_POLLS_PER_TURN` loop semantically
  and stays well under 30 min per execution. **Recommended.**
- Raise `expireInMinutes` + keep a single long job alive. Simpler code,
  but a single CMA hiccup hangs the job and worker.

### 3.2. No `messageHook.resume` equivalent

The reference uses `messageHook.resume(token, {text})` to inject a
clarification reply into a sleeping workflow. pg-boss has no such
primitive.

Replacement: **pending-message column on Beat (or `AgentMessage` queue
table).** Job pulls the next pending message between poll ticks; action
writes the message. Already partially present: `pendingClarification`
stores the reply.

## 4. Target architecture

```
┌─────────────────┐      writes pending msg       ┌─────────────────┐
│ submitClarific. │ ────────────────────────────▶ │   AgentMessage  │
│    action       │                               │   (or column)   │
└─────────────────┘                               └──────┬──────────┘
                                                         │ consumed by
                                                         ▼
┌─────────────────┐   enqueue on phase entry     ┌─────────────────────┐
│   createBeat    │ ────────────────────────────▶│  driveAgentJob      │
└─────────────────┘                              │  (pg-boss)          │
                                                 │                     │
                                                 │ 1. send pending msg │
                                                 │ 2. poll CMA events  │
                                                 │ 3. persist to       │
                                                 │    AgentEvent       │
                                                 │ 4. handle tool      │
                                                 │    calls + mutate   │
                                                 │    Beat status      │
                                                 │ 5. on idle/turn:    │
                                                 │    next phase or    │
                                                 │    re-enqueue       │
                                                 └──────┬──────────────┘
                                                        │ writes
                                                        ▼
┌─────────────────┐   GET /api/stream or poll   ┌─────────────────┐
│ BeatDetailPage  │ ◀───────────────────────────│   AgentEvent    │
│  (polling)      │                             └─────────────────┘
└─────────────────┘
```

Key invariant: **no CMA call happens inside an HTTP request handler**
(except the REST wrappers for reads). All drive logic lives in jobs.

## 5. Plan (priority-ordered)

### P0 — Durable event log + job-driven Designer/Scout

Largest ROI. Removes the whole "did the tab stay open?" class of bug and
deletes most of `streaming.ts`.

**P0.1 — Schema**
- [ ] Add `AgentEvent` model: `id` (cuid), `beatId` (indexed), `sessionId`,
      `phase` (DESIGNER|SCOUT|EDITOR|RELEVANCE), `eventId` (CMA event id,
      nullable for synthetic server-side markers), `type`, `payload` (Json),
      `occurredAt`, unique index `(sessionId, eventId)` where `eventId` is
      non-null. Index `(beatId, occurredAt)` for tail queries.
- [ ] Add `AgentMessage` model **or** reuse `Beat.pendingClarification`:
      `id`, `beatId`, `sessionId`, `kind` (CLARIFICATION|USER_FOLLOWUP),
      `text`, `consumedAt`. Index `(sessionId, consumedAt)`.
- [ ] Add `Beat.lastEventId` (nullable string) — cursor the job writes so
      re-enqueued runs skip already-ingested events.
- [ ] Migration: `wasp db migrate-dev --name add_agent_event_log`.

**P0.2 — Job — `driveAgentJob`**
- [ ] New file `src/server/jobs/driveAgent.ts`. Args: `{ beatId, phase,
      sessionId?, kickoff?: boolean }`.
- [ ] Ensure CMA session exists for the phase (provision memory stores +
      create session on first run; reuse on re-enqueue).
- [ ] If `kickoff`: send the phase-kickoff `user.message` (`design_beat` /
      `scout_sources` / `generate_issue`).
- [ ] Drain any unconsumed `AgentMessage` rows for the session as
      `user.message` events.
- [ ] Poll `client.beta.sessions.events.list(sessionId, { limit: 100,
      after: lastEventId })` (or SDK equivalent). Insert new events into
      `AgentEvent` ignoring duplicates. Update `Beat.lastEventId`.
- [ ] For each `agent.custom_tool_use` seen, track in a local Map.
- [ ] On `session.status_idle`:
  - `stop_reason.type === "requires_action"`: for each referenced
    tool-use, validate with the existing Zod schemas (`NeedsClarification`,
    `FinalizeBeatSpec`, `ScoutComplete`, `PublishIssue`), mutate Beat
    status, reply with `user.custom_tool_result`, **then re-enqueue
    `driveAgentJob`** (same phase).
  - `stop_reason.type === "end_turn"`:
    - DESIGNER end with no tool seen → re-enqueue (agent waiting for
      follow-up clarification reply).
    - SCOUT end after `scout_complete` → enqueue DESIGNER→ACTIVE
      transition (nothing to enqueue beyond flipping status); do not
      re-enqueue.
    - If phase DESIGNER just finalized and Beat status is SCOUTING,
      enqueue `driveAgentJob` with `phase: SCOUT, kickoff: true`.
    - If SCOUT finalized (`scout_complete`), flip Beat to ACTIVE; no
      enqueue.
- [ ] On `session.status_terminated` / `session.error`: mark Beat FAILED,
      record a synthetic `AgentEvent` with `type = "phase.failed"`.
- [ ] Bound each invocation: `MAX_EVENTS_PER_TICK = 200`, `MAX_POLLS = 10`
      with 3 s sleep between polls, `MAX_MS = 20 * 60 * 1000`. If none of
      `status_idle` / terminal seen before any limit: re-enqueue.
- [ ] `expireInMinutes: 25`.
- [ ] `retryLimit: 0`, `singletonKey: \`drive-${beatId}\``  — one drive
      job per beat at a time. pg-boss enforces uniqueness.

**P0.3 — Wiring**
- [ ] `createBeat` action: on insert, enqueue `driveAgentJob({ beatId,
      phase: DESIGNER, kickoff: true })`. (No waiting for SSE.)
- [ ] `submitClarification` action: insert `AgentMessage(kind=CLARIFICATION,
      text=reply)`. Enqueue `driveAgentJob({ beatId, phase: DESIGNER })`
      if not already scheduled (singletonKey handles the race).
- [ ] Keep `generateIssueJob` but migrate its drive loop to the same pattern
      (re-enqueue on cursor). Shared helper in `src/server/agents/drive.ts`.
- [ ] On phase transition (DESIGNER finalized, status=SCOUTING), the drive
      job enqueues itself with `phase: SCOUT, kickoff: true`. This removes
      `chainScoutIfReady` from `streaming.ts`.

**P0.4 — Client-facing tail**
- [ ] Replace SSE `streamBeatCreation` with either:
  - **Option A — keep SSE, thin it**: connection just tails the
    `AgentEvent` table (`ORDER BY occurredAt LIMIT n` + LISTEN/NOTIFY or
    poll at 1 s). No CMA call, no async generator, no mutex, no abort
    plumbing.
  - **Option B — client polls** `GET getAgentEvents({beatId, sinceId})`.
    Matches the reference exactly; lowest complexity. **Recommended
    for hackathon scope.**
- [ ] Add `getAgentEvents` query, `(beatId, sinceId?) → AgentEvent[]`.
- [ ] `BeatDetailPage` replaces fetch+`sseLines` loop with `useQuery(getAgentEvents)`
      on a 1.5 s interval while Beat is in a non-terminal status.

**P0.5 — Deletions once P0 lands**
- `src/server/streaming.ts` — remove entirely (or shrink to Option A
  above). Drop the `api streamBeatCreation` + `apiNamespace streamNs`
  from `main.wasp` in Option B.
- `activeDrivers` mutex — deleted (singletonKey replaces it).
- `continueBeatSession`, `continueScoutPhase` — deleted (reattach is
  "read AgentEvent rows + next drive tick handles the rest").
- `createBeatSession`, `resumeBeatSession`, `runScoutPhase` — merged into
  the drive job's phase dispatcher.

### P1 — SDK migration + `editorSessionId` cleanup

**P1.1 — Use official SDK**
- [ ] Replace `src/server/agents/client.ts` with the `@anthropic-ai/sdk`
      beta sessions client (matches `cma-vercel-example/lib/anthropic.ts`
      + `managed-agents.ts`). Drop the custom SSE parser entirely — the
      drive job uses `events.list`, not the stream endpoint.
- [ ] Drop `cmaStream`, `cmaSse`, beta-header plumbing, manual JSON parse.
- [ ] Keep `createMemoryStore`/`createMemory` as thin SDK wrappers.

**P1.2 — Drop `editorSessionId = "pending"` sentinel**
- [ ] With `AgentEvent` rows + pg-boss job state + `singletonKey`, UI
      derives "generating" from: job has a pending/active entry for beat
      OR any non-terminal Editor events exist. No sentinel needed.
- [ ] Remove `PENDING_STALE_MS`, the stale-pending branch in
      `triggerOnDemandRun`, the `finally { editorSessionId: null }` in
      `generateIssue`.
- [ ] `getIssueSessionStatus` reads from pg-boss (`pgBoss.getJobById` or
      a dedicated `JobState` query) + latest `AgentEvent`.

### P2 — Unify all phases under the same driver

Only after P0 + P1 stabilize.

- [ ] Fold `updateRelevanceSession` (daily feedback job) into the same
      `driveAgentJob({phase: RELEVANCE})` shape.
- [ ] Replace the 3 phase-specific session-id columns (`designSessionId`,
      `scoutSessionId`, `editorSessionId`) with one `currentSessionId` +
      `currentPhase` on Beat, since only one phase is live at a time.
      Keep the legacy columns until all code paths migrate, then drop in
      a follow-up migration.

## 6. Files touched / created

### New
- `prisma schema: AgentEvent, AgentMessage` (+ migration)
- `src/server/agents/drive.ts` — shared phase dispatcher (event fetch,
  tool handling, Beat mutations)
- `src/server/jobs/driveAgent.ts` — pg-boss worker
- `src/server/queries.ts` — `getAgentEvents` query

### Modified
- `main.wasp` — declare `AgentEvent`, `AgentMessage`, `driveAgentJob`,
  `getAgentEvents`; (Option B) delete `streamBeatCreation` + `streamNs`.
- `schema.prisma` — new models + `Beat.lastEventId`.
- `src/server/actions.ts` — `createBeat` enqueues `driveAgentJob`;
  `submitClarification` writes `AgentMessage` + enqueues.
- `src/server/queries.ts` — `getIssueSessionStatus` sources from job +
  events instead of the sentinel.
- `src/server/agents/orchestrator.ts` — becomes a phase-handler module
  used by `drive.ts`; public `createBeatSession/continue/resume` exports
  removed.
- `src/server/agents/client.ts` — rewritten as SDK thin-wrapper.
- `src/server/jobs/generateIssue.ts` — delegates to shared driver.
- `src/pages/BeatDetailPage.tsx` — replace SSE loop with polling query.

### Deleted
- `src/server/streaming.ts` (Option B) or reduced to ~40 lines (Option A).

## 7. Migration ordering (to keep shippable between steps)

1. Land P0.1 schema + Prisma client regeneration — no behavior change.
2. Land P0.2 job + P0.3 wiring **behind a feature flag**
   (`USE_NEW_DRIVER=1`). Old SSE path still default.
3. Smoke test: create a beat end-to-end with the flag on. Verify
   AgentEvent rows + phase transitions + clarification loop.
4. Land P0.4 client polling behind the same flag.
5. Flip flag default to on. Keep old code for one deploy cycle.
6. Delete old SSE + orchestrator entrypoints (P0.5).
7. P1/P2 as separate PRs.

## 8. Risk register

| Risk                                                          | Mitigation                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| CMA `events.list` doesn't support `after` cursor              | Verify against SDK docs first. If no cursor: fetch `limit=100`, diff against `AgentEvent.eventId` unique constraint, discard seen. |
| pg-boss singletonKey drops a concurrent enqueue silently      | Use `singletonNextSlot` or retry the enqueue from the phase handler once current completes.     |
| Two `driveAgentJob` workers race on the same beat             | singletonKey + a row-level `Beat.driveLock` timestamp checked on job start.                     |
| Long clarification wait starves the cursor                    | If a phase is DESIGNER and `stop_reason.type === "end_turn"` and no `finalize_beat_spec` seen, stop re-enqueuing; next enqueue comes from `submitClarification`. |
| Event payload Postgres size (`session.agent_content_block_delta` streams are large) | Store only header fields + content text, not raw CMA payload. Matches reference's normalization. |
| Schema migration on hackathon Postgres                        | `AgentEvent` is additive; no data backfill needed for new beats. Existing beats in flight drained on old path before flag flip. |

## 9. Scope decision needed from user

This touches the hottest paths (orchestrator, streaming, schema). Two
shippable scopes:

- **Full P0 + P1** — ~2–3 days, fundamentally cleaner, zero sentinels,
  SDK-native. Recommended if the app is past the hackathon crunch.
- **P0 only, behind feature flag** — ~1 day. Kills the transcript-lost +
  SSE-mutex classes of bug; keeps hand-rolled SDK client for now.

Please confirm which scope before execution.
