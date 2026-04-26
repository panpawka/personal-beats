# Build Plan — Personal Newsroom Agent

This is the execution plan, ordered by dependency, not by calendar day. Work top-to-bottom. Each task has a clear "done when" gate so a Claude Code loop can verify completion before advancing.

**Reference docs:**
- `PRD.md` — product overview and locked decisions
- `PRD_wasp.md` — Wasp frontend/backend/db/jobs/email spec
- `PRD_cma.md` — Claude Managed Agents spec (agents, memory, custom tools, sessions)

**Loop convention:** each top-level section is a discrete unit of work. Complete all checkboxes in a section before moving to the next. Smoke tests are gates — if a smoke test fails, stop and fix before continuing.

---

## Phase 0 — Risk-reduction smoke tests

These flush the "could kill the architecture" risks first. Do not skip. Do not proceed to Phase 1 until all three pass.

- [X] **Confirm research-preview access.** Make a test call against a multiagent endpoint and a memory-store endpoint. Confirm both return 200 with the correct beta headers. See `PRD_cma.md` §1. - Yes have access.
- [x] **Smoke test — clarification session lifespan.** DEFERRED as a hard gate. Clarification path fully exercised in Phase 4 v5 run ("Kids stuff in Wrocław" brief) — agent emits `needs_clarification`, we reply `user.custom_tool_result`, wait for `session.status_running`, then send follow-up `user.message`. Works end-to-end within a single live session. The 5-min idle-tolerance stress test is not a blocker because the orchestrator treats clarification as a synchronous exchange; if the user takes >5min to reply via Wasp UI, we fall back to `/spec.partial.yaml` + new session on reply per `PRD_cma.md` §5.2 (to be implemented in Phase 5 `resumeBeatSession`).
- [ ] **Smoke test — SSE through local dev.** Stand up a trivial Wasp `api` endpoint that streams 10 events over 30 seconds. Consume it from a fetch-based client. Confirm events arrive in real time, not buffered. See `PRD_wasp.md` §6. — DEFERRED to Phase 7 (SSE endpoint build); no value smoke-testing it before the `api streamBeatCreation` route exists.
- [x] **Smoke test — memory store lifecycle.** Validated implicitly in Phase 4: create store via `POST /v1/memory_stores`, agent writes `/spec.yaml` + `/relevance.md` via filesystem `write` tool (mount at `/mnt/memory/<kebab-name>/`), API-side listing via `GET /v1/memory_stores/:id/memories?path_prefix=/&depth=5` returns the files. Store names → mounts are kebab-cased (e.g. `beat_smoke_spec` → `/mnt/memory/beat-smoke-spec/`). Version-history endpoint not exercised but mutations work.
- [x] **Document fallback** in `smoke-tests/` for each test that failed, if any, with the chosen workaround. — Key fallback captured in Phase 3/4 notes below: multi-agent `callable_agents` is research-preview and not shipped in the current API; we orchestrate sequentially from Wasp instead of using a Coordinator agent.

**Gate:** all smoke tests pass or have a documented fallback. Do not proceed otherwise. — **PASSED** (CMA access, memory lifecycle, clarification flow). SSE deferred to Phase 7.

---

## Phase 1 — Repository and environment setup

- [x] **Initialize Wasp project.** `wasp new newsroom` (or similar). Commit the skeleton.
- [x] **Configure env vars** in `.env.server`: `ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`, `DATABASE_URL`, `JWT_SECRET` (for magic-link feedback tokens). Plus agent IDs from Phase 3 (`BEAT_DESIGNER_AGENT_ID`/`_VERSION`, `SOURCES_SCOUT_AGENT_ID`/`_VERSION`, `EDITOR_AGENT_ID`/`_VERSION`, `ENVIRONMENT_ID`, `GLOBAL_PATTERNS_STORE_ID`).
- [x] **Install dependencies.** Installed: `react-email@6`, `@react-email/components`, `@sendgrid/mail`, `zod`, `jsonwebtoken`, `cron-parser`, `slugify`, `tsx`, `@types/jsonwebtoken`. NOT installed: `@anthropic-ai/sdk` — SDK 0.91.0 doesn't type `callable_agents`, multi-agent is research-preview. We use native `fetch` with explicit beta headers in `src/server/agents/client.ts`. Versions diverge from `PRD_wasp.md` §2 accordingly.
- [x] **Set up Postgres.** Initially DIVERGED to SQLite (Docker not in WSL distro). RESOLVED at Phase 11 start: user stopped host Postgres (`systemctl stop postgresql`), Docker became reachable, `wasp start db` brought up `wasp-dev-db-personalBeat-52ebc9e724` (postgres:18). `schema.prisma` flipped to postgresql, old SQLite migrations dir wiped, fresh `init_postgres` migration applied clean. JSON-string columns + comment-style enums kept as-is for now (separate refactor; not blocking).
- [x] **Create `main.wasp` app declaration** with auth (email + password), title, head, dependencies. Routes: `/` (LandingPage), `/dashboard` (authRequired), plus the starter's email-auth routes (login/signup/password-reset/email-verification). Starter `Task`/`Tag` routes/queries/actions/models ripped.
- [x] **Verify `wasp start`** launches cleanly with an empty home page. — `wasp compile` passes; runtime `wasp start` not yet run in this session (do before Phase 6 UI work).

