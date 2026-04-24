import type { Beat, Issue, IssueItem } from "wasp/entities";
import { HttpError } from "wasp/server";
import type {
  GetBeats,
  GetBeat,
  GetIssuesForBeat,
  GetIssue,
} from "wasp/server/operations";

export type BeatWithLastIssue = Beat & {
  lastIssueAt: Date | null;
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
    },
  });
  return rows.map(({ issues, ...beat }) => ({
    ...beat,
    lastIssueAt: issues[0]?.publishedAt ?? null,
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
