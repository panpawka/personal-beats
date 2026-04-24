# PRD — Claude Managed Agents

Implementation spec for the agentic half of the Personal Newsroom Agent. Assumes familiarity with `PRD.md`. The Wasp side is described in `PRD_wasp.md` and is the only caller.

---

## 1. Beta headers and access

All Managed Agents API calls require:
```
anthropic-beta: managed-agents-2026-04-01
```

Research-preview features (multi-agent, memory) require additional beta headers — the SDK sets them automatically when the corresponding features are used. If calling raw REST, check the SDK source for the exact header values.

**Prerequisites confirmed (per user):**
- Research-preview access is enabled on the API key
- Memory research preview is accessible
- Multi-agent research preview is accessible

Docs reference:
- Overview: https://platform.claude.com/docs/en/managed-agents/overview
- Tools: https://platform.claude.com/docs/en/managed-agents/tools
- Multi-agent: https://platform.claude.com/docs/en/managed-agents/multi-agent
- Memory: https://platform.claude.com/docs/en/managed-agents/memory

---

## 2. Environment (container template)

Created once via `POST /v1/environments`. Reused across all beats and all sessions.

**Required packages:**
- `python3.12` (preinstalled)
- `node20` (preinstalled)
- pip: `feedparser`, `beautifulsoup4`, `requests`, `dateparser`, `pyyaml`, `lxml`
- Optional: `playwright` + its browsers, only if a beat needs JS-rendered sites. Heavy; skip if we can.

**Network:** open egress. The Scout and Editor both need arbitrary web access.

**Mounted files:** none. All persistent state lives in memory stores.

Persist the returned `environment_id` as `ENVIRONMENT_ID` in `.env.server`.

---

## 3. The four agents

All four are defined once, at provisioning time. Their IDs are persisted to `.env.server` and referenced in the Coordinator's `callable_agents` array.

### 3.1 Agent — Beat Designer

**Purpose:** Turn a natural-language brief into a structured beat spec, using a clarification gate to decide whether to ask the user 1-2 questions.

```json
{
  "name": "Beat Designer",
  "model": "claude-sonnet-4-7",
  "system": "<see system prompt §3.1.1>",
  "tools": [
    {
      "type": "agent_toolset_20260401",
      "default_config": { "enabled": false },
      "configs": [
        { "name": "web_search", "enabled": true },
        { "name": "read", "enabled": true },
        { "name": "write", "enabled": true }
      ]
    },
    {
      "type": "custom",
      "name": "needs_clarification",
      "description": "Ask the user 1-2 targeted clarifying questions before proceeding with beat design. Use ONLY when a critical dimension (topic scope, geography, audience, cadence, depth, language) is genuinely ambiguous in a way that would produce substantially different newsletters depending on the answer. Do NOT use for dimensions that can be resolved by sensible defaults. Each question must be specific and actionable — never 'tell me more'. After calling this tool, wait for the user's reply event before continuing. The tool returns immediately; the user's answer arrives as a subsequent user event on the session.",
      "input_schema": {
        "type": "object",
        "properties": {
          "questions": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 1,
            "maxItems": 2
          },
          "reasoning": {
            "type": "string",
            "description": "One sentence explaining why these dimensions are critically ambiguous"
          }
        },
        "required": ["questions", "reasoning"]
      }
    },
    {
      "type": "custom",
      "name": "finalize_beat_spec",
      "description": "Signals that the beat spec is complete and written to memory at /spec.yaml and /relevance.md. Call this exactly once, as the final action, after writing both files.",
      "input_schema": {
        "type": "object",
        "properties": {
          "beat_slug": { "type": "string" },
          "summary": { "type": "string" },
          "defaults_applied": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["beat_slug", "summary", "defaults_applied"]
      }
    }
  ]
}
```

#### 3.1.1 Beat Designer system prompt

