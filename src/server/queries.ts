import type { AgentEvent, Beat, Issue, IssueItem } from "wasp/entities";
import { HttpError } from "wasp/server";
import type {
  GetBeats,
  GetBeat,
  GetIssuesForBeat,
  GetIssue,
  GetIssueSessionStatus,
  GetAgentEvents,
} from "wasp/server/operations";

export type BeatWithLastIssue = Beat & {
  lastIssueAt: Date | null;
  issueCount: number;
};

export const getBeats: GetBeats<void, BeatWithLastIssue[]> = async (
  _args,
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const rows = await context.entities.Beat.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      issues: {
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: { publishedAt: true },
      },
      _count: {
        select: { issues: true },
      },
    },
  });
  return rows.map(({ issues, _count, ...beat }) => ({
    ...beat,
    lastIssueAt: issues[0]?.publishedAt ?? null,
    issueCount: _count?.issues ?? 0,
  }));
};

export const getBeat: GetBeat<{ beatId: string }, Beat> = async (
  { beatId },
  context,
) => {
  if (!context.user) throw new HttpError(401);
  const beat = await context.entities.Beat.findUnique({
    where: { id: beatId },
  });
  if (!beat || beat.userId !== context.user.id) {
    throw new HttpError(404);
  }
  return beat;
};

export const getIssuesForBeat: GetIssuesForBeat<
  { beatId: string },
  Omit<Issue, "htmlBody" | "plainBody">[]
> = async ({ beatId }, context) => {
  if (!context.user) throw new HttpError(401);
  const beat = await context.entities.Beat.findUnique({
    where: { id: beatId },
  });
  if (!beat || beat.userId !== context.user.id) {
    throw new HttpError(404);
  }
  return context.entities.Issue.findMany({
    where: { beatId },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      beatId: true,
      sessionId: true,
      publishedAt: true,
      issueDate: true,
      subject: true,
      dek: true,
      coverageNote: true,
      emailStatus: true,
      emailSentAt: true,
    },
  }) as unknown as Promise<Omit<Issue, "htmlBody" | "plainBody">[]>;
};

/**
 * Live status of the Editor phase for a beat.
 *
 * Derived from Beat.currentPhase + presence of a terminal AgentEvent. No
 * CMA GET needed — the drive job persists everything durably.
 *   - `idle`    → no Editor session in flight
 *   - `running` → currentPhase === EDITOR and no terminal event yet
 *   - `done`    → currentPhase cleared in the last tail window (brief, as
 *                 the Editor job clears currentPhase on success/error).
 */
export type IssueSessionStatus =
  | { state: "idle" }
  | { state: "running"; sessionId: string }
  | { state: "done"; sessionId: string };

// If an Editor phase has gone this long without a Beat write, assume the
// worker crashed / pg-boss expired the job and treat the phase as idle so
// the UI unblocks. The reenqueue-counter safety net in drive.ts will also
// clean up server-side on the next tick, but this keeps the UI responsive
// in the meantime.
const EDITOR_STALE_MS = 15 * 60 * 1000;

export const getIssueSessionStatus: GetIssueSessionStatus<
  { beatId: string },
  IssueSessionStatus
> = async ({ beatId }, context) => {
  if (!context.user) throw new HttpError(401);
  const beat = await context.entities.Beat.findUnique({
    where: { id: beatId },
    select: {
      userId: true,
      currentPhase: true,
      currentSessionId: true,
      updatedAt: true,
    },
  });
  if (!beat || beat.userId !== context.user.id) throw new HttpError(404);

  if (beat.currentPhase === "EDITOR" && beat.currentSessionId) {
    const age = Date.now() - beat.updatedAt.getTime();
    if (age < EDITOR_STALE_MS) {
      return { state: "running", sessionId: beat.currentSessionId };
    }
    // Fall through — stale EDITOR phase, surface as idle/done instead of
    // pinning the UI in "Generating…".
  }

  // Fall back to the most recent Editor session so the UI can link to it
  // from the "last generated" panel.
  const lastPublish = await context.entities.AgentEvent.findFirst({
    where: { beatId, phase: "EDITOR", type: "editor.published" },
    orderBy: { occurredAt: "desc" },
    select: { sessionId: true },
  });
  if (lastPublish) {
    return { state: "done", sessionId: lastPublish.sessionId };
  }
  return { state: "idle" };
};

export const getIssue: GetIssue<
  { issueId: string },
  Issue & { items: IssueItem[] }
> = async ({ issueId }, context) => {
  if (!context.user) throw new HttpError(401);
  const issue = await context.entities.Issue.findUnique({
    where: { id: issueId },
    include: { items: { orderBy: { orderIndex: "asc" } }, beat: true },
  });
  if (!issue) throw new HttpError(404);
  if ((issue as unknown as { beat: Beat }).beat.userId !== context.user.id) {
    throw new HttpError(404);
  }
  const { beat: _beat, ...rest } = issue as unknown as Issue & {
    items: IssueItem[];
    beat: Beat;
  };
  return rest;
};

/**
 * Transcript tail for a beat. Client polls with sinceIso to fetch only new
 * events. AgentEvent rows are the single source of truth — the server does
 * no CMA calls to service this query.
 */
export const getAgentEvents: GetAgentEvents<
  { beatId: string; sinceIso?: string; limit?: number },
  AgentEvent[]
> = async ({ beatId, sinceIso, limit }, context) => {
  if (!context.user) throw new HttpError(401);
  const beat = await context.entities.Beat.findUnique({
    where: { id: beatId },
    select: { userId: true },
  });
  if (!beat || beat.userId !== context.user.id) throw new HttpError(404);

  const where: {
    beatId: string;
    occurredAt?: { gt: Date };
  } = { beatId };
  if (sinceIso) {
    const parsed = new Date(sinceIso);
    if (!Number.isNaN(parsed.getTime())) {
      where.occurredAt = { gt: parsed };
    }
  }

  return context.entities.AgentEvent.findMany({
    where,
    orderBy: { occurredAt: "asc" },
    take: Math.min(limit ?? 200, 500),
  });
};
