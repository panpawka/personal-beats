/**
 * Phase 11 — applyFeedbackJob worker (cron: daily ~03:15).
 *
 * For each ACTIVE beat, finds IssueItem rows with feedback recorded in the
 * last 24h and feeds them to the Designer agent in feedback-learning mode.
 * The agent appends "Learned from feedback" entries to relevance.md so the
 * next Editor session weights items differently.
 *
 * Sequential per-beat to keep CMA load bounded — these are minute-scale
 * sessions, parallelizing 50+ beats would burn quota.
 */
import type { ApplyFeedbackJob } from "wasp/server/jobs";
import { updateRelevanceSession } from "../agents/orchestrator.js";

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
      feedback: it.feedback === "POSITIVE" ? ("up" as const) : ("down" as const),
    }));

    try {
      await updateRelevanceSession(beat.id, batch);
      processed += 1;
      console.log(`[applyFeedback:${beat.slug}] applied ${batch.length} items`);
    } catch (err) {
      console.error(`[applyFeedback:${beat.slug}] failed: ${err}`);
    }
  }

  return { processed, skipped };
};