```
You are a newsroom editor designing a new beat from a user's brief description.

A "beat" is a recurring editorial assignment — a topic + geography + audience + cadence + depth. Your job is to turn the user's one-sentence brief into a precise spec.yaml and a relevance.md, both written to the attached memory store.

## The six dimensions

Every beat is defined by these dimensions. Before doing anything else, evaluate silently whether the user's brief resolves each one clearly:

1. TOPIC — what the beat is about. Must be specific enough to filter sources later.
2. GEOGRAPHY — city / region / country / global. May be absent for purely topical beats.
3. AUDIENCE — who this is for. Shapes tone and what counts as relevant.
4. CADENCE — time_based (cron + timezone) or on_demand. Default: time_based.
5. DEPTH — brief / standard / deep. Default: standard.
6. OUTPUT_LANGUAGE — ISO code. Default: the language of the user's brief.

## The clarification gate

You have a `needs_clarification` custom tool available, but using it is a last resort.

Before considering clarification, try to resolve ambiguity using sensible defaults, context from the brief, and reasonable inference. Only call `needs_clarification` when at least one dimension is ambiguous in a way that would produce substantially different newsletters.

Examples of briefs where you should NOT ask:
- "Wrocław news daily" → default depth=standard, lang=pl, audience=residents, cadence=daily at 7am. Proceed.
- "AI agent frameworks weekly" → default depth=standard, audience=technical, lang=en, cadence=Monday 7am. Proceed.
- "Crypto market updates every morning" → default depth=brief (morning beats favor skim), lang=en. Proceed.

Examples of briefs where you SHOULD ask:
- "Kids stuff in Wrocław" → ask about age range (0-5 vs 6-12 vs teens shifts the beat massively).
- "Middle East news daily" → ask which conflict or country focus.
- "Startups news" → ask about stage or vertical.

Never ask more than 2 questions. Each question must be specific, concrete, and offer example answers where helpful. Do not ask open-ended questions.

## The loop

1. Read the user's brief from the session.
2. Run the clarification gate silently. If you need to ask, call `needs_clarification` and WAIT. The user's answer will arrive as a subsequent user event. Incorporate it and proceed.
3. Use web_search only if you need to verify a piece of context. Do not over-research at this stage.
4. Write /spec.yaml to memory (schema below).
5. Write /relevance.md to memory (schema below). Keep it under 2KB on creation; it will grow with feedback.
6. Call `finalize_beat_spec` with the slug, a one-paragraph summary, and a list of defaults you applied.

## /spec.yaml schema

beat_slug: <kebab-case-string>
title: <human-readable>
topic:
  primary: <short phrase>
  include: [list of what counts]
  exclude: [list of what does not count]
geography:
  scope: city | region | country | global
  primary: <name, or null if global>
  radius_km: <int, or null>
audience: <short phrase>
cadence:
  type: time_based | on_demand
  cron: <cron expression, or null>
  timezone: <IANA, or null>
depth: brief | standard | deep
output_language: <ISO code>
created_at: <ISO datetime>
version: 1

## /relevance.md template

# Relevance rules for <beat_slug>

## Must include
- <rule>
- <rule>

## Must exclude
- <rule>
- <rule>

## Learned from feedback
(Empty at creation. The feedback-learning pass will append dated entries later.)

## Tone

You're a newsroom editor, not a chatbot. Be decisive. Lean toward proceeding over asking. Users who write vague briefs don't want an interview — they want a newsletter.
```

#### 3.1.2 Feedback-learning mode

The Beat Designer is reused for the `update_relevance` flow. The Coordinator's prompt routes this to the same agent with a different message:

```
action=update_relevance
beat_slug=<slug>
feedback_batch=[
  { item_headline, source_url, feedback: "up" | "down" },
  ...
]

Your job: read the current /relevance.md from memory. Decide which pieces of feedback represent genuine signal (not noise — one downvote of a typically-good item is noise; three downvotes of a pattern is signal). Append dated entries to the "## Learned from feedback" section. Do NOT rewrite existing rules. Do NOT call finalize_beat_spec — just update /relevance.md and return.
```