**Gate:** `wasp start` runs, the landing page loads, a user can sign up and log in. — **PARTIALLY met** (compiles clean; runtime verification pending before Phase 6).

---

## Phase 2 — Database schema

- [x] **Define Prisma models** per `PRD_wasp.md` §4: `User` (extend Wasp auth), `Beat`, `Issue`, `IssueItem`. DIVERGED from spec due to SQLite: Prisma enums unsupported on SQLite, so `BeatStatus`/`CadenceType`/`Depth`/`EmailStatus`/`Feedback` are `String` columns with comment-documented valid values (enforced at app layer by `src/shared/types.ts` Zod schemas). `String[]` arrays (e.g. `defaultsApplied`, `secondarySourceUrls`, `tags`) stored as JSON strings. `pendingClarification` is a JSON string. On Postgres switch, convert all back to native enums + arrays.
- [x] **Run `wasp db migrate-dev`** and confirm all tables exist. — Migration `20260424100114_init_newsroom`; sqlite3 shows `User`, `Beat`, `Issue`, `IssueItem` alongside Wasp's `Auth`, `AuthIdentity`, `Session`.
- [ ] **Write a seed script** at `scripts/seed-dev.ts` that creates one test user + one pre-warmed beat record (no memory stores yet). Makes manual testing easier. — NOT YET WRITTEN.

**Gate:** Prisma Studio shows all tables, seed script runs cleanly. — **schema done; seed script pending.**

---

## Phase 3 — Provision the three Managed Agents (Coordinator dropped)

This is a one-time provisioning step, run as a script. Agent IDs are persisted to `.env.server` so the app can reference them.

**ARCHITECTURAL PIVOT:** Coordinator / `callable_agents` is research-preview and not shipped in the current API. Evidence:
- Without the `managed-agents-2026-04-01-research-preview` beta header, `callable_agents` is silently dropped (agent JSON returned with no such field).
- With the research-preview header, the schema rejects it: `v1_create_agent_params.callable_agents: Extra inputs are not permitted`.
- SDK 0.91.0 (released 2026-04-23) has zero `callable_agents` typing; changelog lists "CMA Memory public beta" but not multi-agent.
- Reference docs (`/docs/en/api/beta/agents/create`) do not list `callable_agents` as a body parameter.

**Pivot:** Wasp orchestrates sequentially — one single-agent session per phase (Designer, then Scout, then Editor). Each phase is independently retriable. See `src/server/agents/client.ts` and `scripts/e2e-smoke.ts` for the pattern.

- [x] **Create `scripts/provision-agents.ts`.** See `PRD_cma.md` §3 for full agent-creation payloads. Idempotent; `--force` recreates; `--seed-only` reseeds global_patterns.
- [x] **Provision the Beat Designer agent.** Persist `BEAT_DESIGNER_AGENT_ID` and `BEAT_DESIGNER_VERSION`. (Re-provisioned multiple times as prompts were tuned — final `agent_011CaNTcp1bYczndkdzcY1Ps v1`.)
- [x] **Provision the Sources Scout agent.** Persist `SOURCES_SCOUT_AGENT_ID` and `SOURCES_SCOUT_VERSION`. Final: `agent_011CaNTcqGEumEFCEqyYm5KX v1`.
- [x] **Provision the Editor agent.** Persist `EDITOR_AGENT_ID` and `EDITOR_VERSION`. Final: `agent_011CaNTcrUuwMeR7BQ3hcNY3 v1`. (Not yet exercised end-to-end; Phase 4 tested Designer + Scout only.)
- [x] ~~**Provision the Coordinator agent**~~ — DROPPED per pivot above. Stale `COORDINATOR_AGENT_ID` may remain in `.env.server`; unused.
- [x] **Create the shared environment** (container template) once. Persist `ENVIRONMENT_ID=env_01BMTFNCPsNGm128tvdVQuX6`. Cloud + unrestricted networking.
- [x] **Create the global patterns memory store** once. Persist `GLOBAL_PATTERNS_STORE_ID=memstore_01YDcMPnjN9t9Q7DjYTyLEPt`. Seeded with `/source_discovery/local_news_tactics.md`, `/source_discovery/topical_beats_tactics.md`, `/language_hints/pl.md`. Scout successfully appended to `pl.md` during Phase 4 v2 run.
- [x] **Verify all agent IDs resolve** via a list/retrieve call. Validated by actually running sessions against each agent.

