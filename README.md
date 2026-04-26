# Personal Beats

**A personal newsroom-of-one. You describe a beat in one sentence. An editorial agent designs the spec, scouts the sources, drafts the issue, and emails it on a schedule.**

> *Tell us what you care about, how often, and how deep. We'll be your personal newsroom.*

Live: <https://pb.lemonode.pl>

Submission for the [Built with Opus 4.7: a Claude Code hackathon](https://cerebralvalley.ai/events/~/e/built-with-4-7-hackathon).

---

## Why this exists

Newsletters are written for an imaginary average reader. Personalized news apps optimize for engagement, not usefulness. They cannot take a brief like *"kids activities in Wrocław on weekends, in English"* or *"Iran–Israel situation, daily, with primary sources"*. Local journalism has collapsed in most places, and niche beats never existed at all for most topic/place pairs.

Claude Managed Agents removes the hard parts: long-running reasoning, real code execution, web access, persistent memory across runs. That makes a per-user, per-beat editorial agent plausible for the first time.

---

## The core unit: a "beat"

A beat is:

- a **topic** (fuzzy: *"kids activities", "Iran war", "AI agent frameworks", "Wrocław news"*)
- an optional **geography** (city, region, country, global)
- a **cadence** (cron schedule or on-demand)
- a **depth** (brief / standard / deep)
- an **output language** (ISO code)
- **learned relevance rules** that sharpen each issue

Each beat produces its own newsletter, delivered by email.

---

## How it works

```
┌──────────────────────────────────────────────────────────────────┐
│                         WASP APPLICATION                         │
│  Frontend (React 19)      Backend (Node)        Jobs (pg-boss)   │
│  • Landing + dashboard    • Auth (email+pw)     • scheduleSweeper│
│  • Beat creation chat     • Beats CRUD          • driveAgent     │
│  • Issue viewer           • Brief chat          • generateIssue  │
│  • Live transcript poll   • Issue orchestrator  • Mailgun email  │
│                                                                  │
│  Postgres: User · Beat · Issue · IssueItem · AgentEvent ·        │
│            AgentMessage                                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │   Anthropic SDK (REST)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    CLAUDE MANAGED AGENTS                         │
│                                                                  │
│  Beat Designer  (Sonnet 4.6) — brief → spec.yaml + relevance.md  │
│  Sources Scout  (Sonnet 4.6) → sources.yaml (10–25 ranked URLs)  │
│  Editor         (Opus 4.7)   → issue HTML + plaintext            │
│                                                                  │
│  Environment: python3.12, node20, feedparser, beautifulsoup4,    │
│               requests, dateparser, playwright (optional)        │
│                                                                  │
│  Memory stores per beat (research preview):                      │
│    • <beat>_spec       — spec.yaml, relevance.md, sources.yaml   │
│    • <beat>_history    — published items, dedup fingerprints     │
│    • global_patterns   — recipes + cross-beat learnings (RO)     │
└──────────────────────────────────────────────────────────────────┘
```

**Division of responsibility.** Wasp owns auth, product data, scheduling, frontend, email. Claude Managed Agents owns everything editorial: spec generation, source discovery, news gathering, relevance filtering, drafting. State that must persist across runs lives in memory stores; state shown in the UI lives in Postgres.

### Job pipeline

- `scheduleSweeperJob` — cron `* * * * *`. Fans out `generateIssueJob` to any active `TIME_BASED` beat whose cron is due (compared against `Beat.lastScheduledAt`).
- `driveAgentJob` — bounded-poll driver for the active CMA session. Drains pending user messages, lists new events from `client.beta.sessions.events.list`, persists them to `AgentEvent`, runs tool handlers, returns a verdict (`reenqueue` / `waiting_for_user` / `phase_done` / `failed`). pg-boss `singletonKey` enforces one driver per beat.
- `generateIssueJob` — orchestrates the SCOUT → EDITOR transition, writes the `Issue` row, dispatches the email via Mailgun.

### The clarification gate

The Beat Designer has a `needs_clarification` custom tool. The system prompt instructs it to lean toward proceeding — clarifications are reserved for dimensions where two reasonable answers would produce substantially different newsletters (e.g. *"kids stuff in Wrocław"* → ask the age range; *"Wrocław news daily"* → just ship it). Visible reasoning, max two questions, no open-ended *"tell me more"*.

### Per-agent model rationale

| Agent | Model | Why |
|---|---|---|
| Editor | `claude-opus-4-7` | Newsletter quality is the user-visible product. Editor synthesizes from many sources, applies relevance rules, writes the final issue. Highest-stakes intelligence work in the system. |
| Beat Designer | `claude-sonnet-4-6` | Structured brief → spec transformation. Sonnet's speed/intelligence tradeoff fits. |
| Sources Scout | `claude-sonnet-4-6` | Web-search heavy, latency-sensitive. Sonnet again. |

---

## Stack

- **Framework:** [Wasp](https://wasp.sh) 0.23 (React + Node + Prisma)
- **Frontend:** React 19, Tailwind CSS 4, Radix UI, Lingui (i18n), react-router 7
- **Backend:** Node 20, pg-boss for jobs, Postgres 15
- **Email:** Mailgun (provider) + react-email 6 (templates)
- **Agents:** [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) talking to the Managed Agents beta (`anthropic-beta: managed-agents-2026-04-01`)
- **Auth:** Wasp email + password
- **Demo video:** HyperFrames composition tree under `tools/demo-video/`

---

## Repository layout

```
.
├── main.wasp                 # routes, pages, auth, queries, actions, jobs
├── schema.prisma             # User · Beat · Issue · IssueItem · AgentEvent · AgentMessage
├── src/
│   ├── pages/                # LandingPage, DashboardPage, NewBeatPage, BeatDetailPage, IssueDetailPage
│   ├── server/
│   │   ├── actions.ts        # createBeat, submitClarification, triggerOnDemandRun, …
│   │   ├── queries.ts        # getBeats, getIssue, getAgentEvents, …
│   │   ├── brief-chat.ts     # streaming brief chat (Anthropic SDK direct)
│   │   ├── jobs/             # scheduleSweeper, driveAgent, generateIssue
│   │   ├── agents/           # client.ts, definitions.ts, drive.ts (the CMA driver)
│   │   └── email/            # react-email templates + Mailgun dispatch
│   ├── components/           # ShadCN + bespoke editorial components
│   ├── auth/                 # email-and-pass flows
│   └── locales/              # Lingui catalogues (en + pl)
├── scripts/
│   ├── provision-agents.ts   # one-time CMA provisioning (env, agents, global memory)
│   ├── e2e-smoke.ts          # smoke test against the live API
│   └── seeds/                # global_patterns seed docs (recipes, language hints)
├── tools/demo-video/         # HyperFrames composition for the hackathon demo MP4
├── PRD.md, PRD_wasp.md, PRD_cma.md, PLAN.md, DESIGN.md
```

---

## Getting started

### Prerequisites

- Node.js 20+
- [Wasp CLI](https://wasp.sh) ≥ 0.23
- Postgres 15+ (Wasp can run one for you in dev)
- Anthropic API key with **research-preview access** (multi-agent + memory)
- Mailgun account (or swap in another `emailSender` provider in `main.wasp`)

### 1. Install + database

```bash
wasp db migrate-dev --name init
```

### 2. Environment

Copy `.env.server.example` → `.env.server` and fill in:

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Managed Agents API |
| `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` | email dispatch |
| `JWT_SECRET` | Wasp session signing |
| `APP_BASE_URL` | e.g. `http://localhost:3000` |

The provisioning script (next step) writes the agent IDs and memory store IDs back to `.env.server` for you.

### 3. Provision the Managed Agents

```bash
npx tsx scripts/provision-agents.ts
```

This is idempotent. It creates one shared environment, one global memory store (seeded with recipes + language hints from `scripts/seeds/`), and the three agents. Pass `--force` to re-create. IDs land in `.env.server`:

```
ENVIRONMENT_ID=...
GLOBAL_PATTERNS_STORE_ID=...
BEAT_DESIGNER_AGENT_ID=...
SOURCES_SCOUT_AGENT_ID=...
EDITOR_AGENT_ID=...
```

### 4. Run

```bash
wasp start
```

Opens at `http://localhost:3000`. Sign up, click "Begin a beat", describe one in plain English, and watch the Designer transcript in real time. Trigger an on-demand run from the beat detail page; the issue lands in your inbox.

---

## Demo

- **85 s canonical demo video:** `public/demo/personal-beats-demo.mp4`
- **60 s LinkedIn cut:** `public/demo/linkedin-60.mp4`
- **10 s landing loop:** `public/demo/landing-loop.mp4`

Source: `tools/demo-video/` — HyperFrames compositions, GSAP animation, the same `App.css` that ships in production. See `tools/demo-video/README.md`.

---

## Documents

- `PRD.md` — product brief
- `PRD_wasp.md` — Wasp-side spec
- `PRD_cma.md` — Managed Agents spec (system prompts, tool schemas, memory layout)
- `PLAN.md` — execution plan, phase by phase
- `DESIGN.md` — editorial design system

---

## License

MIT — see `LICENSE`.
