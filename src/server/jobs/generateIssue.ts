/**
 * Phase 11 — generateIssueJob worker.
 *
 * Args: { beatId, isOnDemand? }
 *
 * Runs the Editor session (creates the Issue + IssueItem rows) then dispatches
 * the newsletter via Mailgun. Both on-demand triggers and the cron sweeper
 * route through here.
 *
 * Errors do not throw — pg-boss `retryLimit: 0` means a thrown error would
 * still mark the job as failed, but we'd rather log + return so a bad beat
 * doesn't poison the queue. The Issue row already records emailStatus=FAILED
 * if Mailgun rejects, so failures are auditable from the dashboard.
 */
import type { GenerateIssueJob } from "wasp/server/jobs";
import { generateIssueSession } from "../agents/orchestrator.js";
import { sendNewsletter } from "../email/mailgun.js";

type Args = { beatId: string; isOnDemand?: boolean };

export const generateIssue: GenerateIssueJob<
  Args,
  { issueId?: string; status: "ok" | "error"; error?: string }
> = async ({ beatId, isOnDemand }) => {
  const tag = `[generateIssue${isOnDemand ? ":ondemand" : ""}:${beatId}]`;
  try {
    const { issueId } = await generateIssueSession(beatId);
    console.log(`${tag} issue created: ${issueId}`);
    const sendResult = await sendNewsletter(issueId);
    console.log(`${tag} send: ${sendResult.status}`);
    return { issueId, status: "ok" };
  } catch (err) {
    const error = String(err).slice(0, 500);
    console.error(`${tag} failed: ${error}`);
    return { status: "error", error };
  }
};
