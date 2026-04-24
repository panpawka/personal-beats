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
- [ ] **Smoke test — clarification session lifespan.** Create a session, send a user event, wait 5 minutes idle, send a follow-up user event. Confirm the session accepts it without error and the agent continues from where it was. Document the observed behavior in `smoke-tests/clarification-lifespan.md`.
- [ ] **Smoke test — SSE through local dev.** Stand up a trivial Wasp `api` endpoint that streams 10 events over 30 seconds. Consume it from a fetch-based client. Confirm events arrive in real time, not buffered. See `PRD_wasp.md` §6.
- [ ] **Smoke test — memory store lifecycle.** Create a store, write a document, attach it to a session, have the agent read it, then modify it via the API. Confirm version history is created for each mutation. See `PRD_cma.md` §4.
- [ ] **Document fallback** in `smoke-tests/` for each test that failed, if any, with the chosen workaround.

**Gate:** all smoke tests pass or have a documented fallback. Do not proceed otherwise.

---

## Phase 1 — Repository and environment setup

- [x] **Initialize Wasp project.** `wasp new newsroom` (or similar). Commit the skeleton.
- [x] **Configure env vars** in `.env.server`: `ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`, `DATABASE_URL`, `JWT_SECRET` (for magic-link feedback tokens).
- [ ] **Install dependencies.** At minimum: `@anthropic-ai/sdk`, `react-email`, `@sendgrid/mail`, `zod`, `jsonwebtoken`. Versions per `PRD_wasp.md` §2.
- [ ] **Set up Postgres.** Via Wasp's built-in Prisma integration. Run `wasp db migrate-dev` on an empty schema to confirm it works.
- [ ] **Create `main.wasp` app declaration** with auth (email + password), title, head, dependencies. See `PRD_wasp.md` §3.
- [ ] **Verify `wasp start`** launches cleanly with an empty home page.

**Gate:** `wasp start` runs, the landing page loads, a user can sign up and log in.

---

## Phase 2 — Database schema

- [ ] **Define Prisma models** per `PRD_wasp.md` §4: `User` (extend Wasp auth), `Beat`, `Issue`, `IssueItem`.
- [ ] **Run `wasp db migrate-dev`** and confirm all tables exist.
- [ ] **Write a seed script** at `scripts/seed-dev.ts` that creates one test user + one pre-warmed beat record (no memory stores yet). Makes manual testing easier.

**Gate:** Prisma Studio shows all tables, seed script runs cleanly.

---

## Phase 3 — Provision the four Managed Agents

This is a one-time provisioning step, run as a script. Agent IDs are persisted to `.env.server` so the app can reference them.

- [ ] **Create `scripts/provision-agents.ts`.** See `PRD_cma.md` §3 for full agent-creation payloads.
- [ ] **Provision the Beat Designer agent.** Persist `BEAT_DESIGNER_AGENT_ID` and `BEAT_DESIGNER_VERSION`.
- [ ] **Provision the Sources Scout agent.** Persist `SOURCES_SCOUT_AGENT_ID` and `SOURCES_SCOUT_VERSION`.
- [ ] **Provision the Editor agent.** Persist `EDITOR_AGENT_ID` and `EDITOR_VERSION`.
- [ ] **Provision the Coordinator agent** with `callable_agents` referencing the three above. Persist `COORDINATOR_AGENT_ID` and `COORDINATOR_VERSION`.
- [ ] **Create the shared environment** (container template) once. Persist `ENVIRONMENT_ID`. See `PRD_cma.md` §2.
- [ ] **Create the global patterns memory store** once. Persist `GLOBAL_PATTERNS_STORE_ID`. Seed with 2-3 starter files in `/source_discovery/` and `/language_hints/`. See `PRD_cma.md` §4.
- [ ] **Verify all agent IDs resolve** via a list call.

**Gate:** all five IDs (4 agents + 1 environment + 1 global store) are in `.env.server` and resolve correctly via the API.

---

## Phase 4 — End-to-end happy path (no UI, no email)

Prove the plumbing with a hardcoded beat brief. Console output is fine. Do not build UI yet.

- [ ] **Write `scripts/e2e-smoke.ts`** that:
  - Creates a per-beat spec memory store + history store.
  - Starts a Coordinator session with all three stores attached.
  - Sends a `design_beat` user event with a hardcoded brief: *"Daily news for Wrocław, Poland"*.
  - Streams events and logs each one.
  - Waits for the `finalize_beat_spec` and `scout_complete` custom-tool calls.
  - Starts a second Coordinator session with `generate_issue` for the same beat.
  - Waits for `publish_issue` and prints the resulting JSON.
