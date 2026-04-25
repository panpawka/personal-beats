/**
 * Daily applyFeedbackJob (cron ~03:15).
 *
 * For each ACTIVE beat with recent feedback, runs the Designer in
 * feedback-learning mode (phase=RELEVANCE) via the shared driver. We run
 * runPhaseTick directly in-process (not via driveAgentJob) because:
 *   - RELEVANCE is short (minute-scale), no re-enqueue cycles expected.
 *   - Sequential per-beat bounds CMA load.
 *
 * If a tick returns reenqueue (rare — a single Designer turn > MAX_TICK_MS),
 * we requeue this one beat on driveAgentJob to finish asynchronously.
 */
import type { ApplyFeedbackJob } from "wasp/server/jobs";
import { driveAgentJob } from "wasp/server/jobs";
import { runPhaseTick } from "../agents/drive.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const applyFeedback: ApplyFeedbackJob<
  Record<string, never>,
  { processed: number; skipped: number }
> = async (_args, context) => {
  const since = new Date(Date.now() - ONE_DAY_MS);
  const beats = await context.entities.Beat.findMany({
    where: { status: "ACTIVE" },
  });

  let processed = 0;
  let skipped = 0;

  for (const beat of beats) {
    const items = await context.entities.IssueItem.findMany({
      where: {
        feedback: { not: null },
        feedbackAt: { gte: since },
        issue: { beatId: beat.id },
      },
      select: {
        headline: true,
        primarySourceUrl: true,
        feedback: true,
      },
    });

    if (items.length === 0) {
      skipped += 1;
      continue;
    }

    const batch = items.map((it) => ({
      item_headline: it.headline,
      source_url: it.primarySourceUrl,
      feedback:
        it.feedback === "POSITIVE" ? ("up" as const) : ("down" as const),
    }));

    try {
      const verdict = await runPhaseTick({
        beatId: beat.id,
        phase: "RELEVANCE",
        kickoff: true,
        kickoffPayload: { feedback_batch: batch },
      });
      if (verdict.state === "reenqueue") {
        await driveAgentJob.submit(
          {
            beatId: beat.id,
            phase: "RELEVANCE",
            kickoff: false,
          },
          { singletonKey: `drive-${beat.id}` },
        );
        console.log(`[applyFeedback:${beat.slug}] re-enqueued to driveAgentJob`);
      } else if (verdict.state === "failed") {
        console.error(
          `[applyFeedback:${beat.slug}] failed: ${verdict.error}`,
        );
        continue;
      }
      processed += 1;
      console.log(
        `[applyFeedback:${beat.slug}] applied ${batch.length} items`,
      );
    } catch (err) {
      console.error(`[applyFeedback:${beat.slug}] threw: ${err}`);
    }
  }

  return { processed, skipped };
};