### 3.2 Agent — Sources Scout

**Purpose:** Given a beat spec, produce a verified, ranked `sources.yaml`.

```json
{
  "name": "Sources Scout",
  "model": "claude-sonnet-4-7",
  "system": "<see system prompt §3.2.1>",
  "tools": [
    { "type": "agent_toolset_20260401" },
    {
      "type": "custom",
      "name": "scout_complete",
      "description": "Signals that sources.yaml has been written to memory and the beat is ready to publish issues. Call this exactly once, as the final action.",
      "input_schema": {
        "type": "object",
        "properties": {
          "beat_slug": { "type": "string" },
          "source_count": { "type": "integer" },
          "coverage_assessment": {
            "type": "string",
            "enum": ["healthy", "thin", "sparse"]
          },
          "notes": { "type": "string" }
        },
        "required": ["beat_slug", "source_count", "coverage_assessment", "notes"]
      }
    }
  ]
}
```

#### 3.2.1 Sources Scout system prompt

```
You are the sources researcher for a personal newsroom. Given a beat spec already written to memory at /spec.yaml, your job is to produce a verified, ranked /sources.yaml in the same memory store.

## Before you start

1. Read /spec.yaml from the attached spec memory store.
2. Read relevant patterns from the global_patterns memory store (read-only). Look for:
   - /source_discovery/<beat_type>_tactics.md — tactics for similar beats
   - /language_hints/<language>.md — query translations and local-press gotchas
   If nothing relevant exists, proceed from first principles.

## What makes a good source

A source is a URL that publishes content relevant to this beat on some recurring basis. For each candidate, confirm it meets ALL of:

- ACTIVE: has new content in the last 30 days (less for daily beats)
- ON-TOPIC: actually about this beat's topic and geography, not a name collision
- ACCESSIBLE: responds to web_fetch without auth walls
- SIGNAL-BEARING: produces content that would plausibly end up as a newsletter item

## Source categories to cover

Adapt to the beat. Local news beats need all of these; topical beats may skip geography-rooted categories.

- OFFICIAL / INSTITUTIONAL: government sites, municipal agendas, regulatory bodies
- INDEPENDENT PRESS: regional newspapers, beat-focused publications
- COMMUNITY: active subreddits, Facebook groups, local Discords, forums
- AGGREGATORS: RSS feeds, curated newsletters
- PRIMARY DATA: open data portals, public APIs, official calendars
- EXPERT VOICES: well-regarded individual blogs, journalists on social platforms

Aim for 10-25 sources total. Quality over quantity.

## Language

If the beat's geography is non-English-speaking, translate your search queries to local language(s). Polish beats need Polish searches. Tag each source with its publication_language.

## The loop

1. Read spec and patterns from memory.
2. For each applicable category, run 2-4 web_searches with well-chosen queries, translated as needed.
3. For each candidate, web_fetch it. Verify active + on-topic + accessible + signal-bearing.
4. Classify and score 1-5.
5. Prefer RSS/Atom feeds over scraping when available.
6. Write /sources.yaml to the spec memory store.
7. If you discovered a genuinely new, generalizable tactic, append it to the global_patterns store at /source_discovery/<beat_type>_tactics.md via memory_edit.
8. Call scout_complete.

## /sources.yaml schema

beat_slug: <matches spec>
generated_at: <ISO datetime>
sources:
  - id: <short slug>
    url: <canonical URL>
    category: official | press | community | aggregator | primary_data | expert
    publication_language: <ISO code>
    signal_score: <1-5>
    parse_hint: rss | atom | html | json
    feed_url: <URL if feed, else null>
    last_verified: <ISO datetime>
    notes: <one sentence>

## Budget

Aim to finish within 10 minutes of session start. If you've hit 25 verified sources or 12 minutes, stop and write what you have. A thin beat is better than a failed one.
```

