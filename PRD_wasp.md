# PRD — Wasp Application

Implementation spec for the Wasp half of the Personal Newsroom Agent. Assumes familiarity with `PRD.md`.

Wasp owns: auth, product data (DB), scheduling (jobs), frontend UX, email dispatch, and all I/O between the user and the agentic core. It is deliberately dumb about agent internals — it kicks off sessions via the orchestrator module, consumes events, and persists outputs.

---

## 1. Wasp version and dependencies

- Wasp: latest stable (≥0.15). Use the official Wasp template.
- Node: 20+.
- Postgres: 15+ (Wasp's default via Docker for dev).

**Runtime dependencies to add:**
```
@anthropic-ai/sdk              # for Managed Agents REST calls
react-email                    # v6 unified package
@sendgrid/mail                 # email dispatch
zod                            # runtime schema validation on agent tool payloads
jsonwebtoken                   # feedback magic-link tokens
cron-parser                    # validate + normalize user cron expressions
slugify                        # beat slug generation
```

**Dev dependencies:**
```
@react-email/ui                # react-email preview server
tsx                            # running scripts like provision-agents.ts
```

---

## 2. Environment variables

All in `.env.server`:

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Managed Agents API |
| `SENDGRID_API_KEY` | Email dispatch |
| `DATABASE_URL` | Wasp auto-fills in dev |
| `JWT_SECRET` | Signing feedback magic-link tokens. Min 32 random bytes. |
| `BEAT_DESIGNER_AGENT_ID` | Set by `provision-agents.ts` |
| `SOURCES_SCOUT_AGENT_ID` | Set by `provision-agents.ts` |
| `EDITOR_AGENT_ID` | Set by `provision-agents.ts` |
| `COORDINATOR_AGENT_ID` | Set by `provision-agents.ts` |
| `ENVIRONMENT_ID` | Shared container template ID |
| `GLOBAL_PATTERNS_STORE_ID` | The cross-beat learnings store |
| `APP_BASE_URL` | For building feedback magic-link URLs (e.g., `http://localhost:3000` in dev) |

---

## 3. `.wasp` application declaration

```wasp
app newsroom {
  wasp: { version: "^0.15.0" },
  title: "Personal Newsroom",
  auth: {
    userEntity: User,
    methods: {
      emailAndPassword: {}
    },
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/dashboard"
  },
  db: {
    system: PostgreSQL,
    prisma: {
      clientPreviewFeatures: ["postgresqlExtensions"]
    }
  },
  client: {
    rootComponent: import { Layout } from "@src/Layout"
  }
}
```

---

## 4. Database schema (Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  // ... Wasp auth fields filled in automatically
  createdAt    DateTime @default(now())
  beats        Beat[]
}

