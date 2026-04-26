/**
 * pg-boss worker that drives the DESIGNER and SCOUT phases to completion.
 *
 * Each tick runs runPhaseTick for a bounded window (~10 min worst case) and
 * returns a verdict. This worker translates the verdict into the next
 * pg-boss enqueue — either a re-enqueue of itself or a transition to the
 * next phase. The EDITOR phase runs on generateIssueJob so the publish-issue
 * payload can be persisted + emailed in the same worker.
 *
 * singletonKey = `drive-${beatId}` guarantees at most one active/queued tick
 * per beat, superseding the old in-memory activeDrivers Set.
 */
import type { DriveAgentJob } from "wasp/server/jobs";
import { driveAgentJob } from "wasp/server/jobs";
import { prisma } from "wasp/server";
import { runPhaseTick, type AgentPhase } from "../agents/drive.js";

// Kickoff payloads for DESIGNER/SCOUT/EDITOR are derived from Beat state,
// so we don't need to pass kickoffPayload through pg-boss.
type Args = {
  beatId: string;
  phase: AgentPhase;
  kickoff?: boolean;
};

export const driveAgent: DriveAgentJob<
  Args,
  { state: string; error?: string }
> = async ({ beatId, phase, kickoff }) => {
  const tag = `[driveAgent:${phase}:${beatId}]`;
  const verdict = await runPhaseTick({
    beatId,
    phase,
    kickoff,
  });

  if (verdict.state === "reenqueue") {
    console.log(`${tag} re-enqueue`);
    // Intentionally NO singletonKey on self-re-enqueue. pg-boss drops a
    // submit that shares a key with a still-active job, which would strand
    // the beat mid-phase. External submits (from actions / sweeper) keep
    // the key to prevent stacking.
    await driveAgentJob.submit({ beatId, phase, kickoff: false });
    return { state: "reenqueue" };
  }

  if (verdict.state === "waiting_for_user") {
    console.log(`${tag} waiting for user reply`);
    return { state: "waiting_for_user" };
  }

  if (verdict.state === "failed") {
    console.error(`${tag} failed: ${verdict.error}`);
    return { state: "failed", error: verdict.error };
  }

  // phase_done → drive the next phase if this was DESIGNER. SCOUT has no
  // successor. No singletonKey — see note above.
  if (phase === "DESIGNER") {
    console.log(`${tag} finalized → enqueue SCOUT`);
    await driveAgentJob.submit({ beatId, phase: "SCOUT", kickoff: true });
  } else {
    // Clear phase cursor so the next trigger (EDITOR on-demand) starts from
    // a clean slate. Leaving stale currentPhase="SCOUT" is a trap even
    // though ensureSession overwrites it.
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
    console.log(`${tag} phase_done`);
  }
  return { state: "phase_done" };
};
