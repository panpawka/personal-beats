# Personal Newsroom Agent — PRD

**Status:** Hackathon build
**Owner:** Pawel
**Reference:** `PRD_wasp.md` (frontend/backend/db/jobs/email), `PRD_cma.md` (agentic core), `PLAN.md` (execution order)

---

## 1. Problem

Most newsletters are written for an imaginary average reader. Personalized news apps optimize for engagement, not usefulness — they can't take a genuinely specific brief like "kids activities in Wrocław on weekends, in English" or "Iran-Israel situation, daily, with primary sources." Local journalism has collapsed in most of the world, and niche beats have never existed at all for most topics and places.

Claude Managed Agents removes the hard parts: long-running reasoning, real code execution, web access, and persistent memory across runs. That makes it possible — for the first time — to generate a newsroom-of-one per user, per beat, on a schedule.

**Tagline:** *Tell us what you care about, how often, and how deep. We'll be your personal newsroom.*

---

## 2. The core unit: the "beat"

The fundamental user-facing concept is a **beat**. A beat is:

- A **topic** (fuzzy: "kids activities", "Iran war", "AI agent frameworks", "Wrocław news")
- An optional **geography** (city, region, country, or global)
- A **cadence** (time-based recurring OR on-demand)
- A **depth** (brief / standard / deep)
- An **output language** (ISO code)
- **Learned relevance rules** that sharpen with every piece of user feedback

A user can have multiple beats. Each beat produces its own newsletter, delivered by email on schedule.

---

## 3. User stories (MVP)

1. As a user, I sign up, log in, and see a dashboard of my beats.
2. I click "Create a new beat" and describe in natural language what I want.
3. The Beat Designer either (a) creates the beat directly if the brief is clear, or (b) asks me 1-2 clarifying questions first.
4. Once the beat is created, I can trigger an on-demand run or let it run on its schedule.
5. I receive the newsletter by email (SendGrid, polished HTML via react-email).
6. I can view all past issues of a beat in the dashboard.
7. I can thumbs-up or thumbs-down individual items in a past issue (or directly from the email via magic-link). This updates the beat's learned relevance rules, so the next issue is sharper.
8. I can pause, resume, or delete a beat.

---

