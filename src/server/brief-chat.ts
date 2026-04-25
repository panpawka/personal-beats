import { HttpError } from "wasp/server";
import type { ChatBeatBrief } from "wasp/server/operations";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CronExpressionParser } from "cron-parser";
import { z } from "zod";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 30;

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const DraftSchema = z.object({
  title: z.string().nullable(),
  topic: z.string().nullable(),
  cadenceType: z.enum(["TIME_BASED", "ON_DEMAND"]).nullable(),
  cronExpression: z.string().nullable(),
  timezone: z.string().nullable(),
  depth: z.enum(["BRIEF", "STANDARD", "DEEP"]).nullable(),
  outputLanguage: z.string().nullable(),
});
export type BriefDraft = z.infer<typeof DraftSchema>;

const EMPTY_DRAFT: BriefDraft = {
  title: null,
  topic: null,
  cadenceType: null,
  cronExpression: null,
  timezone: null,
  depth: null,
  outputLanguage: null,
};

const RequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(MAX_TURNS),
  locale: z.string().optional(),
  currentDraft: DraftSchema.optional(),
});

// Model emits ONLY fields the user touched in their LATEST message.
// Server applies the delta, defaults, and computes completeness — the model
// never sees or emits a "complete" flag and never re-emits prior state.
const ProposeBriefSchema = z.object({
  reply: z
    .string()
    .describe(
      "Next assistant message in the reader's language. One short paragraph, no markdown.",
    ),
  delta: DraftSchema.describe(
    "Fields the user STATED, HINTED, or IMPLIED in their MOST RECENT message ONLY. Set every field the user did not touch this turn to null. Never carry forward prior values. Never emit defaults — the server tracks state and applies defaults.",
  ),
});

