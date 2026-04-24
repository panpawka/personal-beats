import type { Beat, IssueItem } from "wasp/entities";
import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import type {
  CreateBeat,
  SubmitClarification,
  PauseBeat,
  ResumeBeat,
  DeleteBeat,
  TriggerOnDemandRun,
  SubmitItemFeedback,
} from "wasp/server/operations";
import { CronExpressionParser } from "cron-parser";
import slugify from "slugify";
import { generateIssueJob } from "wasp/server/jobs";
import { deleteMemoryStore } from "./agents/client.js";

// Orchestrator kickoff lives in Phase 7's SSE endpoint (src/server/streaming.ts).
// Actions here only mutate DB state; the SSE connection is the single driver of
// createBeatSession / resumeBeatSession to avoid double-provisioning stores.
import {
  CadenceTypeValues,
  DepthValues,
  FeedbackValues,
  type CadenceType,
  type Depth,
  type Feedback,
} from "../shared/types.js";

// -------- ownership guard --------

async function loadOwnedBeat(
  beatId: string,
  userId: string,
): Promise<Beat> {
  const beat = await prisma.beat.findUnique({ where: { id: beatId } });
  if (!beat || beat.userId !== userId) {
    throw new HttpError(404);
  }
  return beat;
}

// -------- slug --------

async function generateUniqueSlug(source: string): Promise<string> {
  const base =
    slugify(source.slice(0, 60), { lower: true, strict: true }) || "beat";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const exists = await prisma.beat.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    candidate = `${base}-${i}`;
  }
  // Fallback: random suffix
  return `${base}-${Date.now().toString(36)}`;
}

// =========================================================================
// createBeat
// =========================================================================

type CreateBeatInput = {
  brief: string;
  title?: string;
  cadenceType: CadenceType;
  cronExpression?: string;
  timezone?: string;
  depth?: Depth;
  outputLanguage?: string;
};

export const createBeat: CreateBeat<
  CreateBeatInput,
  { beatId: string }
> = async (args, context) => {
  if (!context.user) throw new HttpError(401);

  const brief = (args.brief ?? "").trim();
  if (brief.length < 4 || brief.length > 2000) {
    throw new HttpError(400, "brief must be 4–2000 characters");
  }

  if (!CadenceTypeValues.includes(args.cadenceType)) {
    throw new HttpError(400, "invalid cadenceType");
  }

  let cronExpression: string | null = null;
  if (args.cadenceType === "TIME_BASED") {
    if (!args.cronExpression) {
      throw new HttpError(400, "cronExpression required for TIME_BASED");
    }
    try {
      CronExpressionParser.parse(args.cronExpression);
    } catch {
      throw new HttpError(400, "invalid cron expression");
    }
    cronExpression = args.cronExpression;
  }

  const depth: Depth = args.depth ?? "STANDARD";
  if (!DepthValues.includes(depth)) {
    throw new HttpError(400, "invalid depth");
  }

  const title = (args.title ?? brief.slice(0, 80)).trim() || "Untitled beat";
  const slug = await generateUniqueSlug(title);

  const beat = await context.entities.Beat.create({
    data: {
      userId: context.user.id,
      slug,
      title,
      brief,
      status: "DRAFT",
      cadenceType: args.cadenceType,
      cronExpression,
      timezone: args.timezone ?? "Europe/Warsaw",
      depth,
      outputLanguage: args.outputLanguage ?? "en",
    },
  });

  // The Designer/Scout run starts when the client opens the SSE stream for
  // this beat (Phase 7). Returning beatId here so the UI can navigate there.
  return { beatId: beat.id };
};

// =========================================================================
// submitClarification
// =========================================================================

export const submitClarification: SubmitClarification<
  { beatId: string; reply: string },
  { ok: true }
> = async ({ beatId, reply }, context) => {
  if (!context.user) throw new HttpError(401);
  const beat = await loadOwnedBeat(beatId, context.user.id);

  if (beat.status !== "AWAITING_CLARIFICATION") {
    throw new HttpError(409, `beat not awaiting clarification (${beat.status})`);
  }
  const trimmed = (reply ?? "").trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new HttpError(400, "reply must be 1–4000 characters");
  }

  // Persist the reply so the SSE endpoint's resumeBeatSession can pick it up
  // when the client reconnects. Status stays AWAITING_CLARIFICATION until SSE
  // kicks off the follow-up user.message.
  await context.entities.Beat.update({
    where: { id: beatId },
    data: {
      pendingClarification: JSON.stringify({
        ...(beat.pendingClarification
          ? JSON.parse(beat.pendingClarification)
          : {}),
        reply: trimmed,
        reply_at: new Date().toISOString(),
      }),
    },
  });

  return { ok: true };
};

