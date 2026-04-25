/**
 * Editor phase worker.
 *
 * Runs runPhaseTick for phase=EDITOR, re-enqueuing itself until the session
 * reaches publish_issue + end_turn. On phase_done, reads the captured
 * publish_issue payload from AgentEvent, persists Issue + IssueItem rows,
 * and dispatches the newsletter via Mailgun.
 *
 * Re-enqueue uses singletonKey = `editor-${beatId}` so one Editor tick per
 * beat runs at a time. sweeper + on-demand triggers share this key.
 */
import type { GenerateIssueJob } from "wasp/server/jobs";
import { generateIssueJob } from "wasp/server/jobs";
import { prisma } from "wasp/server";
import { runPhaseTick } from "../agents/drive.js";
import { PublishIssueSchema } from "../../shared/types.js";
import { sendNewsletter } from "../email/mailgun.js";

type Args = {
  beatId: string;
  isOnDemand?: boolean;
  kickoff?: boolean;
};

export const generateIssue: GenerateIssueJob<
  Args,
  { issueId?: string; status: "ok" | "error" | "reenqueue"; error?: string }
> = async ({ beatId, isOnDemand, kickoff }) => {
  const tag = `[generateIssue${isOnDemand ? ":ondemand" : ""}:${beatId}]`;

  // First tick for a run is the sweeper/action submit — no kickoff flag
  // means the driver decides (it defaults to no-kickoff; we pass kickoff=true
  // only when Beat has no EDITOR session yet).
  const firstTick = kickoff === undefined;
  let effectiveKickoff = kickoff;
  if (firstTick) {
    const beat = await prisma.beat.findUnique({ where: { id: beatId } });
    effectiveKickoff =
      beat?.currentPhase !== "EDITOR" || !beat?.currentSessionId;
  }

  const verdict = await runPhaseTick({
    beatId,
    phase: "EDITOR",
    kickoff: effectiveKickoff,
  });

  if (verdict.state === "reenqueue") {
    // No singletonKey on self-re-enqueue — pg-boss would drop it since this
    // job is still active. External triggers (sweeper / on-demand action)
    // keep the key to prevent duplicate Editor runs for the same beat.
    await generateIssueJob.submit({ beatId, isOnDemand, kickoff: false });
    return { status: "reenqueue" };
  }

  if (verdict.state === "waiting_for_user") {
    // Editor has no clarification tool, so this branch should never fire.
    console.error(`${tag} unexpected waiting_for_user state`);
    return { status: "error", error: "editor entered waiting_for_user" };
  }

  if (verdict.state === "failed") {
    console.error(`${tag} failed: ${verdict.error}`);
    await clearEditorSession(beatId);
    return { status: "error", error: verdict.error };
  }

  // phase_done — persist Issue + IssueItems from the captured payload.
  try {
    const issueId = await persistIssueFromEvents(beatId);
    console.log(`${tag} issue created: ${issueId}`);
    const sendResult = await sendNewsletter(issueId);
    console.log(`${tag} send: ${sendResult.status}`);
    return { issueId, status: "ok" };
  } catch (err) {
    const error = String(err).slice(0, 500);
    console.error(`${tag} persistence/email failed: ${error}`);
    return { status: "error", error };
  } finally {
    await clearEditorSession(beatId);
  }
};

async function persistIssueFromEvents(beatId: string): Promise<string> {
  const beat = await prisma.beat.findUnique({
    where: { id: beatId },
    select: { currentSessionId: true },
  });
  const sessionId = beat?.currentSessionId;
  if (!sessionId) throw new Error("no current session for editor phase");

  const row = await prisma.agentEvent.findFirst({
    where: { beatId, sessionId, type: "editor.publish_issue" },
    orderBy: { occurredAt: "desc" },
  });
  if (!row) throw new Error("editor.publish_issue event missing");

  const parsed = PublishIssueSchema.safeParse(JSON.parse(row.payload));
  if (!parsed.success) {
    throw new Error(
      `stored publish_issue invalid: ${parsed.error.message.slice(0, 200)}`,
    );
  }
  const payload = parsed.data;

  const issue = await prisma.issue.create({
    data: {
      beatId,
      sessionId,
      issueDate: new Date(payload.issue_date),
      subject: payload.subject,
      dek: payload.dek,
      coverageNote: payload.coverage_note ?? null,
      htmlBody: "",
      plainBody: "",
      items: {
        create: payload.items.map((item, idx) => ({
          orderIndex: idx,
          headline: item.headline,
          summary: item.summary,
          whyItMatters: item.why_it_matters ?? null,
          primarySourceUrl: item.primary_source_url,
          secondarySourceUrls: JSON.stringify(item.secondary_source_urls ?? []),
          tags: JSON.stringify(item.tags ?? []),
          fingerprint: item.fingerprint,
        })),
      },
    },
  });

  // Synthetic "published" event so the UI sees a terminal marker for the
  // editor phase in the transcript.
  await prisma.agentEvent.create({
    data: {
      beatId,
      sessionId,
      phase: "EDITOR",
      eventId: null,
      type: "editor.published",
      payload: JSON.stringify({ issueId: issue.id }),
    },
  });

  return issue.id;
}

async function clearEditorSession(beatId: string): Promise<void> {
  // After EDITOR runs, reset the phase cursor so the next cron/on-demand
  // trigger starts a fresh session. We do NOT null out specMemoryStoreId /
  // historyMemoryStoreId — those persist across issues.
  await prisma.beat
    .update({
      where: { id: beatId },
      data: {
        currentPhase: null,
        currentSessionId: null,
        lastEventId: null,
      },
    })
    .catch(() => void 0);
}