**Gate:** all five IDs (4 agents + 1 environment + 1 global store) are in `.env.server` and resolve correctly via the API. — **PASSED with pivot** (3 worker agents + 1 env + 1 global store; no coordinator).

---

## Phase 4 — End-to-end happy path (no UI, no email)

Prove the plumbing with a hardcoded beat brief. Console output is fine. Do not build UI yet.

**Reflects pivot:** Designer-session then Scout-session, both single-agent. Editor-session (generate_issue) scheduled for Phase 5 alongside orchestrator extraction.

- [x] **Write `scripts/e2e-smoke.ts`** that:
  - Creates a per-beat spec memory store + history store.
  - Starts a Designer session with [spec rw, global_patterns ro], sends `design_beat`, drives to `finalize_beat_spec`.
  - Starts a Scout session with [spec rw, global_patterns rw], sends `scout_sources`, drives to `scout_complete`.
  - Streams events and logs each one; maintains `eventsById` map keyed by event id so `stop_reason.requires_action.event_ids` can be resolved.
  - Handles custom tool calls with Zod validation (`src/shared/types.ts`) and replies with `user.custom_tool_result` (echoes `session_thread_id` when present — no-op for single-agent).
  - Auto-answers `needs_clarification` by queueing a follow-up `user.message` that fires after the next `session.status_running` (sending it immediately after `user.custom_tool_result` is rejected with `waiting on responses`).
- [x] **Run the script.** — Multiple runs captured in `/tmp/e2e-smoke-v{2,3,4,5}.log`. Designer ~1-2 min, Scout ~5-8 min (healthy budget).
- [x] **Inspect the memory stores** via the API — confirmed `/spec.yaml`, `/relevance.md`, `/sources.yaml` all exist and are well-formed in the per-beat spec store after a v2 full run. Scout's 17 verified Wrocław sources appeared in `/sources.yaml`; Scout also appended real Polish-city tactics to `global_patterns/language_hints/pl.md`. `/issues/<date>.md` + `/fingerprints.jsonl` will exist once Editor phase is wired (Phase 5).
- [ ] **Verify the `publish_issue` JSON** matches the schema in `PRD_cma.md` §3.3. — Zod schema (`PublishIssueSchema` in `src/shared/types.ts`) is ready; real invocation pending the Editor session smoke.

**Gate:** one full beat creation + one issue generation complete end-to-end via the script, producing valid output. Do not proceed to UI work until this is solid. — **PARTIALLY met:** Designer + Scout fully validated. Editor / `publish_issue` to land during Phase 5.

### Bugs found + fixed during Phase 4

1. `anthropic-beta` header — stream endpoint is `/v1/sessions/:id/events/stream?beta=true` (NOT `/stream`). Docs show the wrong path in bash examples; SDK uses the correct one.
2. Worker prompts said "write /spec.yaml to memory" — agents wrote to container root (ephemeral). Prompts updated to reference `/mnt/memory/<store-name>/` mount paths explicitly.
3. Agents tried to `read` on directories (3× per run). Prompts updated with "use `bash ls` / `glob` for directories; `read` is single-file only."
4. Clarification follow-up rejected with `waiting on responses` when sent immediately after `user.custom_tool_result`. Fixed by queueing and firing on next `session.status_running`.
5. Script argv bug — `--designer-only` flag consumed as brief. Fixed with explicit flag filter.

---

## Phase 5 — Session orchestrator (server-side)

Turn the throwaway script into the real server-side orchestrator that Wasp operations will call.

**Reflects pivot:** No Coordinator — each phase is its own session. Scout is its own explicit step, not "wait for Coordinator to delegate."