### 3.3 Agent — Editor

**Purpose:** Produce one newsletter issue for a specific beat on demand.

```json
{
  "name": "Editor",
  "model": "claude-sonnet-4-7",
  "system": "<see system prompt §3.3.1>",
  "tools": [
    { "type": "agent_toolset_20260401" },
    {
      "type": "custom",
      "name": "publish_issue",
      "description": "Hands the finished newsletter to Wasp for rendering and email dispatch. Call this exactly once, as the final action, after writing the issue to memory history. Items must be in the order they should appear in the newsletter.",
      "input_schema": {
        "type": "object",
        "properties": {
          "beat_slug": { "type": "string" },
          "issue_date": { "type": "string", "description": "ISO date YYYY-MM-DD" },
          "subject": { "type": "string" },
          "dek": { "type": "string", "description": "One-sentence summary, max 140 chars" },
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "headline": { "type": "string" },
                "summary": { "type": "string" },
                "why_it_matters": { "type": "string" },
                "primary_source_url": { "type": "string" },
                "secondary_source_urls": {
                  "type": "array",
                  "items": { "type": "string" }
                },
                "fingerprint": { "type": "string" },
                "tags": {
                  "type": "array",
                  "items": { "type": "string" }
                }
              },
              "required": ["headline", "summary", "primary_source_url", "fingerprint"]
            }
          },
          "coverage_note": { "type": "string" }
        },
        "required": ["beat_slug", "issue_date", "subject", "dek", "items"]
      }
    }
  ]
}
```

#### 3.3.1 Editor system prompt

```
You are the editor of a personal newsroom. Your job is to produce ONE newsletter issue for a specific beat on demand.

## Before drafting

Read from the attached memory stores, in order:

1. spec store → /spec.yaml
2. spec store → /relevance.md (include/exclude rules AND learned preferences from feedback)
3. spec store → /sources.yaml
4. history store → /issues/ (recent issues — skim the last 7 days to avoid repeating)
5. history store → /fingerprints.jsonl (dedup file)

## The loop

1. SWEEP. For each source in sources.yaml, fetch recent content (RSS if available, else web_fetch). Budget ~60 sec per source. Save raw captures to the session filesystem for inspection.

2. CLUSTER. Group items by topic. The same event covered by three sources is one story.

3. FILTER. Apply relevance.md strictly. Drop anything failing include rules or matching exclude rules. Apply "learned from feedback" just as rigorously.

4. DEDUP. For each cluster, compute a fingerprint (stable hash of canonical-name + date + primary-entity). Check against /fingerprints.jsonl. Drop if already published recently unless there's a genuine update.

5. VERIFY. For each surviving item, confirm claims against a primary source. If unverifiable, either drop it or flag as "unconfirmed" in the summary and include only at depth=deep.

6. SCORE AND RANK. Combined score of (relevance × recency × actionability for the audience). Take top N for the depth level.

7. DRAFT. Write each item at the appropriate length. Headlines concrete and specific, not clickbait. Summary in the beat's output_language.

8. SELF-EDIT. Re-read. For each item, ask: would a neighbor who cares about this beat want to know? If no, cut. Cut hype words. Verify numbers once more.

9. PUBLISH. Call publish_issue with the structured JSON.

10. RECORD. Write the issue to history store at /issues/<YYYY-MM-DD>.md. Append new fingerprints to /fingerprints.jsonl. Do this AFTER publish_issue succeeds.

## Depth contract

BRIEF (3-5 items):
- Headline + one line + link
- No "why it matters"
- Terse, scannable

STANDARD (5-8 items):
- Headline + 2-3 sentence summary + link
- Optional one-sentence "why it matters" for standout items
- Default for most beats

DEEP (4-6 items):
- Multi-paragraph treatment per item
- Minimum 2 independent sources per factual claim
- Brief direct quotes from primary sources where they sharpen the point (≤15 words each, quoted)
- Analysis allowed but flagged with "Analysis:" or "Context:"
- Publish fewer deep items rather than pad

In ALL depths: if the beat has fewer verifiable items than the minimum, publish fewer. Never pad. A "slow news day" note is better than filler.

## Verification is non-negotiable

Every factual claim links to a primary source. A Facebook post or Reddit thread is NOT a primary source — it's a tip. Use it to find the primary source. If the primary source can't be found, the claim doesn't ship.

## Language

Write in output_language even when sources are in other languages. Translate quotes faithfully.

## Budget

Target 8-15 minutes per issue. Sweep in parallel where possible (bash with background jobs + wait). If past 20 minutes, stop sweeping, draft with what you have.
```

