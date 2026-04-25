import { HttpError } from "wasp/server";
import type { ChatBeatBrief } from "wasp/server/operations";
import Anthropic from "@anthropic-ai/sdk";
import { CronExpressionParser } from "cron-parser";
import { z } from "zod";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 30;

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const RequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(MAX_TURNS),
  locale: z.string().optional(),
});

const DraftSchema = z.object({
  title: z.string().nullable(),
  topic: z.string().nullable(),
  cadenceType: z.enum(["TIME_BASED", "ON_DEMAND"]).nullable(),
  cronExpression: z.string().nullable(),
  timezone: z.string().nullable(),
  depth: z.enum(["BRIEF", "STANDARD", "DEEP"]).nullable(),
  outputLanguage: z.string().nullable(),
  rules: z.array(z.string()).default([]),
});
export type BriefDraft = z.infer<typeof DraftSchema>;

const ProposeBriefSchema = z.object({
  reply: z.string().min(1),
  draft: DraftSchema,
  complete: z.boolean(),
});

const SYSTEM_PROMPT = `You are an editor onboarding a new "beat" — a recurring personalized newsletter — by chatting with the reader.

Your job: have a short, natural conversation that resolves a complete brief covering these fields:
- topic — what they want followed (specific enough to filter sources)
- cadenceType — "TIME_BASED" (cron + timezone) or "ON_DEMAND" (reader triggers it manually). Default: TIME_BASED.
- cronExpression — required when cadenceType is TIME_BASED. Use 5-field cron in the user's timezone.
- timezone — IANA name (e.g. "Europe/Warsaw"). Required when TIME_BASED. Null for ON_DEMAND.
- depth — "BRIEF" (3–5 picks), "STANDARD" (8–12 picks), or "DEEP" (everything that matters). Default: STANDARD.
- outputLanguage — ISO 639-1 code (en, pl, de, fr, ...). Default: language of the reader's first message.
- title — a short editorial title for the beat (≤80 chars), inferred from the topic.
- rules — optional list of always/never constraints the user mentioned ("always lead with weather", "skip nightlife", "primary sources only", etc.).

Cron cheatsheet:
- daily 07:00 → "0 7 * * *"
- weekdays 08:00 → "0 8 * * 1-5"
- weekly Friday 17:00 → "0 17 * * 5"
- weekly Monday 08:00 → "0 8 * * 1"
- weekends 09:00 → "0 9 * * 0,6"

Conversation rules:
- ALWAYS reply in the SAME language as the reader's most recent message. If their first message is in Polish, you speak Polish for the whole conversation.
- Be warm, concise, lower-case where natural, no exclamation marks. One short paragraph and at most ONE follow-up question per turn.
- Never repeat a question if the answer is already in the draft.
- Default sensibly. Never invent constraints the reader did not state.
- Once topic + cadenceType + (cron+timezone if TIME_BASED) + depth + outputLanguage are settled, set complete=true and write a 1–2 sentence confirmation as your reply.
- Always carry over previously-known fields in the draft. Set fields to null only if they are still genuinely unknown.
- If the reader says something like "on demand" / "na żądanie" / "manually" / "when I ask", set cadenceType=ON_DEMAND and cronExpression=null and timezone=null.

Output protocol: you MUST call the propose_brief tool on every turn. Never reply in plain text.`;

const PROPOSE_BRIEF_TOOL: Anthropic.Tool = {
  name: "propose_brief",
  description:
    "Send your next assistant message and the latest brief draft. Call this on every turn.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "The next assistant message, in the reader's language. One short paragraph, no markdown.",
      },
      draft: {
        type: "object",
        properties: {
          title: { type: ["string", "null"] },
          topic: { type: ["string", "null"] },
          cadenceType: {
            type: ["string", "null"],
            enum: ["TIME_BASED", "ON_DEMAND", null],
          },
          cronExpression: { type: ["string", "null"] },
          timezone: { type: ["string", "null"] },
          depth: {
            type: ["string", "null"],
            enum: ["BRIEF", "STANDARD", "DEEP", null],
          },
          outputLanguage: { type: ["string", "null"] },
          rules: { type: "array", items: { type: "string" } },
        },
        required: [
          "title",
          "topic",
          "cadenceType",
          "cronExpression",
          "timezone",
          "depth",
          "outputLanguage",
          "rules",
        ],
      },
      complete: { type: "boolean" },
    },
    required: ["reply", "draft", "complete"],
  } as Anthropic.Tool["input_schema"],
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError(500, "ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const chatBeatBrief: ChatBeatBrief<
  { messages: ChatMessage[]; locale?: string },
  { reply: string; draft: BriefDraft; complete: boolean }
> = async (rawArgs, context) => {
  if (!context.user) throw new HttpError(401);

  const parsed = RequestSchema.safeParse(rawArgs);
  if (!parsed.success) {
    throw new HttpError(400, "invalid chat payload");
  }
  const { messages, locale } = parsed.data;

  if (messages[messages.length - 1].role !== "user") {
    throw new HttpError(400, "last message must be from user");
  }

  const systemBlocks = [
    { type: "text" as const, text: SYSTEM_PROMPT },
    {
      type: "text" as const,
      text: `Current UI locale (hint, may be wrong): ${locale ?? "en"}.`,
    },
  ];

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemBlocks,
    tools: [PROPOSE_BRIEF_TOOL],
    tool_choice: { type: "tool", name: "propose_brief" },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse || toolUse.name !== "propose_brief") {
    throw new HttpError(502, "model did not call propose_brief");
  }

  const proposed = ProposeBriefSchema.safeParse(toolUse.input);
  if (!proposed.success) {
    throw new HttpError(502, `propose_brief payload invalid: ${proposed.error.message}`);
  }

  const out = proposed.data;

  // Sanitize the model's draft: an invalid cron or a TIME_BASED schedule
  // missing cron must not be treated as complete; otherwise the user clicks
  // "File this beat" and createBeat 400s late in the flow.
  if (out.draft.cadenceType === "ON_DEMAND") {
    out.draft.cronExpression = null;
    out.draft.timezone = null;
  } else if (out.draft.cadenceType === "TIME_BASED") {
    const cron = out.draft.cronExpression?.trim();
    if (!cron) {
      out.complete = false;
    } else {
      try {
        CronExpressionParser.parse(cron);
        out.draft.cronExpression = cron;
      } catch {
        out.draft.cronExpression = null;
        out.complete = false;
      }
    }
  } else if (out.complete) {
    // No cadence resolved — can't be complete.
    out.complete = false;
  }

  return out;
};