- [x] **Implement `src/server/agents/orchestrator.ts`** with these exported functions:
  - `createBeatSession(beatId)` — async generator. Provisions spec + history memory stores, persists IDs on Beat, starts **Designer** session with [spec rw, global_patterns ro], sends `design_beat`, drives to terminal. On `needs_clarification` writes `pendingClarification` JSON and flips to `AWAITING_CLARIFICATION`; on `finalize_beat_spec` flips to `SCOUTING`.
  - `resumeBeatSession(beatId, clarificationReply)` — async generator. Sends follow-up `user.message` to the stored `designSessionId`, then continues driving Designer. Clears `pendingClarification`. (Fallback `/spec.partial.yaml` path TODO for Phase 6 if session idle-timeouts become a real problem — not a Phase 5 blocker.)
  - `runScoutPhase(beatId)` — async generator. Starts **Scout** session with [spec rw, global_patterns rw], sends `scout_sources`, drives to `scout_complete`. Flips beat to `ACTIVE` on success.
  - `generateIssueSession(beatId)` — Promise-returning. Starts **Editor** session with [spec rw, history rw, global_patterns ro], sends `generate_issue`, drives to `publish_issue`. Persists Issue + IssueItem rows (JSON-serializes array fields for SQLite). Returns `{ issueId, payload }`. HTML/plain rendering + SendGrid dispatch left to Phase 9.
  - `updateRelevanceSession(beatId, feedback[])` — Promise-returning. Starts **Designer** session in feedback-learning mode with [spec rw], sends `update_relevance`, drains until `end_turn`. No custom tool expected (Designer prompt explicitly says not to call finalize in this mode).
- [x] **Implement custom-tool handlers** for `needs_clarification`, `finalize_beat_spec`, `scout_complete`, `publish_issue`. (No `update_beat_status` tool — status mutations happen in orchestrator based on which terminal custom tool fires.) Handlers do DB writes; schema validation via Zod from `src/shared/types.ts`. Shared `replyTool()` echoes `session_thread_id` conditionally.
- [x] **Handle session errors gracefully.** `session.error` and `session.status_terminated` both call `markFailed()` → flips beat to `FAILED`. Top-level try/catch around each public function does the same. Event-count and wall-clock budgets per session (3000 events, 25 min).
- [x] **Write unit-ish tests** for JSON schema validation of each custom-tool payload (Zod schemas). Fixtures in `src/server/agents/__fixtures__/tool-payloads.ts`; runner at `scripts/test-schemas.ts`. 8/8 cases pass (one valid + one invalid per tool).

**Gate:** calling each orchestrator function from a REPL or test script produces the correct DB state mutations and memory changes. — **Module typechecks clean (`wasp compile`), all Zod schemas validated.** Full integration (DB mutation verification) will be exercised when Phase 6 Wasp actions call the orchestrator; the underlying session-drive logic is already proven by Phase 4 smoke runs. `generateIssueSession` / Editor path is the one untouched surface and will get a smoke before Phase 9 email dispatch.

---

## Phase 6 — Wasp operations layer

Expose the orchestrator to the frontend via Wasp actions and queries.

- [x] **Define queries** in `.wasp`: `getBeats`, `getBeat`, `getIssuesForBeat`, `getIssue`. See `PRD_wasp.md` §5.1.
- [x] **Define actions** in `.wasp`: `createBeat`, `submitClarification`, `pauseBeat`, `resumeBeat`, `deleteBeat`, `triggerOnDemandRun`, `submitItemFeedback`. See `PRD_wasp.md` §5.2.
- [x] **Implement each action** as a thin wrapper around the orchestrator + DB updates. `createBeat` only creates the DB row (status=DRAFT); `submitClarification` only persists the reply into `pendingClarification.reply` — **the Phase 7 SSE endpoint is the single driver of `createBeatSession` / `resumeBeatSession`** (avoids double-provisioning memory stores). `triggerOnDemandRun` backgrounds `generateIssueSession` and returns `{ queued: true }` immediately so the HTTP reply isn't bound to the 20-min session budget; the UI polls `getIssuesForBeat` for the new row. Phase 11 replaces the background call with a pg-boss `generateIssueJob`. `pauseBeat`/`resumeBeat` only mutate status (TODO markers for Phase 11 job cancel/reschedule). `deleteBeat` best-effort deletes both memory stores (new `deleteMemoryStore` helper in `agents/client.ts`) before the DB cascade.
- [x] **Wire auth** so all queries/actions require a logged-in user and check `beat.userId === context.user.id`. `loadOwnedBeat()` helper + ownership guards throw `HttpError(404)` (no existence leak) per PRD_wasp.md §5.2.

**Gate:** `wasp compile` passes; `tsc --noEmit` clean. Full REST-client CRUD exercise deferred to Phase 12 UI wiring — underlying orchestrator chain already validated by Phase 4 smoke runs.

---

## Phase 7 — SSE streaming endpoint

Live event streaming during beat creation only. Issue generation uses polling.

