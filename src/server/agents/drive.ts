/**
 * Unified agent-phase driver.
 *
 * One bounded tick against a CMA session:
 *   1. Ensure a session exists for the phase (provision on first run).
 *   2. Drain any pending AgentMessage rows into the session.
 *   3. Send the phase kickoff user.message if this is the first tick.
 *   4. Fetch events.list, persist new ones to AgentEvent, run tool handlers.
 *   5. Return a verdict — the caller (driveAgentJob or generateIssue) decides
 *      whether to re-enqueue, transition phase, or finish.
 *
 * All state persists to Postgres between ticks:
 *   - Beat.{currentPhase, currentSessionId, lastEventId, status}
 *   - AgentEvent rows (source of truth for UI transcript)
 *   - AgentMessage rows (inbox for user-originated messages)
 *
 * No HTTP streaming. No in-memory mutex. pg-boss singletonKey enforces
 * one-driver-per-beat.
 */
import type { Beat } from "wasp/entities";
import { prisma } from "wasp/server";
import {
  archiveSession,
  createMemoryStore,
  createSession,
  listSessionEvents,
  sendSessionEvents,
  streamSessionEvents,
  type AgentRef,
  type ListedEvent,
  type MemoryStoreResource,
} from "./client.js";
import {
  FinalizeBeatSpecSchema,
  NeedsClarificationSchema,
  PublishIssueSchema,
  ScoutCompleteSchema,
} from "../../shared/types.js";

// -------- Phase + verdict --------

export type AgentPhase = "DESIGNER" | "SCOUT" | "EDITOR";

export type DriveVerdict =
  // Phase still active, CMA session still running — caller should re-enqueue.
  | { state: "reenqueue" }
  // DESIGNER paused on needs_clarification. No re-enqueue; next tick fires
  // when submitClarification writes an AgentMessage.
  | { state: "waiting_for_user" }
  // Phase finished successfully. Caller decides next step (phase transition
  // or write Issue for EDITOR).
  | { state: "phase_done" }
  // Terminal failure. Beat already flipped to FAILED; caller logs and exits.
  | { state: "failed"; error: string };

// -------- Env --------

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}
function envInt(name: string): number {
  const n = Number.parseInt(env(name), 10);
  if (!Number.isFinite(n)) throw new Error(`${name} is not a valid integer`);
  return n;
}

const ENVIRONMENT_ID = () => env("ENVIRONMENT_ID");
const GLOBAL_PATTERNS_STORE_ID = () => env("GLOBAL_PATTERNS_STORE_ID");
const BEAT_DESIGNER_AGENT_ID = () => env("BEAT_DESIGNER_AGENT_ID");
const BEAT_DESIGNER_VERSION = () => envInt("BEAT_DESIGNER_VERSION");
const SOURCES_SCOUT_AGENT_ID = () => env("SOURCES_SCOUT_AGENT_ID");
const SOURCES_SCOUT_VERSION = () => envInt("SOURCES_SCOUT_VERSION");
const EDITOR_AGENT_ID = () => env("EDITOR_AGENT_ID");
const EDITOR_VERSION = () => envInt("EDITOR_VERSION");

// -------- Tick bounds --------

const MAX_TICK_MS = 20 * 60 * 1000;
const LIST_LIMIT = 100;
// Fail-safe: after this many consecutive reenqueues without ingesting any
// fresh events, mark the phase failed and clear state. Prevents zombie
// sessions from pinning the UI in a "running" state forever.
const MAX_REENQUEUES = 8;

// -------- Entry point --------

export type RunPhaseArgs = {
  beatId: string;
  phase: AgentPhase;
  kickoff?: boolean;
  // Phase-specific payload for the kickoff user.message. The driver builds
  // its own kickoff from Beat + slug for all phases; this hook is reserved
  // for future per-phase extras.
  kickoffPayload?: Record<string, unknown>;
};

