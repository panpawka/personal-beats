/**
 * Phase 11 — scheduleSweeperJob worker (cron: every minute).
 *
 * Pattern B per PLAN: instead of one pg-boss schedule per beat, one global
 * sweeper finds all ACTIVE TIME_BASED beats whose cron is due and submits
 * generateIssueJob for each. "Due" means cron-parser's next() relative to
 * lastScheduledAt is <= now. On-demand runs do NOT bump lastScheduledAt,
 * so the cron schedule isn't perturbed by manual triggers.
 *
 * singletonKey=beatId on submit prevents double-firing if a previous tick's
 * generateIssueJob is still queued/running for the same beat.
 */
import type { ScheduleSweeperJob } from "wasp/server/jobs";
import { CronExpressionParser } from "cron-parser";
import { generateIssueJob } from "wasp/server/jobs";

export const scheduleSweeper: ScheduleSweeperJob<
  Record<string, never>,
  { fired: number; checked: number }
> = async (_args, context) => {
  const now = new Date();
  const beats = await context.entities.Beat.findMany({
    where: {
      status: "ACTIVE",
      cadenceType: "TIME_BASED",
      cronExpression: { not: null },
    },
  });

  let fired = 0;
  for (const beat of beats) {
    if (!beat.cronExpression) continue;
    // Anchor to lastScheduledAt if set, otherwise to beat.createdAt — that
    // way a freshly-activated beat fires on its first scheduled tick rather
    // than immediately.
    const anchor = beat.lastScheduledAt ?? beat.createdAt;
    let nextFire: Date;
    try {
      nextFire = CronExpressionParser.parse(beat.cronExpression, {
        currentDate: anchor,
        tz: beat.timezone,
      })
        .next()
        .toDate();
    } catch (err) {
      console.error(`[sweeper:${beat.slug}] bad cron "${beat.cronExpression}": ${err}`);
      continue;
    }
    if (nextFire > now) continue;

    // Bump first so a re-entrant tick doesn't double-submit. If submit fails
    // the bump is preserved — better to skip a fire than send twice.
    await context.entities.Beat.update({
      where: { id: beat.id },
      data: { lastScheduledAt: now },
    });

    try {
      // submit's 2nd arg is pg-boss's SendOptions directly. singletonKey
      // ensures only one queued/active generateIssueJob per beat at a time
      // — guards against re-entrant sweeper ticks double-submitting.
      await generateIssueJob.submit(
        { beatId: beat.id },
        { singletonKey: beat.id },
      );
      fired += 1;
      console.log(`[sweeper] fired generateIssueJob for ${beat.slug} (due ${nextFire.toISOString()})`);
    } catch (err) {
      console.error(`[sweeper:${beat.slug}] submit failed: ${err}`);
    }
  }

  return { fired, checked: beats.length };
};