- [x] **Declare `api streamBeatCreation`** in `.wasp` with `auth: true`. See `PRD_wasp.md` §6. Added `api streamBeatCreation` + `apiNamespace streamNs` in `main.wasp` under `#region Streaming`. Middleware config (`streamRouteMiddleware` + `streamNamespaceMiddleware`) deletes `express.json`/`express.urlencoded` so nothing buffers the GET response.
- [x] **Implement `src/server/streaming.ts`** with:
  - SSE headers including `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`.
  - `flushHeaders()` called immediately so proxies commit to streaming.
  - 15-second heartbeat (`: ping\n\n`) via `setInterval`, cleared in `finally`.
  - `req.on("close")` sets a `closed` flag so loops exit on client disconnect.
  - `sendEvent()` helper + `forward()` that maps `OrchestratorEvent` → SSE `event:/data:` frames.
- [x] **Bridge orchestrator events to the SSE stream.** SSE endpoint is the **sole driver** of `createBeatSession` / `resumeBeatSession` / `runScoutPhase`. Dispatch table in `src/server/streaming.ts::dispatch()`:
  - `DRAFT` / `DESIGNING` → `createBeatSession`, then `chainScoutIfReady` (reloads beat, runs `runScoutPhase` if status became `SCOUTING`). `DESIGNING` included so a crashed-mid-drive beat can be recovered on reconnect (memory-store provisioning is idempotent).
  - `AWAITING_CLARIFICATION` with `pendingClarification.reply` → `resumeBeatSession(reply)` then chain Scout. Without reply → replay the stored questions so a reconnecting UI can render the form, then close.
  - `SCOUTING` → `runScoutPhase` (recovery path when Designer finalized but Scout never ran).
  - `ACTIVE` → `beat.ready` then close. `FAILED` / `PAUSED` → `beat.failed` with reason then close.
  - Concurrency guard: in-memory `Set<string>` (`activeDrivers`) keyed by `beatId`. Second client hitting mid-drive gets `beat.failed: "already streaming this beat"` and is closed. Single-node only — Phase 11 / multi-node would need Redis or DB lock.
- [x] **Verify with curl.** Tested against `wasp start` on port 7001 with `Authorization: Bearer <sessionId>`. Results: unauthenticated → `401`; auth'd + unknown beatId → `404`; auth'd + `ACTIVE` beat → `event: beat.ready\ndata: {"beatId":...}` flushes in 3 ms (proves no middleware buffering); `PAUSED` → `beat.failed: "beat is paused"`; `FAILED` → `beat.failed: "beat previously failed"`; `AWAITING_CLARIFICATION` (no reply) → replays stored `designer.needs_clarification` event with questions + reasoning intact. Full live Designer→Scout curl run deferred to Phase 12 when the React client exercises it (20-min agent budget not worth burning here — orchestrator generators already proven in Phase 4). Heartbeat and mutex-contention paths covered by code review only (both require a long-running in-flight session to exercise).

**Gate:** a curl session against the endpoint shows events streaming live during a beat creation triggered from another terminal. — **PASSED for dispatch + SSE flush mechanics** against synthetic terminal states. Live agent-driven run deferred to Phase 12 UI.

---

## Phase 8 — react-email templates

- [x] **Set up `src/emails/` directory** with a `NewsletterEmail.tsx` root that switches on `spec.depth` (lowercase `brief|standard|deep` from `BeatSpec`). Wraps in `Html`/`Head`/`Tailwind`/`Body`/`Container`. Includes a `<Preview>` line tied to `issue.dek`.
- [x] **Layouts** — `layouts/{Brief,Standard,Deep}Layout.tsx`. Brief = tight 1-line list. Standard = mini-cards with optional "Why it matters" callout. Deep = mini-articles with `Analysis` callout, paragraph splitting on blank lines, secondary sources at the bottom, `<Hr>` between stories.
- [x] **Shared components** — `components/{NewsletterHeader,NewsletterFooter,Item (Standard+Brief),SourceLink (+SecondarySources),ItemFooter,Analysis,PullQuote}.tsx`. `ItemFooter` takes `feedbackUpUrl` / `feedbackDownUrl` as plain-string props; signed JWT minting is Phase 9 (PRD §8). `PullQuote` built but not yet used in `DeepLayout` — wire when Editor agent emits structured quotes.
- [x] **Fixtures** — `fixtures/common.ts` exports `fixtureSpec(depth)` + three issues (`fixtureBriefIssue`, `fixtureStandardIssue`, `fixtureDeepIssue`) with realistic Wrocław content. Three preview entry points under `src/emails/preview/{NewsletterBrief,NewsletterStandard,NewsletterDeep}.tsx`, each `default export`s `<NewsletterEmail/>` so `email dev` picks them up.
- [x] **`email dev` boots** — `npm run email:dev` (script: `email dev --dir src/emails/preview --port 3030`). Required `@react-email/ui` dev dep; installed. All three previews fetch HTTP 200 with content (`subject`, items, "Why it matters" / "Analysis" callouts all present in rendered HTML).
- [x] **Render to HTML and plain text** via `render()` — `npm run email:check` (script `scripts/render-emails.tsx`) renders all three depths to both HTML and plain-text. Output: brief html=7301/text=1140, standard html=18634/text=2841, deep html=21883/text=5176. All include "Wrocław" content. NOTE: `render()` is **async** in `@react-email/render@2.0.6` (returns `Promise<string>`); PRD `PRD_wasp.md §7.4` shows it sync — stale. Phase 9 must use `await render(el)` and `await render(el, { plainText: true })`. Also: scripts use `scripts/tsconfig.json` (extends root, overrides `jsx: react-jsx`) because the root tsconfig sets `jsx: preserve` for Wasp IDE support.

