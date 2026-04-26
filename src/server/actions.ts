import type { Beat } from "wasp/entities";
import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import type {
  CreateBeat,
  SubmitClarification,
  PauseBeat,
  ResumeBeat,
  DeleteBeat,
  TriggerOnDemandRun,
  SendIssueEmail,
} from "wasp/server/operations";
import { CronExpressionParser } from "cron-parser";
import slugify from "slugify";
import { driveAgentJob, generateIssueJob } from "wasp/server/jobs";
import { deleteMemoryStore } from "./agents/client.js";
import { sendNewsletter } from "./email/mailgun.js";
import {
  CadenceTypeValues,
  DepthValues,
  type CadenceType,
  type Depth,
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

  // Kick off the Designer phase immediately. driveAgentJob is durable —
  // the UI does not need to hold a connection open while the agent runs.
  await driveAgentJob.submit(
    { beatId: beat.id, phase: "DESIGNER", kickoff: true },
    { singletonKey: `drive-${beat.id}` },
  );

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
    throw new HttpError(
      409,
      `beat not awaiting clarification (${beat.status})`,
    );
  }
  const trimmed = (reply ?? "").trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new HttpError(400, "reply must be 1–4000 characters");
  }
  if (!beat.currentSessionId || beat.currentPhase !== "DESIGNER") {
    throw new HttpError(
      409,
      "no active Designer session on beat to resume",
    );
  }

  // Queue the reply for the driver's next tick.
  await prisma.agentMessage.create({
    data: {
      beatId,
      sessionId: beat.currentSessionId,
      kind: "CLARIFICATION_REPLY",
      text: trimmed,
    },
  });

  // Flip status so the UI renders "designing" immediately; driver will
  // re-flip to AWAITING_CLARIFICATION if the Designer asks again.
  await context.entities.Beat.update({
    where: { id: beatId },
    data: { status: "DESIGNING", pendingClarification: null },
  });

  // Wake the driver. singletonKey ensures we don't stack parallel ticks.
  await driveAgentJob.submit(
    { beatId, phase: "DESIGNER", kickoff: false },
    { singletonKey: `drive-${beatId}` },
  );

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

  // Reject if an Editor session is currently active for this beat — but only
  // if the phase is actually making progress. A beat whose Beat row hasn't
  // been touched in EDITOR_STALE_MS is a zombie (worker crashed, pg-boss
  // expired, etc.); reset its phase cursor so the user can retry.
  if (beat.currentPhase === "EDITOR" && beat.currentSessionId) {
    const ageMs = Date.now() - beat.updatedAt.getTime();
    const EDITOR_STALE_MS = 15 * 60 * 1000;
    if (ageMs < EDITOR_STALE_MS) {
      throw new HttpError(409, "issue generation already in progress");
    }
    await prisma.beat.update({
      where: { id: beatId },
      data: {
        currentPhase: null,
        currentSessionId: null,
        lastEventId: null,
        reenqueueCount: 0,
      },
    });
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

  await generateIssueJob.submit(
    { beatId, isOnDemand: true },
    { singletonKey: `editor-${beatId}` },
  );

  return { queued: true };
};

// =========================================================================
// sendIssueEmail
// =========================================================================

const SEND_COOLDOWN_MS = 30_000;

export const sendIssueEmail: SendIssueEmail<
  { issueId: string },
  { status: "SENT" | "FAILED"; emailSentAt: Date | null; error?: string }
> = async ({ issueId }, context) => {
  if (!context.user) throw new HttpError(401);

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { beat: { select: { userId: true } } },
  });
  if (!issue || issue.beat.userId !== context.user.id) {
    throw new HttpError(404);
  }

  if (
    issue.emailSentAt &&
    Date.now() - issue.emailSentAt.getTime() < SEND_COOLDOWN_MS
  ) {
    throw new HttpError(429, "send cooldown — try again in a few seconds");
  }

  const result = await sendNewsletter(issueId);
  const fresh = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { emailSentAt: true },
  });

  return {
    status: result.status,
    emailSentAt: fresh?.emailSentAt ?? null,
    error: result.status === "FAILED" ? result.error : undefined,
  };
};