- [ ] **Run the script.** Beat creation should take ~10-15 min, issue generation ~8-15 min.
- [ ] **Inspect the memory stores** via the API — confirm `/spec.yaml`, `/sources.yaml`, `/relevance.md`, `/issues/<date>.md`, and `/fingerprints.jsonl` all exist and are well-formed.
- [ ] **Verify the `publish_issue` JSON** matches the schema in `PRD_cma.md` §3.3.

**Gate:** one full beat creation + one issue generation complete end-to-end via the script, producing valid output. Do not proceed to UI work until this is solid.

---

## Phase 5 — Session orchestrator (server-side)

Turn the throwaway script into the real server-side orchestrator that Wasp operations will call.

- [ ] **Implement `src/server/agents/orchestrator.ts`** with these exported functions:
  - `createBeatSession(beatId)` — provisions memory stores, starts coordinator session, sends `design_beat`, returns session ID + SSE-compatible event iterator.
  - `resumeBeatSession(sessionId, clarificationReply)` — sends a follow-up user event to a waiting session.
  - `generateIssueSession(beatId)` — starts a session, sends `generate_issue`, waits for `publish_issue`, returns the structured JSON.
  - `updateRelevanceSession(beatId, feedback[])` — sends `update_relevance` with batched feedback payload.
- [ ] **Implement custom-tool handlers** for `needs_clarification`, `finalize_beat_spec`, `scout_complete`, `publish_issue`, `update_beat_status`. See `PRD_cma.md` §3.4.
- [ ] **Handle session errors gracefully.** Any non-recoverable error flips the beat status to `FAILED` with a human-readable error message.
- [ ] **Write unit-ish tests** for JSON schema validation of each custom-tool payload (Zod schemas).

**Gate:** calling each orchestrator function from a REPL or test script produces the correct DB state mutations and memory changes.

---

## Phase 6 — Wasp operations layer

Expose the orchestrator to the frontend via Wasp actions and queries.

- [ ] **Define queries** in `.wasp`: `getBeats`, `getBeat`, `getIssuesForBeat`, `getIssue`. See `PRD_wasp.md` §5.1.
- [ ] **Define actions** in `.wasp`: `createBeat`, `submitClarification`, `pauseBeat`, `resumeBeat`, `deleteBeat`, `triggerOnDemandRun`, `submitItemFeedback`. See `PRD_wasp.md` §5.2.
- [ ] **Implement each action** as a thin wrapper around the orchestrator + DB updates.
- [ ] **Wire auth** so all queries/actions require a logged-in user and check `beat.userId === context.user.id`.

**Gate:** from a REST client or Wasp REPL, the full CRUD loop works end-to-end with auth enforced.

---

## Phase 7 — SSE streaming endpoint

Live event streaming during beat creation only. Issue generation uses polling.

- [ ] **Declare `api streamBeatCreation`** in `.wasp` with `auth: true`. See `PRD_wasp.md` §6.
- [ ] **Implement `src/server/streaming.ts`** with:
  - Proper SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`).
  - 15-second heartbeat.
  - Connection close handling.
  - A `sendEvent(event, data)` helper.
- [ ] **Bridge orchestrator events to the SSE stream.** When `createBeatSession` yields events, forward them as SSE `data:` frames.
- [ ] **Verify with curl** (`curl -N http://localhost:3000/api/stream/beat/<id>`) that events arrive in real time.

**Gate:** a curl session against the endpoint shows events streaming live during a beat creation triggered from another terminal.

---

## Phase 8 — react-email templates

- [ ] **Set up `src/emails/` directory** with a `NewsletterEmail.tsx` root component that switches on `spec.depth`.
- [ ] **Build `BriefLayout`, `StandardLayout`, `DeepLayout`.** See `PRD_wasp.md` §7.
- [ ] **Build shared components:** `NewsletterHeader`, `NewsletterFooter`, `Item`, `SourceLink`, `ItemFooter` (with feedback magic-link buttons).
- [ ] **Preview via `email dev`** (react-email CLI). Render one fixture of each depth and visually inspect in the preview server.
- [ ] **Render to HTML and plain text.** Confirm `render(element)` and `render(element, { plainText: true })` both produce valid output.