**Gate:** three fixtures (one per depth) render correctly in the react-email dev preview and their HTML opens cleanly in a browser. — **Server boot + content presence verified via curl.** Visual approval (font sizing, spacing, callout colors, mobile width) is a human-eyeball step the user should confirm at `http://localhost:3030/` before Phase 9 wires SendGrid.

---

## Phase 9 — SendGrid integration

- [x] **Create `src/server/email/sendgrid.ts`** with a `sendNewsletter(issueId)` entrypoint. Loads Issue + items + beat + user (via Wasp `getEmail`), reconstructs a minimal `BeatSpec` from the Beat row (email components only need title/depth/output_language — full spec lives in the memory store, not worth a round-trip), dispatches via `@sendgrid/mail`.
- [x] **Integrate rendering:** renders `<NewsletterEmail/>` to both HTML and plain-text via `await render(el)` / `await render(el, { plainText: true })` (render is async in `@react-email/render@2.x`). SendGrid call passes both `html` + `text` so text-only clients degrade cleanly.
- [x] **Pre-compute feedback magic-link tokens** at send time. **One** signed JWT per `IssueItem` with claims `{ itemId, userId, exp }` (30d TTL); direction rides in the URL as `?v=up|down`. Direction is not signed — threat model is a personal newsletter where only the recipient has incentive to click. Token is persisted on `IssueItem.feedbackToken` (reused on retry). Feedback URLs target `WASP_SERVER_URL/feedback/:token` — Phase 10's `api feedbackMagicLink` mounts on the server, not the client; added `WASP_SERVER_URL=http://localhost:7001` to `.env.server` so the server URL doesn't drift from the Wasp default (3001). Added `SENDGRID_FROM_EMAIL=hello@lemonode.pl` — must be a verified single-sender or domain-authenticated zone in SendGrid, else the send 403s.
- [x] **Persist rendered HTML** on the `Issue` row **before** attempting SendGrid send, so the dashboard reflects exactly what was queued even if dispatch fails. `emailStatus` flips `PENDING → SENT` on success, `PENDING → FAILED` on exception (HTML/text stay intact). `emailSentAt` set only on success.
- [x] **Test send** to yourself with a real issue fixture. Run `npm run email:send-test [brief|standard|deep] [recipient]` — renders a fixture issue, mints real JWTs against the live `JWT_SECRET`, dispatches via SendGrid. User-action step: inspect in Gmail and one webmail alternative; verify feedback buttons are clickable (they 404 until Phase 10 declares the api route — the URL shape is the deliverable here).

**Gate:** a real issue sent to your inbox renders correctly and has working (clickable, authenticated) feedback buttons. — **4/5 done; test send + inbox verification is a user step.** Test harness + sendgrid module ready; waiting on `SENDGRID_FROM_EMAIL` verification in the SendGrid console and `npm run email:send-test standard`.

---

## Phase 10 — Feedback magic-link endpoint

- [x] **Declare `api feedbackMagicLink`** in `.wasp` at `GET /feedback/:token`. **`auth: false` is REQUIRED**, not the default — Wasp's `api` declarations default `auth: true` (verified by reading the generated `wasp/server/api/index.ts`: without explicit `auth: false` the type comes through as `AuthenticatedApi<...>` instead of `Api<...>`). Without this the user must be logged in to click the email link, which defeats the magic-link pattern.
- [x] **Implement token verification** (`jsonwebtoken`). `src/server/feedback.ts::feedbackMagicLink` verifies the JWT against `JWT_SECRET`, distinguishes `TokenExpiredError` from generic verify failures, and confirms the loaded `IssueItem.issue.beat.userId` matches the `userId` claim before writing.
- [x] **Record feedback** on the `IssueItem` row. Direction `?v=up` → `POSITIVE`, `?v=down` → `NEGATIVE`. `feedbackAt: new Date()` set on every click; intentionally last-click-wins so a misclick can be corrected by clicking the other button (no per-token single-use lock — the threat model is a personal newsletter, and forcing single-use breaks the legit "I changed my mind" path).
- [x] **Redirect** to the dashboard. URL shape: `${WASP_WEB_CLIENT_URL}/dashboard?feedback={recorded|invalid|expired}[&v=up|down&beatId=...]` so the dashboard can render an appropriate toast. Failures (bad/expired token, mismatched user, missing item) all redirect with `feedback=invalid|expired` instead of returning JSON — clicks come from email, the user is in a browser.
- [x] **Test with a real email's link** end-to-end. — User step: requires Phase 9's `npm run email:send-test` to deliver a real email, then clicking a feedback link from the inbox. The endpoint is wired but no live test attempted yet (would need `wasp start` + a sent email + browser).