export async function runPhaseTick(args: RunPhaseArgs): Promise<DriveVerdict> {
  const beat = await loadBeat(args.beatId);

  try {
    await ensureMemoryStores(beat);
    // Reload to pick up memory-store ids.
    const withStores = await loadBeat(args.beatId);

    const session = await ensureSession(withStores, args);

    if (args.kickoff) {
      await resetReenqueueCount(args.beatId);
    }

    // Re-attach path: a prior tick may have already captured the phase's
    // terminal signal (e.g. EDITOR publish_issue persisted) but crashed or
    // expired before verdictForEndOfTurn returned. Detect from DB state
    // instead of waiting for a session.status_idle event we may have already
    // advanced the cursor past.
    if (!args.kickoff) {
      const persisted = await detectPersistedTerminal(
        args.beatId,
        args.phase,
        session.id,
      );
      if (persisted) return persisted;
    }

    // Stream-first ordering (skill Pattern 7): open the SSE stream BEFORE
    // any send, so events triggered by drain/kickoff are guaranteed to land
    // on this consumer rather than buffer/drop.
    const stream = await streamSessionEvents(session.id);
    const startedAt = Date.now();
    const tickAbort = setTimeout(
      () => stream.controller.abort(),
      MAX_TICK_MS,
    );

    try {
      await drainPendingMessages(session.id);

      if (args.kickoff) {
        await sendKickoff(withStores, session.id, args);
        await emitSynthetic(
          withStores.id,
          args.phase,
          session.id,
          "phase.started",
          { kickoff: true },
        );
      }

      const toolsById = new Map<string, TrackedTool>();
      const seen = new Set<string>();
      let madeProgress = false;

      // Pattern 1: drain server-side history first (covers any events emitted
      // between the cursor and stream-open), then dedupe live stream against
      // it via `seen`.
      const history = await listSessionEvents(session.id, { limit: LIST_LIMIT });
      const fresh = await filterPastCursor(
        await loadBeat(args.beatId),
        history,
      );
      if (fresh.length > 0) madeProgress = true;
      for (const ev of fresh) {
        if (ev.id) seen.add(ev.id);
        const verdict = await processEvent(
          args.beatId,
          args.phase,
          session.id,
          ev,
          toolsById,
        );
        if (verdict) return verdict;
      }

      // Tail the live stream until terminal verdict, MAX_TICK_MS abort, or
      // server closes.
      try {
        for await (const ev of stream) {
          const id = (ev as { id?: string }).id;
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          madeProgress = true;
          const verdict = await processEvent(
            args.beatId,
            args.phase,
            session.id,
            ev,
            toolsById,
          );
          if (verdict) return verdict;
        }
      } catch (err) {
        // Abort fires when MAX_TICK_MS elapses; any other stream error means
        // the connection dropped. Both reduce to "this tick is over, hand off
        // to the next one" — the next tick re-opens with the same Pattern 1
        // history-backfill safety net.
        if (Date.now() - startedAt > MAX_TICK_MS - 1000) {
          return reenqueueOrFail(args.beatId, args.phase, madeProgress);
        }
        throw err;
      }

      // Stream closed cleanly without a terminal verdict — re-enqueue.
      return reenqueueOrFail(args.beatId, args.phase, madeProgress);
    } finally {
      clearTimeout(tickAbort);
      // Iterator-return cleanup: SDK aborts on `for await` early-exit, but be
      // explicit in case we left through a different code path.
      try {
        stream.controller.abort();
      } catch {
        // already aborted
      }
    }
  } catch (err) {
    const error = errorMessage(err);
    await markFailed(args.beatId, args.phase, error);
    return { state: "failed", error };
  }
}

// -------- Terminal detection on re-attach --------

/**
 * If a prior tick already captured the phase's terminal marker but failed
 * to return the matching verdict (crashed between cursor advance and
 * handleIdle, pg-boss expireInMinutes hit, etc.), surface phase_done here
 * instead of polling CMA forever.
 */