## 4. Architecture overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         WASP APPLICATION                         │
│                                                                  │
│  Frontend (React)         Backend (Node)         Jobs (pg-boss)  │
│  • Dashboard              • Auth (email+pw)      • Scheduled     │
│  • Beat creation UI       • Beats CRUD             issue runs    │
│  • Issue viewer           • Issue orchestrator   • Daily feedback│
│  • Feedback controls      • Resend/SendGrid        learning      │
│  • SSE consumer           • SSE endpoint                         │
│                                                                  │
│  PostgreSQL: users, beats, issues, items, feedback               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │  REST + SSE (managed-agents API)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CLAUDE MANAGED AGENTS                         │
│                                                                  │
│  Coordinator Agent ─┬─► Beat Designer (sub-agent)                │
│   (Haiku 4.5)       ├─► Sources Scout (sub-agent)                │
│                     └─► Editor (sub-agent)                       │
│                         (all Sonnet 4.7)                         │
│                                                                  │
│  Environment: python3.12, node20, playwright, feedparser,        │
│               beautifulsoup4, requests, dateparser               │
│                                                                  │
│  Memory stores (per beat + one global):                          │
│    • <beat>_spec      (read_write)  spec, sources, rules         │
│    • <beat>_history   (read_write)  published items, dedup       │
│    • global_patterns  (read_only)   cross-beat learnings         │
└──────────────────────────────────────────────────────────────────┘
```

**Division of responsibility:**

- **Wasp owns:** auth, user data, the beat/issue database, scheduling (Wasp jobs), email delivery, frontend UX. Wasp is deliberately "dumb" about agent internals — it kicks off sessions, consumes events, and persists outputs.
- **Managed Agents owns:** everything editorial. Spec generation, source discovery, news gathering, relevance filtering, drafting, learned-rules updates. All state that must persist across runs lives in memory stores.

This split matters: Wasp's DB is "product data" (what we show in the UI). Memory stores are "agent brain" (what the agent reasons over). They're deliberately separate.

---

## 5. Locked design decisions

These are settled. Do not revisit during the hackathon.

| Decision | Value |
|---|---|
| Stack | Wasp + Claude Managed Agents + react-email 6 + SendGrid + Postgres |
| Coordinator model | `claude-haiku-4-5-20251001` (dispatch only, cheap + fast) |
| Sub-agent model | `claude-sonnet-4-7` (editorial judgment) |
| Multi-agent | Research preview, one level of delegation |
| Memory | Research preview, 2 stores per beat + 1 global, well under 8-store limit |
| Cadences | `time_based` (cron) or `on_demand` only. **No event-based.** |
| Depths | `brief` / `standard` / `deep` |
| Email | react-email 6 in-body HTML, per-depth layouts, plain-text fallback |
| Feedback | Magic-link buttons embedded in emails (signed JWT tokens) |
| Streaming | SSE via Wasp `api` declaration for beat creation; polling for issue runs |
| Clarification | Beat Designer runs silent gate; asks max 2 questions, only for critically ambiguous dimensions |

---

## 6. Explicit non-goals (MVP)

Building any of these is a hackathon-killer. Defer all of them:

- Event-based cadence ("publish only when something happens")
- Editing beat specs via natural language after creation
- Multi-user / team / shared beats
- Payment, billing, subscription tiers
- Mobile app
- Internationalized dashboard UI (English-only; newsletters themselves can be any language)
- Analytics beyond issue count
- Social login
- The react-email v6 embedded visual editor (interesting v2 feature)

---

## 7. Success criteria for the demo

1. **A judge's hometown works live.** Cold-start a beat for a locality nobody on the team has tested. Newsletter arrives in 15 minutes and the judge can fact-check it.
2. **The clarification gate is visibly intelligent.** Show at least one case where the Beat Designer does NOT ask (good brief) and one where it does (ambiguous brief). This is the moment that differentiates this product from "GPT wrapper."
3. **The feedback loop is visibly real.** Thumbs-down an item in a pre-warmed beat. Show the diff in `/relevance.md`. Re-run. Next issue respects it.
4. **Three very different beats work.** Locality, topical-global, and a crossed beat ("kids activities in Wrocław in English") — proves personalization is real, not faked.

---

## 8. Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Clarification session may time out during idle wait | Smoke test day one (Phase 0). Fallback: write partial spec to memory, resume in a fresh session. |
| SSE buffered by reverse proxy | Explicit `X-Accel-Buffering: no`, `Cache-Control: no-cache`, 15s heartbeats. Verified in Phase 0 and again in Phase 13 deploy. |
| Sources Scout finds nothing for obscure locality | "Thin coverage" graceful path — publish what we have with an editor's note. Never pad. |
| Agent hallucinates facts | System prompts mandate primary-source verification. "If you cannot verify, either drop it or explicitly flag as unconfirmed and include only at depth=deep." |
| Cold-start 10+ min may feel slow to judges | Acknowledged and accepted. Pre-warm 3-4 demo beats for backup. Narrate the bootstrap live — it's part of the show, not a flaw. |
| Live demo fails | Record backup video during Phase 13. |

---

## 9. Open questions still to answer during build

(These are not architecture-level open questions — those are all closed. These are implementation-level things worth checking mid-build.)

- Exact ergonomics for the clarification reply UI (inline vs modal vs dedicated page).
- Whether to allow a user to edit the clarification questions before they're presented (probably no for MVP).
- Whether feedback thumbs-down should trigger an immediate relevance update or batch daily (currently: batch daily via `applyFeedbackJob`).
- Minimum source count before we refuse to activate a beat (currently: Scout reports `sparse` and we activate anyway with a warning).

---

## 10. Where to go next

- `PLAN.md` for the ordered build checklist
- `PRD_wasp.md` for the Wasp-side implementation spec
- `PRD_cma.md` for the Claude Managed Agents implementation spec