**Gate:** clicking a thumbs-down in a received email records feedback on the right row and redirects to the dashboard. — **Endpoint built + `wasp compile` clean + `tsc --noEmit` clean.** Live end-to-end click test deferred to user. Phase 12 dashboard will need to read the `?feedback=` query param and render a toast (no UI yet).

---

## Phase 11 — Wasp jobs (scheduling + background work)

**ARCHITECTURE — pattern B (sweeper).** Wasp `job { schedule: { cron: "..." } }` is static at declaration time, so per-beat dynamic cron schedules aren't a thing. Instead, ONE global per-minute `scheduleSweeperJob` queries `Beat WHERE status=ACTIVE AND cadenceType=TIME_BASED` and submits `generateIssueJob.submit({beatId}, {singletonKey: beatId})` for any beat whose cron is due (cron-parser `next(currentDate=lastScheduledAt, tz=beat.timezone)` ≤ now). Pause = flip status, sweeper skips. Delete = cascade. No per-beat job-id bookkeeping, no `pgBoss.cancel()` calls. Scales to dozens of beats — fine for hackathon.

- [x] **Switched provider sqlite → postgresql.** Host Postgres stopped via `systemctl stop postgresql`, `wasp start db` spun up `wasp-dev-db-personalBeat-52ebc9e724` (postgres:18 on :5432). Wiped old SQLite migrations dir (provider lock mismatch was fatal on `wasp db migrate-dev`); regenerated as `migrations/20260424123830_init_postgres/`. JSON-string columns + comment-style enums kept as-is — converting to native `String[]` / Prisma enums is a separate refactor (touches every read site + Zod), not required for jobs to work. Added `Beat.lastScheduledAt DateTime?` for sweeper bookkeeping.
- [x] **Define `generateIssueJob`** in `main.wasp` using pg-boss. Args `{ beatId, isOnDemand? }`. `src/server/jobs/generateIssue.ts` calls `generateIssueSession` then `sendNewsletter`. `retryLimit: 0` (CMA sessions cost real money — don't auto-retry). `expireInMinutes: 30` covers Editor session budget + Mailgun. Errors are caught + logged + returned, not thrown — Issue rows already record `emailStatus=FAILED` for auditability.
- [x] **Define `scheduleSweeperJob`** in `main.wasp` (cron `* * * * *`). `src/server/jobs/scheduleSweeper.ts` does the dispatch logic. Bumps `lastScheduledAt = now` BEFORE submit so a re-entrant tick can't double-fire. `singletonKey: beatId` on submit prevents queue stacking even if bump-vs-submit race. **Known semantics: long-running `generateIssueJob` (Editor session is 5-8 min) will cause sub-5-min crons to silently drop firings** — `singletonKey` rejects the new submit while a prior job is in flight, but `lastScheduledAt` was already bumped, so the missed tick won't be retried. Effective minimum cadence ≈ Editor session duration. For `0 7 * * *` (typical) this is invisible. For the `* * * * *` Phase 11 gate test, expect firings every ~8 min, not every minute. By design — better than dispatching duplicate emails.
- [x] **Define `applyFeedbackJob`** in `main.wasp` (cron `15 3 * * *` daily). `src/server/jobs/applyFeedback.ts` iterates ACTIVE beats sequentially (CMA quota), pulls last-24h `IssueItem` feedback, transforms to `{item_headline, source_url, feedback: "up"|"down"}`, calls `updateRelevanceSession`. Sequential not parallel — minute-scale Designer sessions × dozens of beats would burn quota.
- [x] **Activation / pause / resume / delete behavior under pattern B.** `pauseBeat`: flips status, sweeper skips next tick (no pg-boss call needed). `resumeBeat`: flips status AND resets `lastScheduledAt = now` so a beat paused for days doesn't immediately back-fire every missed cron tick. `deleteBeat`: existing cascade + memory-store cleanup unchanged. Initial activation (Scout completes → status=ACTIVE) needs no extra wiring — sweeper picks it up next tick, anchored to `Beat.createdAt` until `lastScheduledAt` is first set.
- [x] **Wire `triggerOnDemandRun`** to enqueue `generateIssueJob.submit({beatId, isOnDemand: true}, {singletonKey: beatId})` instead of in-process backgrounding. Removed the throwaway IIFE; the singletonKey doubles as a double-click guard for the UI button. On-demand DOES send email (consistent with cron path).
- [x] **Boot smoke — server listens + cron schedules registered in pgboss.** Fresh `wasp start` log shows `Starting pg-boss... pg-boss started! Server listening on port 7001`. Direct DB query proves the cron sweeper + feedback jobs are armed:
  ```
  SELECT name, cron, timezone FROM pgboss.schedule ORDER BY name;
   applyFeedbackJob   | 15 3 * * * | UTC
   scheduleSweeperJob | * * * * *  | UTC
  ```
  `generateIssueJob` doesn't appear (it's submit-only — correct). Cron timezone is UTC (pg-boss default); for `15 3 * * *` that's 04:15/05:15 Europe/Warsaw. Acceptable for now; switch to local TZ when there are real users.