async function detectPersistedTerminal(
  beatId: string,
  phase: AgentPhase,
  sessionId: string,
): Promise<DriveVerdict | null> {
  if (phase === "EDITOR") {
    const publish = await prisma.agentEvent.findFirst({
      where: { beatId, sessionId, type: "editor.publish_issue" },
      select: { id: true },
    });
    if (publish) return { state: "phase_done" };
    return null;
  }

  if (phase === "DESIGNER") {
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      select: { status: true },
    });
    if (beat?.status === "SCOUTING") return { state: "phase_done" };
    if (beat?.status === "AWAITING_CLARIFICATION") {
      return { state: "waiting_for_user" };
    }
    return null;
  }

  if (phase === "SCOUT") {
    const beat = await prisma.beat.findUnique({
      where: { id: beatId },
      select: { status: true },
    });
    if (beat?.status === "ACTIVE") return { state: "phase_done" };
    return null;
  }

  return null;
}

// -------- Reenqueue bookkeeping --------

async function reenqueueOrFail(
  beatId: string,
  phase: AgentPhase,
  madeProgress: boolean,
): Promise<DriveVerdict> {
  if (madeProgress) {
    await resetReenqueueCount(beatId);
    return { state: "reenqueue" };
  }
  const beat = await prisma.beat.update({
    where: { id: beatId },
    data: { reenqueueCount: { increment: 1 } },
    select: { reenqueueCount: true },
  });
  if (beat.reenqueueCount > MAX_REENQUEUES) {
    const error = `phase ${phase} reenqueued ${beat.reenqueueCount}x without progress`;
    await markFailed(beatId, phase, error);
    await resetReenqueueCount(beatId);
    return { state: "failed", error };
  }
  return { state: "reenqueue" };
}

async function resetReenqueueCount(beatId: string): Promise<void> {
  await prisma.beat
    .update({
      where: { id: beatId },
      data: { reenqueueCount: 0 },
    })
    .catch(() => void 0);
}

// -------- Memory store provisioning --------

async function ensureMemoryStores(beat: Beat): Promise<void> {
  if (beat.specMemoryStoreId && beat.historyMemoryStoreId) return;
  const [spec, history] = await Promise.all([
    beat.specMemoryStoreId
      ? Promise.resolve({ id: beat.specMemoryStoreId })
      : createMemoryStore(
          `beat_${beat.slug}_spec`,
          "Per-beat spec + sources + relevance rules. Contains /spec.yaml, /sources.yaml, /relevance.md.",
        ),
    beat.historyMemoryStoreId
      ? Promise.resolve({ id: beat.historyMemoryStoreId })
      : createMemoryStore(
          `beat_${beat.slug}_history`,
          "Per-beat issue history. Contains /issues/YYYY-MM-DD.md and /fingerprints.jsonl.",
        ),
  ]);
  await prisma.beat.update({
    where: { id: beat.id },
    data: {
      specMemoryStoreId: spec.id,
      historyMemoryStoreId: history.id,
    },
  });
}

// -------- Session provisioning --------

async function ensureSession(
  beat: Beat,
  args: RunPhaseArgs,
): Promise<{ id: string }> {
  // Re-attach if the beat already has an active session for this phase.
  if (
    beat.currentSessionId &&
    beat.currentPhase === args.phase &&
    !args.kickoff
  ) {
    return { id: beat.currentSessionId };
  }

  // Fresh kickoff: provision a new CMA session with phase-appropriate
  // resource mounts. Pin agent to a specific version so a freshly-published
  // agent revision can't break in-flight sessions mid-run.
  const resources = resourcesForPhase(beat, args.phase);
  const session = await createSession({
    agent: agentRefForPhase(args.phase),
    environment_id: ENVIRONMENT_ID(),
    title: `${args.phase.toLowerCase()} ${beat.slug}`,
    resources,
  });

  await prisma.beat.update({
    where: { id: beat.id },
    data: {
      currentPhase: args.phase,
      currentSessionId: session.id,
      lastEventId: null,
      status: statusForPhaseStart(args.phase, beat.status),
    },
  });

  return session;
}