**Gate:** three fixtures (one per depth) render correctly in the react-email dev preview and their HTML opens cleanly in a browser.

---

## Phase 9 — SendGrid integration

- [ ] **Create `src/server/email/sendgrid.ts`** with a `sendNewsletter(issue, user)` function.
- [ ] **Integrate rendering:** load beat spec, render `<NewsletterEmail spec={spec} issue={issue} />`, call SendGrid with HTML + plain-text fallback.
- [ ] **Pre-compute feedback magic-link tokens** at render time. One signed JWT per `IssueItem`, embedded in the email HTML. See `PRD_wasp.md` §8.
- [ ] **Persist rendered HTML** on the `Issue` row so the dashboard can show exactly what was sent.
- [ ] **Test send** to yourself with a real issue fixture. Inspect in Gmail and one webmail alternative.

**Gate:** a real issue sent to your inbox renders correctly and has working (clickable, authenticated) feedback buttons.

---

## Phase 10 — Feedback magic-link endpoint

- [ ] **Declare `api feedbackMagicLink`** in `.wasp` at `GET /feedback/:token`. Auth is NOT required here — auth is embedded in the signed token.
- [ ] **Implement token verification** (`jsonwebtoken`). Check signature, expiry, and that the `issue_item_id` belongs to the `user_id` in the token.
- [ ] **Record feedback** on the `IssueItem` row.
- [ ] **Redirect** to the dashboard with a toast-able query param (`?feedback=recorded`).
- [ ] **Test with a real email's link** end-to-end.

**Gate:** clicking a thumbs-down in a received email records feedback on the right row and redirects to the dashboard.

---

## Phase 11 — Wasp jobs (scheduling + background work)

- [ ] **Define `generateIssueJob`** in `.wasp` using pg-boss. Accepts `beatId`. Calls `generateIssueSession` then `sendNewsletter`. See `PRD_wasp.md` §9.
- [ ] **Define `applyFeedbackJob`** that runs once daily per beat, batching the last 24h of feedback and calling `updateRelevanceSession`.
- [ ] **Implement cron scheduling:** on beat activation, schedule a recurring job per the beat's cron expression. On pause/delete, cancel it.
- [ ] **Test a manual on-demand run** via the `triggerOnDemandRun` action — confirm it enqueues the job and the job runs to completion.
- [ ] **Test a scheduled run** by setting a beat's cron to `* * * * *` briefly and confirming the job fires.

**Gate:** a beat scheduled for 1 minute from now produces an email in your inbox on time.

---

## Phase 12 — Frontend dashboard

Minimal viable UI. No fancy animations, no dark mode. Functional.

- [ ] **`/` — landing page.** Signed-out users see "Personal newsroom" pitch + sign-up CTA. Signed-in users redirect to `/dashboard`.
- [ ] **`/dashboard` — list of beats.** Empty state → "Create your first beat" CTA. Each beat card shows title, status, cadence, last issue date, quick actions (pause/resume/delete).
- [ ] **`/beats/new` — beat creation flow.** Textarea for brief + submit. On submit, creates the beat and navigates to `/beats/:id` with the SSE stream open.
- [ ] **`/beats/:id` — beat detail page.** Shows spec summary (from DB), list of past issues, on-demand trigger button, pause/resume, delete.
- [ ] **`/beats/:id/issues/:issueId` — past issue viewer.** Reuses the react-email components wrapped in an `<EmailPreview>` container. Feedback buttons also work here.
- [ ] **Clarification UI** within `/beats/:id`: when beat status is `AWAITING_CLARIFICATION`, show the questions with a reply form. On submit, calls `submitClarification` action.

**Gate:** a new user can sign up, create a beat, answer clarifications, see sources populated, trigger an on-demand run, and view past issues — all through the UI with no console work.

---

## Phase 13 — Polish and demo prep

- [ ] **Pre-warm 3-4 demo beats** as backup (Wrocław daily, AI agent frameworks weekly, kids activities in Wrocław, one judge-friendly locality of your choice). Fully populated sources + at least one issue each.
- [ ] **Seed `global_patterns`** with the patterns you've observed work well from Phase 4 and Phase 11 runs. Real, battle-tested, not speculative.
- [ ] **Record a backup demo video** showing the end-to-end flow in case live fails.
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