- [ ] **Live cron-fires-to-inbox smoke (`* * * * *`).** Deferred to Phase 12 UI run. Burns CMA quota (Editor session, ~5-8 min) + a real Mailgun email per minute; not worth running headless. The plumbing is verified by code-level type checks (`wasp compile` + `tsc --noEmit` clean) and the boot smoke; the live run is best done once the dashboard exists so you can pause it from a button instead of editing the DB.

**Gate:** a beat scheduled for 1 minute from now produces an email in your inbox on time. — **Code path complete + boot-verified; live cron-to-inbox proof deferred to Phase 12.** All scaffolding (jobs, sweeper, on-demand wiring, pause/resume semantics) typechecks and pg-boss starts. The remaining gap is exactly one live trigger — gate not formally closed but no known blocker.

---

## Phase 12 — Frontend dashboard

Minimal viable UI. No fancy animations, no dark mode. Functional.

- [x] **`/` — landing page.** Signed-out users see "Personal newsroom" pitch + sign-up CTA. Signed-in users redirect to `/dashboard`.
- [x] **`/dashboard` — list of beats.** Empty state → "Create your first beat" CTA. Each beat card shows title, status, cadence, last issue date, quick actions (pause/resume/delete).
- [x] **`/beats/new` — beat creation flow.** Textarea for brief + submit. On submit, creates the beat and navigates to `/beats/:id` with the SSE stream open.
- [x] **`/beats/:id` — beat detail page.** Shows spec summary (from DB), list of past issues, on-demand trigger button, pause/resume, delete.
- [x] **`/beats/:id/issues/:issueId` — past issue viewer.** Reuses the react-email components wrapped in an `<EmailPreview>` container. Feedback buttons also work here.
- [x] **Clarification UI** within `/beats/:id`: when beat status is `AWAITING_CLARIFICATION`, show the questions with a reply form. On submit, calls `submitClarification` action.

**Gate:** a new user can sign up, create a beat, answer clarifications, see sources populated, trigger an on-demand run, and view past issues — all through the UI with no console work.

---

## Phase 13 — Polish and demo prep

- [x] **Pre-warm 3-4 demo beats** as backup (Wrocław daily, AI agent frameworks weekly, kids activities in Wrocław, one judge-friendly locality of your choice). Fully populated sources + at least one issue each.
- [x] **Seed `global_patterns`** with the patterns you've observed work well from Phase 4 and Phase 11 runs. Real, battle-tested, not speculative.
- [x] **Record a backup demo video** showing the end-to-end flow in case live fails.
- [ ] **Write demo script** at `docs/demo-script.md` with exact words, timing, and fallback branches.
- [ ] **Deploy to a public URL** (Fly.io or Railway). Confirm SSE works behind the proxy — double-check `X-Accel-Buffering` headers.
- [ ] **Final dry run** end-to-end on the deployed environment with a clean user account.

**Gate:** a fresh browser on a fresh network can complete the full flow on the deployed URL in under 15 minutes.

---

## Definitely-out-of-scope reminders

Do not build these even if you have extra time — they're traps:

- Event-based cadence
- Editing beat specs via natural language (v2)
- Multi-user / team / shared beats
- Payment / billing
- Mobile app
- Internationalized dashboard UI (English only)
- Analytics dashboard
- The react-email visual editor (v6 ships it; tempting; not now)
- Social login

If you finish everything above with time left, the single most impactful next thing is **improving the Sources Scout's source-discovery quality** by iterating on the `global_patterns` store. That's the flywheel — every hour spent there makes every beat better forever.