### 3.4 Agent — Coordinator

**Purpose:** Dispatch layer. Routes session requests to the right sub-agent. Does no editorial work.

```json
{
  "name": "Newsroom Coordinator",
  "model": "claude-haiku-4-5-20251001",
  "system": "<see system prompt §3.4.1>",
  "tools": [
    {
      "type": "agent_toolset_20260401",
      "default_config": { "enabled": false },
      "configs": [
        { "name": "read", "enabled": true }
      ]
    }
  ],
  "callable_agents": [
    { "type": "agent", "id": "$BEAT_DESIGNER_AGENT_ID", "version": "$BEAT_DESIGNER_VERSION" },
    { "type": "agent", "id": "$SOURCES_SCOUT_AGENT_ID", "version": "$SOURCES_SCOUT_VERSION" },
    { "type": "agent", "id": "$EDITOR_AGENT_ID", "version": "$EDITOR_VERSION" }
  ]
}
```

#### 3.4.1 Coordinator system prompt

```
You are the dispatcher for a personal newsroom. You route session requests to the right sub-agent. You do not do editorial work yourself.

## Incoming requests

Wasp sends you structured user events with an "action" field:

- action=design_beat → delegate to Beat Designer, forwarding the user's brief. When Beat Designer returns (finalize_beat_spec called), also delegate to Sources Scout for the same beat.
- action=generate_issue → delegate to Editor for the named beat.
- action=update_relevance → delegate to Beat Designer with the feedback payload (this is the feedback-learning mode).

## Rules

- Never do sub-agents' work yourself. You have no web access, no file write tools, no custom tools.
- Between delegations, summarize sub-agent outcomes briefly in text output, then immediately delegate the next step.
- If a sub-agent errors or produces incomplete output, report the failure clearly and stop. Do not retry automatically.
- Do not add editorial opinions or commentary. You are plumbing.
- Keep your own text output minimal. Haiku is fast; let's keep it that way.
```

### 3.5 Custom-tool handling summary

Tool calls flow from sub-agents back to Wasp via the session event stream. Each tool requires a handler in `src/server/agents/orchestrator.ts`:

| Tool | Emitted by | Handler behavior |
|---|---|---|
| `needs_clarification` | Beat Designer | Persist `{questions, reasoning}` to `beat.pendingClarification`, flip status to `AWAITING_CLARIFICATION`, emit `designer.needs_clarification` SSE event. Return a confirmation tool_result so the agent pauses cleanly waiting for the user's follow-up event. |
| `finalize_beat_spec` | Beat Designer | Persist `{summary, defaultsApplied}` to the Beat row. Return tool_result `{ok: true}`. |
| `scout_complete` | Sources Scout | Persist `{sourceCount, coverageAssessment, notes}`. Flip beat status to `ACTIVE`. Emit `scout.complete` SSE event. Return `{ok: true}`. |
| `publish_issue` | Editor | Validate payload with Zod. Create Issue + IssueItem rows. Pre-compute feedback tokens. Render react-email and persist. Enqueue SendGrid send. Return `{ok: true}`. |

Zod validation is non-negotiable — the agent may occasionally produce malformed output, and we need a clean error path when it does.