// =========================================================================
// pauseBeat / resumeBeat
// =========================================================================

export const pauseBeat: PauseBeat<{ beatId: string }, Beat> = async (
  { beatId },
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const beat = await loadOwnedBeat(beatId, context.user.id);
  if (beat.status === "PAUSED") return beat;
  if (beat.status !== "ACTIVE") {
    throw new HttpError(409, `cannot pause from ${beat.status}`);
  }
  // Phase 11 pattern B: no pg-boss cancel needed. scheduleSweeperJob filters
  // on status="ACTIVE", so flipping to PAUSED is sufficient to halt firings.
  return context.entities.Beat.update({
    where: { id: beatId },
    data: { status: "PAUSED" },
  });
};

export const resumeBeat: ResumeBeat<{ beatId: string }, Beat> = async (
  { beatId },
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const beat = await loadOwnedBeat(beatId, context.user.id);
  if (beat.status !== "PAUSED") {
    throw new HttpError(409, `cannot resume from ${beat.status}`);
  }
  // Pattern B: just flip status. Reset lastScheduledAt to now so a beat
  // paused for days doesn't immediately back-fire every missed cron tick
  // — sweeper anchors to lastScheduledAt and would otherwise flood.
  return context.entities.Beat.update({
    where: { id: beatId },
    data: { status: "ACTIVE", lastScheduledAt: new Date() },
  });
};

// =========================================================================
// deleteBeat
// =========================================================================

export const deleteBeat: DeleteBeat<
  { beatId: string },
  { ok: true }
> = async ({ beatId }, context) => {
  if (!context.user) throw new HttpError(401);
  const beat = await loadOwnedBeat(beatId, context.user.id);

  // Best-effort memory store cleanup — ignore failures so a stale CMA state
  // can't block DB deletion.
  for (const storeId of [beat.specMemoryStoreId, beat.historyMemoryStoreId]) {
    if (!storeId) continue;
    try {
      await deleteMemoryStore(storeId);
    } catch (err) {
      console.warn(`deleteMemoryStore(${storeId}) failed:`, err);
    }
  }

  await context.entities.Beat.delete({ where: { id: beatId } });
  return { ok: true };
};

// =========================================================================
// triggerOnDemandRun
// =========================================================================

const ON_DEMAND_MAX_PER_DAY = 3;

export const triggerOnDemandRun: TriggerOnDemandRun<
  { beatId: string },
  { queued: true }
> = async ({ beatId }, context) => {
  if (!context.user) throw new HttpError(401);
  const beat = await loadOwnedBeat(beatId, context.user.id);
  if (beat.status !== "ACTIVE") {
    throw new HttpError(409, `beat not ACTIVE (status=${beat.status})`);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.issue.count({
    where: { beatId, publishedAt: { gte: since } },
  });
  if (recentCount >= ON_DEMAND_MAX_PER_DAY) {
    throw new HttpError(
      429,
      `on-demand limit reached (${ON_DEMAND_MAX_PER_DAY}/24h)`,
    );
  }

  // Enqueue via pg-boss. singletonKey prevents a user double-clicking the
  // button from queueing two jobs for the same beat. The job runs Editor
  // session + Mailgun dispatch; UI polls getIssuesForBeat for the new row.
  await generateIssueJob.submit(
    { beatId, isOnDemand: true },
    { singletonKey: beatId },
  );

  return { queued: true };
};

// =========================================================================
// submitItemFeedback
// =========================================================================

export const submitItemFeedback: SubmitItemFeedback<
  { issueItemId: string; feedback: Feedback },
  IssueItem
> = async ({ issueItemId, feedback }, context) => {
  if (!context.user) throw new HttpError(401);
  if (!FeedbackValues.includes(feedback)) {
    throw new HttpError(400, "invalid feedback value");
  }

  const item = await prisma.issueItem.findUnique({
    where: { id: issueItemId },
    include: { issue: { include: { beat: true } } },
  });
  if (!item || item.issue.beat.userId !== context.user.id) {
    throw new HttpError(404);
  }

  return context.entities.IssueItem.update({
    where: { id: issueItemId },
    data: { feedback, feedbackAt: new Date() },
  });
};