function agentRefForPhase(phase: AgentPhase): AgentRef {
  switch (phase) {
    case "DESIGNER":
      return {
        type: "agent",
        id: BEAT_DESIGNER_AGENT_ID(),
        version: BEAT_DESIGNER_VERSION(),
      };
    case "SCOUT":
      return {
        type: "agent",
        id: SOURCES_SCOUT_AGENT_ID(),
        version: SOURCES_SCOUT_VERSION(),
      };
    case "EDITOR":
      return {
        type: "agent",
        id: EDITOR_AGENT_ID(),
        version: EDITOR_VERSION(),
      };
  }
}

function resourcesForPhase(beat: Beat, phase: AgentPhase): MemoryStoreResource[] {
  const spec = beat.specMemoryStoreId;
  const history = beat.historyMemoryStoreId;
  if (!spec || !history) {
    throw new Error(`beat ${beat.id} missing memory stores`);
  }
  const globalPatterns = GLOBAL_PATTERNS_STORE_ID();

  switch (phase) {
    case "DESIGNER":
      return [
        {
          type: "memory_store",
          memory_store_id: spec,
          access: "read_write",
          instructions:
            "Your beat's spec store. Write spec.yaml and relevance.md inside this mount.",
        },
        {
          type: "memory_store",
          memory_store_id: globalPatterns,
          access: "read_only",
          instructions:
            "Cross-beat patterns for reference. Read only — do not write here in this session.",
        },
      ];
    case "SCOUT":
      return [
        {
          type: "memory_store",
          memory_store_id: spec,
          access: "read_write",
          instructions:
            "Beat spec store. Read spec.yaml, then write sources.yaml inside this mount.",
        },
        {
          type: "memory_store",
          memory_store_id: globalPatterns,
          access: "read_write",
          instructions:
            "Cross-beat source-discovery tactics. Read before scouting; may append new generalizable tactics.",
        },
      ];
    case "EDITOR":
      return [
        {
          type: "memory_store",
          memory_store_id: spec,
          access: "read_write",
          instructions:
            "Beat spec store. Read spec.yaml, relevance.md, and sources.yaml inside this mount.",
        },
        {
          type: "memory_store",
          memory_store_id: history,
          access: "read_write",
          instructions:
            "Issue history store. Skim issues/ for last 7 days; append the new issue here after publish_issue.",
        },
        {
          type: "memory_store",
          memory_store_id: globalPatterns,
          access: "read_only",
          instructions: "Reference only.",
        },
      ];
  }
}

function statusForPhaseStart(
  phase: AgentPhase,
  currentStatus: string,
): string {
  switch (phase) {
    case "DESIGNER":
      return "DESIGNING";
    case "SCOUT":
      return "SCOUTING";
    // EDITOR does not change the Beat.status — Beat stays ACTIVE
    // throughout the issue-generation cycle.
    case "EDITOR":
      return currentStatus;
  }
}

// -------- Kickoff payload --------

async function sendKickoff(
  beat: Beat,
  sessionId: string,
  args: RunPhaseArgs,
): Promise<void> {
  const payload = kickoffPayload(beat, args);
  await sendSessionEvents(sessionId, [
    {
      type: "user.message",
      content: [{ type: "text", text: JSON.stringify(payload) }],
    },
  ]);
}