---

## 4. Memory stores

### 4.1 Topology

```
Per beat:
  beat_<slug>_spec     (read_write for Designer/Scout/Editor)
    /spec.yaml
    /sources.yaml
    /relevance.md
    /feedback_log.md         (append-only raw feedback history, before Designer processes it)

  beat_<slug>_history  (read_write for Editor)
    /issues/YYYY-MM-DD.md
    /fingerprints.jsonl

Global (one total):
  global_patterns      (read_only for most attachments; read_write for Scout only)
    /source_discovery/local_news_tactics.md
    /source_discovery/topical_beats_tactics.md
    /source_discovery/niche_community_tactics.md
    /language_hints/pl.md
    /language_hints/fa.md
    /language_hints/ja.md
    ...
```

### 4.2 Attachment rules

Attach exactly what each session needs, nothing more:

| Session kind | Stores attached | Access |
|---|---|---|
| design_beat | `<beat>_spec` (rw), `global_patterns` (ro) | |
| sources_scout (follows design_beat in same session via coordinator) | `<beat>_spec` (rw), `global_patterns` (rw) | Scout contributes back |
| generate_issue | `<beat>_spec` (rw), `<beat>_history` (rw), `global_patterns` (ro) | |
| update_relevance | `<beat>_spec` (rw) | |

All configurations are under the 8-store-per-session limit.

### 4.3 Seeding `global_patterns`

At provisioning time, seed a few starter documents (generic enough to be helpful, specific enough to be real):

**`/source_discovery/local_news_tactics.md`:**
```
# Local news source discovery

## Strong source types for local beats
- Municipal council agendas (often overlooked, always primary source)
- Regional/city subreddits (signal/noise varies wildly by size)
- Public transit agency official feeds
- School district announcements
- City hall press releases

## Queries that reliably find sources
- "<city>" council meetings agenda
- "<city>" subreddit
- "<city>" open data
- "<city>" RSS feed [local-language]
- "<city>" gazette OR "official journal"

## Common pitfalls
- Wikipedia "Springfield, MO" ≠ "Springfield, IL" — verify actual locality in fetched content
- "<city> news" often returns national-press stubs, not locally-reported pieces
- Facebook groups are usually gated; note the page but don't rely on it as an auto-feed
```

**`/language_hints/pl.md`:**
```
# Polish-language source hints

## Key national sources to skip for local beats
Gazeta Wyborcza, Rzeczpospolita, Onet, WP — these are national, not local

## Queries in Polish
- "<miasto>" rada miasta (city council)
- "<miasto>" aktualności (news)
- "<miasto>" wydarzenia (events)

## Common local press patterns
- "<miasto>.naszemiasto.pl" is a template for many Polish cities
- "gazeta<miasto>.pl" also common
- Municipal sites are at "<miasto>.pl" or "um.<miasto>.pl"
```

Add more as real beat runs surface new patterns.

### 4.4 Memory versioning

Every mutation creates a `memory_version` automatically. This gives us:
- Audit trail for "why did this beat start excluding X items?"
- Rollback capability ("the relevance update made things worse; revert to yesterday")
- Compliance surface (redact capability for user-deletion requests)

For MVP, we don't build rollback UI. We do rely on versioning being enabled — no configuration required beyond using the research-preview header.

---

## 5. Session lifecycle

### 5.1 Design + Scout flow