const SYSTEM_PROMPT = `You are an editor onboarding a reader to a recurring personalized newsletter ("beat"). You hold a short conversation that resolves a structured brief.

Brief fields:
- topic — what the reader wants followed (a specific noun phrase, not a sentence)
- cadenceType — "TIME_BASED" or "ON_DEMAND"
- cronExpression — 5-field cron string. Required iff cadenceType="TIME_BASED". Null otherwise.
- timezone — IANA name (e.g. "Europe/Warsaw"). Required iff cadenceType="TIME_BASED". Null otherwise.
- depth — "BRIEF" (3–5 picks), "STANDARD" (8–12 picks), or "DEEP" (everything that matters).
- outputLanguage — ISO 639-1: "en", "pl", "de", "fr", "es", "it", "nl", "pt", "cs", "sk", "uk".
- title — short editorial label. Always leave null; the server derives it from topic.

Cron cheatsheet:
- daily 07:00 → "0 7 * * *"
- weekdays 08:00 → "0 8 * * 1-5"
- weekly Friday 17:00 → "0 17 * * 5"
- weekly Monday 08:00 → "0 8 * * 1"
- weekends 09:00 → "0 9 * * 0,6"

YOUR JOB EACH TURN — extract a delta from the latest user message, then write a short reply.

Rules for \`delta\`:

1. EXTRACT FROM LATEST USER MESSAGE ONLY. \`delta\` contains only fields the user STATED, HINTED, or IMPLIED in their most recent message — not anything from earlier turns.

2. NULL EVERYTHING ELSE. For every field the user did NOT touch in that single latest message, set delta.<field> = null. Most turns only update one or two fields.

3. DO NOT RE-EMIT KNOWN VALUES. If a field is already non-null in "Current draft state" below, set delta.<field> = null UNLESS the user explicitly contradicted it in the latest message. The server keeps the existing value.

4. DO NOT INVENT DEFAULTS. Never guess. If the user did not state cadenceType, leave it null — do NOT default to TIME_BASED. If the user did not state depth, leave it null — do NOT default to STANDARD. The server applies defaults (timezone "Europe/Warsaw" for TIME_BASED, title from topic) at completion.

5. \`title\` IS ALWAYS NULL. The server derives it from topic.

Rules for \`reply\`:

6. PROSE MUST MATCH delta + Current draft state. Only confirm values that are either in your delta this turn or already resolved in Current draft state. Never claim a value that is not present in either.

7. LANGUAGE-MIRROR. Reply in the user's most recent language. If they switch languages, switch with them.

8. ASK OR CONFIRM. If "Fields still unknown" below is empty AND the topic is specific enough to source for, write a 1–2 sentence confirmation that the brief is ready — do NOT ask another question. Otherwise ask exactly one short question about the most important gap. Never ask about a field already in Current draft state.

9. REFINE TOPIC FIRST. A topic is "specific enough" only when a scout could pick sources without guessing material details. Before moving on to cadence/depth, ask one clarifying question if the topic leaves a HIGH-IMPACT axis open. Common axes that change what gets sourced:
   - audience age range (e.g. "kids/dzieci" → toddlers vs school-age vs teens shifts every recommendation)
   - skill / experience level (e.g. "climbing" → beginner vs advanced changes the venue)
   - geography radius (e.g. "Wrocław weekends" → city only or 2-hour drive too?)
   - time horizon (e.g. "this week", "next 3 months", "evergreen")
   - format / source type if hinted (primary sources only, no paywalls, video vs text)
   Only ask about an axis the user did NOT already answer. Never ask more than one refinement question — once they answer, move on. If the topic is already self-explanatory, skip refinement.

10. PRIORITY ORDER for the next question: (a) topic refinement per rule 9, (b) cadenceType, (c) cronExpression+timezone if TIME_BASED, (d) depth, (e) outputLanguage (only if you genuinely cannot infer it). Pick the FIRST gap and ask only about that one.

Worked examples (LATEST user message → delta to emit; all other delta fields null):
- "Co robić z dziećmi w weekendy w Nowej Soli i okolicy" → delta.topic="atrakcje dla dzieci w weekendy w Nowej Soli i okolicy", delta.outputLanguage="pl". Reply asks for kids' age range (rule 9 — material axis open).
- "dla 4 i 7 latka" → delta.topic="atrakcje dla dzieci 4–7 lat w weekendy w Nowej Soli i okolicy" (REFINEMENT — contradicts prior topic, so re-emit). Reply moves on to cadence.
- "ręcznie, sam będę uruchamiać" → delta.cadenceType="ON_DEMAND" (cronExpression and timezone stay null)
- "raczej krótkie, 3–5 wystarczy" → delta.depth="BRIEF"
- "every morning" → delta.cadenceType="TIME_BASED", delta.cronExpression="0 7 * * *"
- "głęboko, wszystko co warto" → delta.depth="DEEP"
- "weekly Monday at 8" → delta.cadenceType="TIME_BASED", delta.cronExpression="0 8 * * 1"
- pure chitchat or a clarifying question with no brief field → every delta field is null`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError(500, "ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

type ChatMessage = z.infer<typeof ChatMessageSchema>;

const REQUIRED_FIELDS: (keyof BriefDraft)[] = [
  "topic",
  "cadenceType",
  "depth",
  "outputLanguage",
];

function applyDelta(current: BriefDraft, delta: BriefDraft): BriefDraft {
  const merged: BriefDraft = { ...current };
  (Object.keys(delta) as (keyof BriefDraft)[]).forEach((k) => {
    const v = delta[k];
    if (v !== null && v !== undefined) {
      (merged as Record<string, unknown>)[k] = v;
    }
  });
  return merged;
}

function deriveTitleFromTopic(topic: string): string {
  const first = topic.split(/[.!?\n]/)[0].trim();
  const trimmed = first.length > 80 ? `${first.slice(0, 77)}…` : first;
  return trimmed.replace(/^./, (c) => c.toUpperCase());
}

function applyDefaults(draft: BriefDraft): BriefDraft {
  const out: BriefDraft = { ...draft };
  if (out.cadenceType === "TIME_BASED" && !out.timezone) {
    out.timezone = "Europe/Warsaw";
  }
  if (!out.title && out.topic) {
    out.title = deriveTitleFromTopic(out.topic);
  }
  return out;
}

function unknownFields(draft: BriefDraft): (keyof BriefDraft)[] {
  const unknown: (keyof BriefDraft)[] = [];
  for (const k of REQUIRED_FIELDS) {
    if (!draft[k]) unknown.push(k);
  }
  if (draft.cadenceType === "TIME_BASED" && !draft.cronExpression) {
    unknown.push("cronExpression");
  }
  return unknown;
}

function isComplete(draft: BriefDraft): boolean {
  return unknownFields(draft).length === 0;
}

export const chatBeatBrief: ChatBeatBrief<
  {
    messages: ChatMessage[];
    locale?: string;
    currentDraft?: BriefDraft;
  },
  { reply: string; draft: BriefDraft; complete: boolean }
> = async (rawArgs, context) => {
  if (!context.user) throw new HttpError(401);

  const parsed = RequestSchema.safeParse(rawArgs);
  if (!parsed.success) {
    throw new HttpError(400, "invalid chat payload");
  }
  const { messages, locale, currentDraft } = parsed.data;

  if (messages[messages.length - 1].role !== "user") {
    throw new HttpError(400, "last message must be from user");
  }

  const base = currentDraft ?? EMPTY_DRAFT;
  const draftJson = JSON.stringify(base, null, 2);
  const unknown = unknownFields(base);
  const unknownLabel =
    unknown.length === 0
      ? "(none — write a 1–2 sentence confirmation reply, do not ask another question)"
      : unknown.join(", ");

  // Stable system block first (cached); volatile draft state after the cache
  // breakpoint. See shared/prompt-caching.md.
  const systemBlocks = [
    {
      type: "text" as const,
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" as const },
    },
    {
      type: "text" as const,
      text: `UI locale hint (may differ from the user's actual language): ${locale ?? "en"}.

Current draft state — fields already resolved on prior turns. Do NOT re-emit any of these in delta unless the user explicitly contradicted them in the latest message:
\`\`\`json
${draftJson}
\`\`\`

Fields still unknown: ${unknownLabel}`,
    },
  ];

  // Grammar-constrained structured output via output_config.format. The model
  // returns a delta (latest-message extraction only); the server owns running
  // state, defaults, and the complete flag.
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: systemBlocks,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    output_config: {
      format: zodOutputFormat(ProposeBriefSchema),
      effort: "low",
    },
  });

  console.log(response);

  const out = response.parsed_output;
  if (!out) {
    throw new HttpError(
      502,
      `model did not return parsed output (stop_reason=${response.stop_reason ?? "unknown"})`,
    );
  }

  // Apply delta: only non-null fields overwrite. The model is instructed to
  // null fields the user did not touch this turn, so prior user choices are
  // preserved automatically — no more lazy-default overwrites.
  let merged = applyDelta(base, out.delta);

  // Sanitize cadence / cron consistency.
  if (merged.cadenceType === "ON_DEMAND") {
    merged.cronExpression = null;
    merged.timezone = null;
  } else if (merged.cadenceType === "TIME_BASED" && merged.cronExpression) {
    const cron = merged.cronExpression.trim();
    try {
      CronExpressionParser.parse(cron);
      merged.cronExpression = cron;
    } catch {
      merged.cronExpression = null;
    }
  }

  // Server-side defaults (timezone, title) applied after sanitization.
  merged = applyDefaults(merged);

  // Server computes completeness from the final state — model no longer emits it.
  const complete = isComplete(merged);

  return { reply: out.reply, draft: merged, complete };
};