function kickoffPayload(
  beat: Beat,
  args: RunPhaseArgs,
): Record<string, unknown> {
  switch (args.phase) {
    case "DESIGNER":
      return {
        action: "design_beat",
        brief: beat.brief,
        beat_slug: beat.slug,
        user_choices: {
          cadence: {
            type:
              beat.cadenceType === "ON_DEMAND" ? "on_demand" : "time_based",
            cron: beat.cronExpression,
            timezone: beat.timezone,
          },
          depth: beat.depth.toLowerCase(),
          output_language: beat.outputLanguage,
        },
      };
    case "SCOUT":
      return {
        action: "scout_sources",
        beat_slug: beat.slug,
        output_language: beat.outputLanguage,
      };
    case "EDITOR":
      return {
        action: "generate_issue",
        beat_slug: beat.slug,
        as_of: new Date().toISOString(),
        output_language: beat.outputLanguage,
      };
  }
}

// -------- Pending-message drain --------

async function drainPendingMessages(sessionId: string): Promise<void> {
  const pending = await prisma.agentMessage.findMany({
    where: { sessionId, consumedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) return;
  for (const m of pending) {
    await sendSessionEvents(sessionId, [
      {
        type: "user.message",
        content: [{ type: "text", text: m.text }],
      },
    ]);
    await prisma.agentMessage.update({
      where: { id: m.id },
      data: { consumedAt: new Date() },
    });
  }
}

// -------- Event processing --------

type TrackedTool = {
  id: string;
  name: string;
  input: unknown;
};

async function filterPastCursor(
  beat: Beat,
  events: ListedEvent[],
): Promise<ListedEvent[]> {
  if (!beat.lastEventId) return events;
  const cursor = beat.lastEventId;
  // Find the cursor and keep only events AFTER it. If not found (backlog >
  // LIST_LIMIT or CMA rotated), fall back to letting the unique index on
  // AgentEvent dedupe — return all and rely on persistEvent's upsert.
  const idx = events.findIndex((e) => e.id === cursor);
  if (idx === -1) return events;
  return events.slice(idx + 1);
}

async function processEvent(
  beatId: string,
  phase: AgentPhase,
  sessionId: string,
  ev: ListedEvent,
  toolsById: Map<string, TrackedTool>,
): Promise<DriveVerdict | null> {
  const type = String(ev.type ?? "unknown");

  if (type === "agent.message") {
    const text = extractText(ev);
    if (text) {
      const uiType =
        phase === "DESIGNER"
          ? "designer.thinking"
          : phase === "SCOUT"
            ? "scout.progress"
            : "editor.thinking";
      await persistEvent(beatId, phase, sessionId, ev, uiType, {
        message: text,
      });
    } else {
      await persistEvent(beatId, phase, sessionId, ev, type, {});
    }
    return null;
  }

  if (type === "agent.thinking") {
    // Progress signal only (no content per SDK type). Persist as a phase-tagged
    // thinking pulse the UI can render as a "still working" beat.
    const uiType =
      phase === "DESIGNER"
        ? "designer.thinking_pulse"
        : phase === "SCOUT"
          ? "scout.thinking_pulse"
          : "editor.thinking_pulse";
    await persistEvent(beatId, phase, sessionId, ev, uiType, {});
    return null;
  }

  if (type === "span.model_request_end") {
    // Token-usage telemetry for cost tracking. One event per model call;
    // sum these per beat for billing/cap decisions.
    const usage = (ev as { model_usage?: Record<string, unknown> }).model_usage;
    await persistEvent(beatId, phase, sessionId, ev, "span.model_request_end", {
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 0,
      speed: usage?.speed ?? null,
      isError: Boolean((ev as { is_error?: unknown }).is_error),
    });
    return null;
  }

  if (type === "agent.custom_tool_use") {
    const id = String((ev as { id?: unknown }).id ?? "");
    const name = String((ev as { name?: unknown }).name ?? "");
    if (id && name) {
      toolsById.set(id, {
        id,
        name,
        input: (ev as { input?: unknown }).input,
      });
    }
    await persistEvent(beatId, phase, sessionId, ev, type, {
      toolName: name,
    });
    return null;
  }

  if (type === "session.error") {
    const err = `session.error: ${JSON.stringify(
      (ev as { error?: unknown }).error ?? ev,
    ).slice(0, 300)}`;
    await persistEvent(beatId, phase, sessionId, ev, "beat.failed", {
      error: err,
    });
    await markFailed(beatId, phase, err);
    return { state: "failed", error: err };
  }

  if (type === "session.status_terminated" || type === "session.deleted") {
    const err = `${type}`;
    await persistEvent(beatId, phase, sessionId, ev, "beat.failed", {
      error: err,
    });
    await markFailed(beatId, phase, err);
    return { state: "failed", error: err };
  }

  if (type === "session.status_idle") {
    await persistEvent(beatId, phase, sessionId, ev, type, {});
    return handleIdle(beatId, phase, sessionId, ev, toolsById);
  }

  // Unknown / pass-through — persist so UI has full transcript, no verdict.
  await persistEvent(beatId, phase, sessionId, ev, type, {});
  return null;
}

function extractText(ev: ListedEvent): string | null {
  const content = (ev as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  for (const c of content) {
    if (
      c &&
      typeof c === "object" &&
      (c as { type?: unknown }).type === "text" &&
      typeof (c as { text?: unknown }).text === "string"
    ) {
      return (c as { text: string }).text;
    }
  }
  return null;
}

async function handleIdle(
  beatId: string,
  phase: AgentPhase,
  sessionId: string,
  ev: ListedEvent,
  toolsById: Map<string, TrackedTool>,
): Promise<DriveVerdict | null> {
  const stopReason = (ev as { stop_reason?: { type?: string; event_ids?: string[] } })
    .stop_reason;
  const stopType = stopReason?.type;

  if (stopType === "end_turn") {
    return verdictForEndOfTurn(beatId, phase);
  }

  if (stopType === "retries_exhausted") {
    // Terminal failure: the agent loop exhausted its internal retry budget
    // (model overload, repeated tool failures). Don't re-enqueue — that just
    // re-attaches to the same dead session.
    const err = "session retries exhausted";
    await markFailed(beatId, phase, err);
    return { state: "failed", error: err };
  }

  if (stopType !== "requires_action") {
    // Still running — the session is idle but will resume. Re-enqueue so we
    // don't spin uselessly in this tick.
    return { state: "reenqueue" };
  }

  for (const eventId of stopReason?.event_ids ?? []) {
    const tool = toolsById.get(eventId);
    if (!tool) continue;
    const verdict = await handleTool(beatId, phase, sessionId, eventId, tool);
    if (verdict) return verdict;
  }
  return null;
}

async function verdictForEndOfTurn(
  beatId: string,
  phase: AgentPhase,
): Promise<DriveVerdict> {
  const beat = await loadBeat(beatId);

  if (phase === "DESIGNER") {
    // If we captured a finalize during this tick, beat.status is now SCOUTING.
    if (beat.status === "SCOUTING") return { state: "phase_done" };
    if (beat.status === "AWAITING_CLARIFICATION") {
      return { state: "waiting_for_user" };
    }
    const err = "Designer ended turn without finalize or clarification";
    await markFailed(beatId, phase, err);
    return { state: "failed", error: err };
  }

  if (phase === "SCOUT") {
    if (beat.status === "ACTIVE") {
      await emitSynthetic(beatId, phase, beat.currentSessionId ?? "", "beat.ready", {
        beatId,
      });
      return { state: "phase_done" };
    }
    const err = "Scout ended turn without scout_complete";
    await markFailed(beatId, phase, err);
    return { state: "failed", error: err };
  }

  // EDITOR end_turn with publish_issue persisted = phase_done. Caller
  // reads the latest AgentEvent of type editor.publish_issue to get payload.
  const hasPublish = await prisma.agentEvent.count({
    where: {
      beatId,
      sessionId: beat.currentSessionId ?? "",
      type: "editor.publish_issue",
    },
  });
  if (hasPublish > 0) return { state: "phase_done" };
  const err = "Editor ended turn without publish_issue";
  return { state: "failed", error: err };
}

async function handleTool(
  beatId: string,
  phase: AgentPhase,
  sessionId: string,
  eventId: string,
  tool: TrackedTool,
): Promise<DriveVerdict | null> {
  if (phase === "DESIGNER" && tool.name === "needs_clarification") {
    const parsed = NeedsClarificationSchema.safeParse(tool.input);
    if (!parsed.success) {
      await replyTool(sessionId, eventId, tool, {
        ok: false,
        error: "invalid needs_clarification payload",
      });
      return null;
    }
    await prisma.beat.update({
      where: { id: beatId },
      data: {
        status: "AWAITING_CLARIFICATION",
        pendingClarification: JSON.stringify({
          questions: parsed.data.questions,
          reasoning: parsed.data.reasoning,
          sessionId,
        }),
      },
    });
    await replyTool(sessionId, eventId, tool, { ok: true });
    await emitSynthetic(
      beatId,
      phase,
      sessionId,
      "designer.needs_clarification",
      {
        questions: parsed.data.questions,
        reasoning: parsed.data.reasoning,
        sessionId,
      },
    );
    return { state: "waiting_for_user" };
  }

  if (phase === "DESIGNER" && tool.name === "finalize_beat_spec") {
    const parsed = FinalizeBeatSpecSchema.safeParse(tool.input);
    if (!parsed.success) {
      await replyTool(sessionId, eventId, tool, {
        ok: false,
        error: "invalid finalize_beat_spec payload",
      });
      return null;
    }
    await prisma.beat.update({
      where: { id: beatId },
      data: {
        status: "SCOUTING",
        summary: parsed.data.summary,
        defaultsApplied: JSON.stringify(parsed.data.defaults_applied),
        pendingClarification: null,
      },
    });
    await replyTool(sessionId, eventId, tool, { ok: true });
    await emitSynthetic(beatId, phase, sessionId, "designer.finalized", {
      summary: parsed.data.summary,
      defaultsApplied: parsed.data.defaults_applied,
    });
    return null;
  }

  if (phase === "SCOUT" && tool.name === "scout_complete") {
    const parsed = ScoutCompleteSchema.safeParse(tool.input);
    if (!parsed.success) {
      await replyTool(sessionId, eventId, tool, {
        ok: false,
        error: "invalid scout_complete payload",
      });
      return null;
    }

    // Threshold override: agent self-grading is unreliable. If distinct
    // domains fall below MIN_DOMAINS_HEALTHY, downgrade a "healthy" claim
    // to "sparse" so the UI shows the honest assessment. Optional fields
    // default to safe-sparse values for old in-flight payloads.
    const MIN_DOMAINS_HEALTHY = 5;
    const distinctDomains = parsed.data.distinct_domains ?? 0;
    const recipesUsed = parsed.data.recipes_used ?? [];
    const categoriesCovered = parsed.data.categories_covered ?? [];
    let coverageAssessment = parsed.data.coverage_assessment;
    let thinnessReason = parsed.data.thinness_reason ?? null;
    if (
      distinctDomains < MIN_DOMAINS_HEALTHY &&
      coverageAssessment === "healthy"
    ) {
      coverageAssessment = "sparse";
      thinnessReason ??= `Only ${distinctDomains} distinct domains; below threshold ${MIN_DOMAINS_HEALTHY}.`;
    }

    await prisma.beat.update({
      where: { id: beatId },
      data: {
        status: "ACTIVE",
        sourceCount: parsed.data.source_count,
        coverageAssessment,
        coverageNote: parsed.data.notes,
      },
    });
    await replyTool(sessionId, eventId, tool, { ok: true });
    await emitSynthetic(beatId, phase, sessionId, "scout.complete", {
      sourceCount: parsed.data.source_count,
      coverage: coverageAssessment,
      note: parsed.data.notes,
      distinctDomains,
      categoriesCovered,
      recipesUsed,
      thinnessReason,
    });
    return null;
  }

  if (phase === "EDITOR" && tool.name === "publish_issue") {
    const parsed = PublishIssueSchema.safeParse(tool.input);
    if (!parsed.success) {
      await replyTool(sessionId, eventId, tool, {
        ok: false,
        error: `invalid publish_issue: ${parsed.error.message.slice(0, 200)}`,
      });
      return null;
    }
    await replyTool(sessionId, eventId, tool, { ok: true });
    // Persist captured payload for the caller (generateIssue job) to read
    // after the phase completes. eventId stored as the CMA tool_use id so
    // re-runs don't duplicate.
    await prisma.agentEvent.upsert({
      where: {
        sessionId_eventId: { sessionId, eventId: `publish:${eventId}` },
      },
      update: {},
      create: {
        beatId,
        sessionId,
        phase,
        eventId: `publish:${eventId}`,
        type: "editor.publish_issue",
        payload: JSON.stringify(parsed.data),
      },
    });
    return null;
  }

  // Unknown tool for this phase — reject to unblock.
  await replyTool(sessionId, eventId, tool, {
    ok: false,
    error: `unexpected tool for ${phase}: ${tool.name}`,
  });
  return null;
}

// -------- Persistence helpers --------

async function persistEvent(
  beatId: string,
  phase: AgentPhase,
  sessionId: string,
  ev: ListedEvent,
  uiType: string,
  extras: Record<string, unknown>,
): Promise<void> {
  const rawId = typeof ev.id === "string" ? ev.id : null;
  if (!rawId) {
    // No dedup key — skip persistence (we only persist with a stable id to
    // avoid duplicate rows when the list endpoint returns overlapping pages).
    return;
  }
  await prisma.agentEvent
    .upsert({
      where: { sessionId_eventId: { sessionId, eventId: rawId } },
      update: {},
      create: {
        beatId,
        sessionId,
        phase,
        eventId: rawId,
        type: uiType,
        payload: JSON.stringify(extras),
      },
    })
    .catch(() => void 0);
  // Advance cursor regardless of upsert outcome.
  await prisma.beat.update({
    where: { id: beatId },
    data: { lastEventId: rawId },
  });
}

async function emitSynthetic(
  beatId: string,
  phase: AgentPhase,
  sessionId: string,
  type: string,
  extras: Record<string, unknown>,
): Promise<void> {
  await prisma.agentEvent.create({
    data: {
      beatId,
      sessionId,
      phase,
      eventId: null,
      type,
      payload: JSON.stringify(extras),
    },
  });
}

async function replyTool(
  sessionId: string,
  eventId: string,
  _tool: TrackedTool,
  payload: unknown,
): Promise<void> {
  await sendSessionEvents(sessionId, [
    {
      type: "user.custom_tool_result",
      custom_tool_use_id: eventId,
      content: [{ type: "text", text: JSON.stringify(payload) }],
    },
  ]);
}

async function markFailed(
  beatId: string,
  phase: AgentPhase,
  error: string,
): Promise<void> {
  console.error(`[drive] beat=${beatId} phase=${phase} failed: ${error}`);
  const beat = await prisma.beat
    .update({
      where: { id: beatId },
      data: { status: "FAILED" },
      select: { currentSessionId: true },
    })
    .catch(() => null);
  // Archive the dead CMA session so they don't accumulate. Best-effort: a
  // session may already be terminated/archived; swallow the resulting 4xx.
  if (beat?.currentSessionId) {
    await archiveSession(beat.currentSessionId).catch(() => void 0);
  }
}

async function loadBeat(beatId: string): Promise<Beat> {
  const beat = await prisma.beat.findUnique({ where: { id: beatId } });
  if (!beat) throw new Error(`Beat ${beatId} not found`);
  return beat;
}

function errorMessage(err: unknown): string {
  return String(err instanceof Error ? err.message : err).slice(0, 500);
}