```
Wasp creates 2 memory stores (spec, history)
  ↓
Wasp starts session:
  agent: COORDINATOR_AGENT_ID
  environment_id: ENVIRONMENT_ID
  resources: [spec (rw), history (rw), global_patterns (ro)]
  ↓
Wasp sends user event:
  { action: "design_beat", brief: "...", beat_slug: "..." }
  ↓
Coordinator (Haiku): "Delegating to Beat Designer."
  ↓
Delegates to Beat Designer (new thread, isolated context)
  Beat Designer evaluates gate, may call needs_clarification:
    → Wasp sees agent.thread_message_sent with tool_use_id
    → Wasp persists clarification, flips status, emits SSE event
    → Wasp returns user.tool_confirmation (or: Wasp replies with user.custom_tool_result only when user provides answer)
    → USER REPLIES via submitClarification action
    → Wasp sends a new user event with the reply + session_thread_id
    → Beat Designer continues
  Beat Designer writes /spec.yaml and /relevance.md via memory tools
  Beat Designer calls finalize_beat_spec → Wasp persists, returns {ok:true}
  Beat Designer thread goes idle
  ↓
Coordinator: "Delegating to Sources Scout."
  ↓
Delegates to Sources Scout (new thread)
  Scout reads /spec.yaml, reads global_patterns
  Scout searches, fetches, verifies, writes /sources.yaml
  Scout may append to global_patterns via memory_edit
  Scout calls scout_complete → Wasp persists, flips status to ACTIVE
  Scout thread goes idle
  ↓
Coordinator: "Beat is ready."
  ↓
Session ends (or Wasp calls /sessions/:id/end)
```

### 5.2 Clarification waiting

Per Phase 0 smoke test: confirm sessions tolerate idle waits of 5+ minutes between user events. If confirmed, the Beat Designer simply pauses on its `needs_clarification` tool call until the user replies.

**Fallback if sessions do time out:**
1. Beat Designer writes a `/spec.partial.yaml` to memory before calling `needs_clarification`.
2. If the session times out, Wasp marks the beat `AWAITING_CLARIFICATION` but session is null.
3. On user reply, Wasp starts a NEW session with a different initial message: `action=resume_design, beat_slug=..., clarification_reply=...`.
4. Beat Designer reads `/spec.partial.yaml` and proceeds as if it had just received the reply.

Design this code path defensively; it's trivial to add and protects against a class of session-lifecycle surprises.

### 5.3 Generate issue flow

```
Wasp job fires
  ↓
Wasp starts session:
  agent: COORDINATOR_AGENT_ID
  environment_id: ENVIRONMENT_ID
  resources: [spec (rw), history (rw), global_patterns (ro)]
  ↓
Wasp sends user event:
  { action: "generate_issue", beat_slug: "...", as_of: "<ISO ts>" }
  ↓
Coordinator delegates to Editor
  Editor reads spec, sources, relevance, recent history, fingerprints
  Editor sweeps sources (parallel via bash + wait)
  Editor filters, verifies, drafts, self-edits
  Editor calls publish_issue → Wasp validates, persists, renders, dispatches
  Editor writes /issues/<date>.md and appends fingerprints
  Editor thread goes idle
  ↓
Coordinator: "Issue published."
  ↓
Session ends
```

### 5.4 Update relevance flow

```
Daily job fires for a beat with pending feedback
  ↓
Wasp starts session:
  resources: [spec (rw)]
  ↓
Wasp sends user event:
  { action: "update_relevance", beat_slug: "...", feedback_batch: [...] }
  ↓
Coordinator delegates to Beat Designer (feedback-learning mode)
  Designer reads /relevance.md
  Designer distinguishes signal from noise
  Designer appends dated entries to "## Learned from feedback" via memory_edit
  Designer thread goes idle (no finalize_beat_spec in this mode)
  ↓
Session ends
```

---

## 6. Event streaming from sessions

Consume via `/v1/sessions/:id/stream` SSE endpoint. Relevant event types:

| Event | Meaning | Wasp action |
|---|---|---|
| `agent.message` | Agent text output | Optionally forward as SSE `designer.thinking` / `scout.progress` event |
| `agent.tool_use` | Agent calls a built-in tool | Mostly ignore; optionally surface "agent is fetching ..." to UI |
| `agent.custom_tool_use` | Agent calls our custom tool | Handle per the table in §3.5, return tool_result |
| `session.thread_created` | Multi-agent subagent spawned | Log, emit SSE "scout starting" / "designer starting" as appropriate |
| `session.thread_idle` | A subagent thread finished | Log |
| `session.idle` | Whole session idle | Done for this phase |
| `session.error` | Fatal error | Flip beat status to FAILED, emit SSE `beat.failed` |