model Beat {
  id                    String    @id @default(uuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  slug                  String    @unique
  title                 String
  brief                 String                                // original user brief
  status                BeatStatus @default(DRAFT)
  cadenceType           CadenceType
  cronExpression        String?                               // nullable if ON_DEMAND
  timezone              String    @default("Europe/Warsaw")
  depth                 Depth     @default(STANDARD)
  outputLanguage        String    @default("en")

  specMemoryStoreId     String?                               // memstore_...
  historyMemoryStoreId  String?                               // memstore_...

  // Populated by Beat Designer's finalize_beat_spec call
  summary               String?                               // human-readable description
  defaultsApplied       String[]  @default([])

  // Populated by Sources Scout's scout_complete call
  sourceCount           Int?
  coverageAssessment    String?                               // healthy | thin | sparse
  coverageNote          String?

  // Clarification state (when status=AWAITING_CLARIFICATION)
  pendingClarification  Json?                                 // { questions: string[], sessionId, reasoning }

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  issues                Issue[]

  @@index([userId, status])
}

enum BeatStatus {
  DRAFT
  DESIGNING
  AWAITING_CLARIFICATION
  SCOUTING
  ACTIVE
  PAUSED
  FAILED
}

enum CadenceType {
  TIME_BASED
  ON_DEMAND
}

enum Depth {
  BRIEF
  STANDARD
  DEEP
}

model Issue {
  id           String     @id @default(uuid())
  beatId       String
  beat         Beat       @relation(fields: [beatId], references: [id], onDelete: Cascade)
  sessionId    String                                         // ses_... from managed agents
  publishedAt  DateTime   @default(now())
  issueDate    DateTime                                       // the date the issue is "for"
  subject      String
  dek          String
  coverageNote String?
  htmlBody     String                                         // rendered react-email output
  plainBody    String                                         // plain-text fallback
  emailStatus  EmailStatus @default(PENDING)
  emailSentAt  DateTime?
  items        IssueItem[]

  @@index([beatId, publishedAt])
}

enum EmailStatus {
  PENDING
  SENT
  FAILED
}

model IssueItem {
  id                   String   @id @default(uuid())
  issueId              String
  issue                Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
  orderIndex           Int                                    // display order
  headline             String
  summary              String
  whyItMatters         String?
  primarySourceUrl     String
  secondarySourceUrls  String[] @default([])
  tags                 String[] @default([])
  fingerprint          String                                 // dedup across issues
  feedback             Feedback?                              // null | POSITIVE | NEGATIVE
  feedbackAt           DateTime?
  feedbackToken        String?  @unique                       // pre-computed magic-link JWT

  @@index([issueId, orderIndex])
}

enum Feedback {
  POSITIVE
  NEGATIVE
}
```

---

## 5. Queries and actions

### 5.1 Queries (read-only, cacheable)

| Query | Input | Returns | Auth |
|---|---|---|---|
| `getBeats` | none | `Beat[]` for current user | required |
| `getBeat` | `{ beatId }` | `Beat` with status | required + ownership |
| `getIssuesForBeat` | `{ beatId }` | `Issue[]` (no body) | required + ownership |
| `getIssue` | `{ issueId }` | `Issue` with items | required + ownership |

Declare in `.wasp`:
```wasp
query getBeats {
  fn: import { getBeats } from "@src/server/queries",
  entities: [Beat]
}
```

### 5.2 Actions (mutations)

| Action | Input | Effect | Auth |
|---|---|---|---|
| `createBeat` | `{ brief, cadenceType, cron?, timezone?, depth?, language? }` | Creates Beat row in `DESIGNING` state, provisions memory stores, starts design session, returns `{ beatId, sessionId }` | required |
| `submitClarification` | `{ beatId, reply }` | Sends follow-up user event to paused session | required + ownership |
| `pauseBeat` | `{ beatId }` | Sets status to `PAUSED`, cancels scheduled jobs | required + ownership |
| `resumeBeat` | `{ beatId }` | Sets status to `ACTIVE`, reschedules | required + ownership |
| `deleteBeat` | `{ beatId }` | Cascades DB rows, deletes memory stores via API | required + ownership |
| `triggerOnDemandRun` | `{ beatId }` | Enqueues `generateIssueJob`. Rate-limit: max 3/day per beat. | required + ownership |
| `submitItemFeedback` | `{ issueItemId, feedback }` | Records feedback (dashboard-side; magic links use a separate endpoint) | required + ownership |

Ownership check pattern:
```ts
const beat = await context.entities.Beat.findUnique({ where: { id: beatId } });
if (!beat || beat.userId !== context.user.id) {
  throw new HttpError(404);  // 404 not 403 — don't leak existence
}
```

---

## 6. SSE streaming endpoint

Used only during beat creation for live "Designer thinking..." → "Scout found 14 sources..." UX. Issue generation uses polling.

### 6.1 Wasp declaration

```wasp
api streamBeatCreation {
  httpRoute: (GET, "/api/stream/beat/:beatId"),
  fn: import { streamBeatCreation } from "@src/server/streaming",
  auth: true,
  entities: [Beat]
}

apiNamespace streamNs {
  middlewareConfigFn: import { streamMiddleware } from "@src/server/streaming",
  path: "/api/stream"
}
```

### 6.2 Implementation pattern

```ts
// src/server/streaming.ts
import type { StreamBeatCreation } from "wasp/server/api";
import type { MiddlewareConfigFn } from "wasp/server";
import { HttpError } from "wasp/server";
import { subscribeToBeatEvents } from "./agents/orchestrator";

export const streamMiddleware: MiddlewareConfigFn = (config) => config;

export const streamBeatCreation: StreamBeatCreation = async (req, res, context) => {
  const { beatId } = req.params;
  const beat = await context.entities.Beat.findUnique({ where: { id: beatId } });
  if (!beat || beat.userId !== context.user?.id) {
    throw new HttpError(404);
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
  let closed = false;

  req.on("close", () => {
    closed = true;
    clearInterval(heartbeat);
    res.end();
  });

  try {
    for await (const event of subscribeToBeatEvents(beatId)) {
      if (closed) break;
      sendEvent(event.type, event.data);
      if (event.type === "beat.ready" || event.type === "beat.failed") break;
    }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
};
```

### 6.3 Event types forwarded to the client

| Event | Payload | Meaning |
|---|---|---|
| `designer.thinking` | `{ message }` | Beat Designer is reasoning (derived from agent text events) |
| `designer.needs_clarification` | `{ questions, reasoning }` | Beat Designer wants input — UI should prompt |
| `designer.finalized` | `{ summary, defaultsApplied }` | Spec written |
| `scout.progress` | `{ sourcesFound, note }` | Scout status update |
| `scout.complete` | `{ sourceCount, coverage, note }` | Scout done |
| `beat.ready` | `{ beatId }` | Final success event — close stream |
| `beat.failed` | `{ error }` | Terminal failure — close stream |

### 6.4 Reverse-proxy gotchas (for deploy)

- Nginx/Fly/Railway buffer by default. `X-Accel-Buffering: no` is the most important header.
- 15-second heartbeat prevents idle-connection timeouts.
- CORS must be configured on the `apiNamespace` — the default middleware does not apply to `api` routes.

---

## 7. react-email templates

### 7.1 Structure

```
src/emails/
  NewsletterEmail.tsx        # root — switches on spec.depth
  layouts/
    BriefLayout.tsx
    StandardLayout.tsx
    DeepLayout.tsx
  components/
    NewsletterHeader.tsx     # beat title, issue date, issue #
    NewsletterFooter.tsx     # unsubscribe, pause, settings links
    Item.tsx                 # single item wrapper
    SourceLink.tsx           # primary source button
    ItemFooter.tsx           # feedback magic-link buttons
    Analysis.tsx             # "Analysis:" or "Context:" callout (deep only)
    PullQuote.tsx            # styled quote (deep only)
```

### 7.2 Root component contract

```tsx
// src/emails/NewsletterEmail.tsx
import { Html, Head, Body, Container, Tailwind } from "react-email";
import { BriefLayout } from "./layouts/BriefLayout";
import { StandardLayout } from "./layouts/StandardLayout";
import { DeepLayout } from "./layouts/DeepLayout";
import type { BeatSpec, IssueJson } from "@src/shared/types";

interface NewsletterEmailProps {
  spec: BeatSpec;
  issue: IssueJson;
  issueNumber: number;
  unsubscribeUrl: string;
  dashboardUrl: string;
}

export function NewsletterEmail({ spec, issue, issueNumber, unsubscribeUrl, dashboardUrl }: NewsletterEmailProps) {
  const Layout = { BRIEF: BriefLayout, STANDARD: StandardLayout, DEEP: DeepLayout }[spec.depth];
  return (
    <Html lang={spec.output_language}>
      <Head />
      <Tailwind>
        <Body className="bg-white">
          <Container className="max-w-xl mx-auto p-6">
            <Layout spec={spec} issue={issue} issueNumber={issueNumber}
                    unsubscribeUrl={unsubscribeUrl} dashboardUrl={dashboardUrl} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Default export so react-email dev preview picks it up with a fixture
export default function Preview() {
  return <NewsletterEmail {...previewFixture} />;
}
```

### 7.3 Per-depth layouts

- **Brief:** 3-5 items as a tight list. Headline bold, summary 1 line, source link inline.
- **Standard:** 5-8 items, each a mini-card with headline, 2-3 sentence summary, optional "why it matters" in a callout, primary source as a button, `ItemFooter` with feedback buttons.
- **Deep:** 4-6 items treated as mini-articles. Paragraphs, `PullQuote` components where the agent marked quotes (≤15 words enforced in the Editor's system prompt), `Analysis` / `Context` callouts visually offset, secondary sources listed at the bottom.

### 7.4 Rendering

```ts
import { render } from "react-email";
import { NewsletterEmail } from "@src/emails/NewsletterEmail";

const html = render(<NewsletterEmail {...props} />);
const text = render(<NewsletterEmail {...props} />, { plainText: true });
```

### 7.5 Dashboard reuse

The same `<NewsletterEmail>` tree renders in the web dashboard's past-issue view by wrapping in an `<EmailPreview>` container that sandboxes email-specific styles. One component tree drives both the email and the web archive.

---

## 8. Feedback magic-link system

### 8.1 Token shape

Signed JWT (HS256 using `JWT_SECRET`):
```json
{
  "iss": "newsroom",
  "sub": "<issueItemId>",
  "uid": "<userId>",
  "act": "up" | "down",
  "exp": <unix ts, 30 days from issue date>
}
```

Tokens are pre-computed at render time and embedded in `ItemFooter` hrefs:
```
{APP_BASE_URL}/feedback/{token}
```

Persisted on `IssueItem.feedbackToken` for optional server-side invalidation.

### 8.2 Endpoint

```wasp
api feedbackMagicLink {
  httpRoute: (GET, "/feedback/:token"),
  fn: import { handleFeedbackMagicLink } from "@src/server/feedback",
  auth: false
}
```

Implementation:
1. Verify JWT signature + expiry.
2. Look up the `IssueItem`. Confirm `userId` in token matches the item's beat's owner.
3. Record `feedback` and `feedbackAt` on the row.
4. Redirect to `{APP_BASE_URL}/dashboard?feedback=recorded&beat=<beatId>`.

No Wasp auth required because the signed token IS the auth.

---

## 9. Wasp jobs

### 9.1 `generateIssueJob`

```wasp
job generateIssueJob {
  executor: PgBoss,
  perform: {
    fn: import { performGenerateIssue } from "@src/server/jobs/generateIssue"
  },
  entities: [Beat, Issue, IssueItem]
}
```

Input: `{ beatId: string }`.
Flow:
1. Load beat, refuse if status ≠ `ACTIVE`.
2. Call `orchestrator.generateIssueSession(beatId)` — returns `publish_issue` JSON.
3. Validate JSON with Zod schema.
4. Create `Issue` + `IssueItem` rows.
5. Pre-compute feedback tokens for each item.
6. Render HTML + plain-text via react-email.
7. Persist rendered bodies on the `Issue`.
8. Enqueue SendGrid dispatch (inline within the same job for MVP).
9. Update `Issue.emailStatus`.

### 9.2 `applyFeedbackJob`

Runs once daily per beat (cron `0 3 * * *` UTC). Aggregates the last 24h of unprocessed feedback, calls `orchestrator.updateRelevanceSession(beatId, feedbackPayload)`. Marks feedback rows as processed.

For MVP, this is a scheduled job that iterates all active beats. Optimize later if needed.

### 9.3 Scheduling

On beat `ACTIVE` transition, compute next fire time from `cronExpression` + `timezone`, enqueue a `generateIssueJob` with `startAfter`. In the job handler, re-enqueue for the next fire time at the end.

Alternative: pg-boss cron schedules, if Wasp exposes them cleanly. Either is fine.

### 9.4 On-demand runs

`triggerOnDemandRun` action enqueues the same `generateIssueJob` with `startAfter: now`. Rate-limit inside the action: count issues for the beat in the last 24h, reject if ≥3.

---

## 10. Frontend routes

| Route | Component | Notes |
|---|---|---|
| `/` | Landing | Redirects to `/dashboard` if signed in |
| `/login`, `/signup` | Wasp auth pages | Default styling OK for MVP |
| `/dashboard` | `BeatsList` | Empty state → "Create your first beat" CTA |
| `/beats/new` | `NewBeatForm` | Textarea for brief + submit → navigates to `/beats/:id` |
| `/beats/:id` | `BeatDetail` | Status-aware: creating → shows SSE stream; awaiting clarification → shows clarification form; active → shows issues list |
| `/beats/:id/issues/:issueId` | `IssueView` | Reuses NewsletterEmail components in dashboard wrapper |

### 10.1 `BeatDetail` status-aware behavior

| Beat status | UI |
|---|---|
| `DESIGNING` | SSE stream viewer — live events from the creation flow |
| `SCOUTING` | Same stream viewer |
| `AWAITING_CLARIFICATION` | Render the questions from `beat.pendingClarification`, textarea for reply, submit → `submitClarification` action |
| `ACTIVE` | Beat summary + sources coverage + list of issues + "Run now" button + pause/delete |
| `PAUSED` | Summary + "Resume" button |
| `FAILED` | Error message + "Retry" / "Delete" |

---

## 11. Scripts

### 11.1 `scripts/provision-agents.ts`

Runs once per environment. Creates:
1. The shared environment (`ENVIRONMENT_ID`)
2. `global_patterns` memory store (`GLOBAL_PATTERNS_STORE_ID`) + seeds it with initial tactics
3. Beat Designer, Sources Scout, Editor agents
4. Coordinator agent with `callable_agents` referencing the three above

Writes all IDs to `.env.server`. Idempotent: if IDs already set, refuses to re-create and exits. Force re-create with `--force`.

### 11.2 `scripts/seed-dev.ts`

Creates a test user and a pre-warmed beat (Wrocław daily) to speed manual testing.

### 11.3 `scripts/preview-email.ts`

Renders a `NewsletterEmail` fixture to HTML, writes to `./preview.html`, opens in browser. Faster than spinning up the full app for email tweaks.

---

## 12. Deploy notes

- Target: Fly.io or Railway. Either works.
- Confirm SSE: after deploy, `curl -N https://your-app/api/stream/beat/<id>` should show live events, not buffered output.
- Set all env vars in the deploy target.
- Set `APP_BASE_URL` to the deployed URL so magic links work.
- Seed `global_patterns` via `provision-agents.ts --seed-only` if the store was wiped.

---

## 13. Out of scope for Wasp side

- Multi-tenancy beyond per-user (no teams/orgs)
- Admin panel
- Observability beyond `console.log` (no Sentry, no OTel)
- Internationalization of the dashboard UI
- PWA / offline support
- Server-side rendering optimization