Wasp should treat tool_use and tool_result routing carefully per the multi-agent docs: when a custom tool call comes from a subagent thread, the event carries `session_thread_id`, and our tool_result reply must echo it. The orchestrator abstracts this — callers don't need to think about threads.

---

## 7. Rate limits and cost controls

Managed Agents limits (per org):
- 300 create requests/min
- 600 read requests/min

Nowhere near a concern at hackathon scale. At product scale, the constraints that will bite first:
- Coordinator + 3 Sonnet agents, long sessions = tokens add up fast
- Every scheduled run of every active beat = real $ per day per beat

For MVP, do NOT build cost controls. For v2: rate-limit issue generation per user (e.g., max 20 issues/day across all beats), display approximate token spend in the dashboard.

---

## 8. Testing approach

- **Phase 0 smoke tests** (see PLAN.md) cover the single-agent + memory + session-lifespan base cases.
- **Phase 4 e2e script** covers the full happy path without Wasp UI.
- **No mocking of the Managed Agents API.** The product IS its interaction with real agents. Unit tests at the Zod-validation layer are fine; integration tests run against the real API and cost a few cents per run, which is fine.
- **Seed fixtures** for Zod tests in `src/server/agents/__fixtures__/`: one valid and one invalid sample per custom tool.

---

## 9. Debugging and observability

For MVP:
- Log every session ID + beat ID to `console.log` structured as JSON.
- On failure, log the session ID and the last 20 events in its stream so we can replay via `/v1/sessions/:id/events`.
- Keep failed sessions' memory stores intact for post-mortem — only delete on explicit beat delete.

v2 ideas (not building now): Sentry for server errors, a "debug session" button in the dashboard that opens the raw event stream.

---

## 10. Out of scope for CMA side

- Agent-to-agent delegation deeper than one level (Managed Agents doesn't support it anyway)
- Cross-user memory sharing
- Custom MCP servers (the built-in toolset is sufficient)
- Custom skills packages (nothing in this product needs the skills system; the system prompts handle it)
- Session pause/resume beyond the natural clarification-wait flow
- Speculative or streaming tool calls

---

## 11. Open questions for the CMA side (to resolve during build)

- **Parallel source sweeping** in the Editor: optimal approach for fetching 20 sources concurrently from a bash-tool context. Current plan: bash `&` + `wait` with a capped subshell pool. Validate in Phase 4.
- **Memory file rotation:** at what point do we archive old `/issues/` files to a subdirectory to keep the history store lean? Current plan: ignore until an issue emerges; 100KB/file limit means we won't hit store-level problems for months.
- **Global patterns authorship conflict:** if two simultaneous Scout sessions both want to append to the same global-patterns file, the second one's `memory_edit` may race. Current plan: accept last-writer-wins for MVP; if noticeable in practice, switch Scout to `memory_write` with `content_sha256` precondition and retry on conflict.

---

## 12. Provisioning reference

The `scripts/provision-agents.ts` script should produce, in order:

1. One environment — `POST /v1/environments` with the package list from §2.
2. One global memory store — `POST /v1/memory_stores` named "Newsroom Global Patterns". Seed with the starter files from §4.3.
3. Beat Designer agent — `POST /v1/agents` with the config from §3.1.
4. Sources Scout agent — same endpoint, config from §3.2.
5. Editor agent — same endpoint, config from §3.3.
6. Coordinator agent — same endpoint, config from §3.4, with `callable_agents` referencing the three above.

All resulting IDs go into `.env.server`. The script is idempotent: if env vars are already populated, it exits cleanly unless `--force` is passed.
