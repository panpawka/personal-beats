/**
 * Server-side orchestrator for the Personal Newsroom agents.
 *
 * Each exported function is an async generator that yields typed
 * OrchestratorEvents (SSE-friendly) while performing side effects:
 *   - Provisions / uses memory stores via the CMA API
 *   - Drives a Managed Agents session to a terminal custom-tool call
 *   - Mutates the Beat row through its status machine
 *   - On publish_issue, writes Issue + IssueItem rows
 *
 * Multi-agent (Coordinator with callable_agents) is research-preview and
 * unshipped in the current API, so each phase runs in its own single-agent
 * session. Wasp drives the sequence.
 */
import type { Beat, Issue } from "wasp/entities";
import { prisma } from "wasp/server";
import {
  createMemoryStore,
  createSession,
  sendSessionEvents,
  streamSession,
} from "./client.js";
import {
  FinalizeBeatSpecSchema,
  NeedsClarificationSchema,
  PublishIssueSchema,
  PublishIssueInput,
  ScoutCompleteSchema,
} from "../../shared/types.js";

// -------- Event contract forwarded to SSE --------

export type OrchestratorEvent =
  | { type: "designer.thinking"; message: string }
  | {
      type: "designer.needs_clarification";
      questions: string[];
      reasoning: string;
      sessionId: string;
    }
  | {
      type: "designer.finalized";
      summary: string;
      defaultsApplied: string[];
    }
  | { type: "scout.progress"; note: string }
  | {
      type: "scout.complete";
      sourceCount: number;
      coverage: string;
      note: string;
    }
  | { type: "editor.thinking"; message: string }
  | { type: "editor.published"; issueId: string }
  | { type: "beat.ready"; beatId: string }
  | { type: "beat.failed"; error: string };

// -------- Env --------

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

const ENVIRONMENT_ID = () => env("ENVIRONMENT_ID");
const GLOBAL_PATTERNS_STORE_ID = () => env("GLOBAL_PATTERNS_STORE_ID");
const BEAT_DESIGNER_AGENT_ID = () => env("BEAT_DESIGNER_AGENT_ID");
const SOURCES_SCOUT_AGENT_ID = () => env("SOURCES_SCOUT_AGENT_ID");
const EDITOR_AGENT_ID = () => env("EDITOR_AGENT_ID");

// -------- Beat load helper --------

async function loadBeat(beatId: string): Promise<Beat> {
  const beat = await prisma.beat.findUnique({ where: { id: beatId } });
  if (!beat) throw new Error(`Beat ${beatId} not found`);
  return beat;
}

// =========================================================================
// createBeatSession — Designer phase
// =========================================================================

/**
 * Provisions per-beat memory stores (spec + history), starts a Designer
 * session, sends design_beat, drives to terminal (finalize_beat_spec or
 * needs_clarification). Yields typed events. Does NOT automatically run
 * Scout — call runScoutPhase after finalize if status === SCOUTING.
 *
 * Stores the spec + history store IDs and the design session id on the
 * Beat row. On needs_clarification, writes pendingClarification and flips
 * status to AWAITING_CLARIFICATION, then returns (generator ends).
 * Caller resumes via resumeBeatSession.
 */
export async function* createBeatSession(
  beatId: string,
): AsyncIterable<OrchestratorEvent> {
  const beat = await loadBeat(beatId);

  try {
    // Provision memory stores (idempotent — skip if already set)
    let { specMemoryStoreId, historyMemoryStoreId } = beat;
    if (!specMemoryStoreId || !historyMemoryStoreId) {
      const [spec, history] = await Promise.all([
        createMemoryStore(
          `beat_${beat.slug}_spec`,
          "Per-beat spec + sources + relevance rules. Contains /spec.yaml, /sources.yaml, /relevance.md.",
        ),
        createMemoryStore(
          `beat_${beat.slug}_history`,
          "Per-beat issue history. Contains /issues/YYYY-MM-DD.md and /fingerprints.jsonl.",
        ),
      ]);
      specMemoryStoreId = spec.id;
      historyMemoryStoreId = history.id;
      await prisma.beat.update({
        where: { id: beatId },
        data: { specMemoryStoreId, historyMemoryStoreId },
      });
    }

    // Start Designer session
    const session = await createSession({
      agent: BEAT_DESIGNER_AGENT_ID(),
      environment_id: ENVIRONMENT_ID(),
      title: `design ${beat.slug}`,
      resources: [
        {
          type: "memory_store",
          memory_store_id: specMemoryStoreId,
          access: "read_write",
          instructions:
            "Your beat's spec store. Write spec.yaml and relevance.md inside this mount.",
        },
        {
          type: "memory_store",
          memory_store_id: GLOBAL_PATTERNS_STORE_ID(),
          access: "read_only",
          instructions:
            "Cross-beat patterns for reference. Read only — do not write here in this session.",
        },
      ],
    });

    await prisma.beat.update({
      where: { id: beatId },
      data: { status: "DESIGNING", designSessionId: session.id },
    });

    // Send design_beat user event. We forward the user's explicit UI choices
    // as `user_choices` so the Designer honors them instead of applying its
    // own defaults. The Designer's system prompt treats these as authoritative.
    await sendSessionEvents(session.id, [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              action: "design_beat",
              brief: beat.brief,
              beat_slug: beat.slug,
              user_choices: {
                cadence: {
                  type:
                    beat.cadenceType === "ON_DEMAND"
                      ? "on_demand"
                      : "time_based",
                  cron: beat.cronExpression,
                  timezone: beat.timezone,
                },
                depth: beat.depth.toLowerCase(),
                output_language: beat.outputLanguage,
              },
            }),
          },
        ],
      },
    ]);

    // Drive and forward events
    yield* driveDesigner(beatId, session.id);
  } catch (err) {
    const message = String(err).slice(0, 500);
    await prisma.beat
      .update({ where: { id: beatId }, data: { status: "FAILED" } })
      .catch(() => void 0);
    yield { type: "beat.failed", error: message };
  }
}

// =========================================================================
// resumeBeatSession — continue a paused Designer session after clarification
// =========================================================================

/**
 * Sends the user's clarification reply as a follow-up user.message to the
 * paused Designer session, then drives to terminal. The caller should have
 * already ack'd the needs_clarification tool_use with user.custom_tool_result
 * (which we do inside driveDesigner on the original call). This function
 * only handles the delayed user.message part.
 */
export async function* resumeBeatSession(
  beatId: string,
  clarificationReply: string,
): AsyncIterable<OrchestratorEvent> {
  const beat = await loadBeat(beatId);
  if (!beat.designSessionId) {
    yield {
      type: "beat.failed",
      error: "Cannot resume: no design session on beat",
    };
    return;
  }

  try {
    await sendSessionEvents(beat.designSessionId, [
      {
        type: "user.message",
        content: [{ type: "text", text: clarificationReply }],
      },
    ]);
    await prisma.beat.update({
      where: { id: beatId },
      data: { status: "DESIGNING", pendingClarification: null },
    });
    yield* driveDesigner(beatId, beat.designSessionId);
  } catch (err) {
    const message = String(err).slice(0, 500);
    await prisma.beat
      .update({ where: { id: beatId }, data: { status: "FAILED" } })
      .catch(() => void 0);
    yield { type: "beat.failed", error: message };
  }
}

// =========================================================================
// continueBeatSession — re-attach to an already-running Designer session
// =========================================================================

/**
 * Resumes streaming from a Designer session that was already created by a
 * prior (now-disconnected) SSE driver. Avoids burning CMA quota by creating
 * a brand new session on every reload while status=DESIGNING.
 */
export async function* continueBeatSession(
  beatId: string,
): AsyncIterable<OrchestratorEvent> {
  const beat = await loadBeat(beatId);
  if (!beat.designSessionId) {
    yield {
      type: "beat.failed",
      error: "Cannot continue: no design session on beat",
    };
    return;
  }
  try {
    yield* driveDesigner(beatId, beat.designSessionId);
  } catch (err) {
    const message = String(err).slice(0, 500);
    await prisma.beat
      .update({ where: { id: beatId }, data: { status: "FAILED" } })
      .catch(() => void 0);
    yield { type: "beat.failed", error: message };
  }
}

// =========================================================================
// runScoutPhase — Sources Scout session
// =========================================================================

/**
 * Starts a Scout session with [spec rw, global_patterns rw], sends
 * scout_sources, drives to scout_complete. Flips beat to ACTIVE on success.
 * Assumes the beat's spec memory store is already populated with spec.yaml
 * and relevance.md (i.e. Designer already finalized).
 */
export async function* runScoutPhase(
  beatId: string,
): AsyncIterable<OrchestratorEvent> {
  const beat = await loadBeat(beatId);
  if (!beat.specMemoryStoreId) {
    yield {
      type: "beat.failed",
      error: "Cannot scout: beat has no spec memory store",
    };
    return;
  }

  try {
    await prisma.beat.update({
      where: { id: beatId },
      data: { status: "SCOUTING" },
    });

    const session = await createSession({
      agent: SOURCES_SCOUT_AGENT_ID(),
      environment_id: ENVIRONMENT_ID(),
      title: `scout ${beat.slug}`,
      resources: [
        {
          type: "memory_store",
          memory_store_id: beat.specMemoryStoreId,
          access: "read_write",
          instructions:
            "Beat spec store. Read spec.yaml, then write sources.yaml inside this mount.",
        },
        {
          type: "memory_store",
          memory_store_id: GLOBAL_PATTERNS_STORE_ID(),
          access: "read_write",
          instructions:
            "Cross-beat source-discovery tactics. Read before scouting; may append new generalizable tactics.",
        },
      ],
    });

    await sendSessionEvents(session.id, [
      {
        type: "user.message",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              action: "scout_sources",
              beat_slug: beat.slug,
            }),
          },
        ],
      },
    ]);

    yield* driveScout(beatId, session.id);
  } catch (err) {
    const message = String(err).slice(0, 500);
    await prisma.beat
      .update({ where: { id: beatId }, data: { status: "FAILED" } })
      .catch(() => void 0);
    yield { type: "beat.failed", error: message };
  }
}

// =========================================================================
// generateIssueSession — Editor phase
// =========================================================================

/**
 * Starts an Editor session with all stores attached, sends generate_issue,
 * drives to publish_issue. Returns the parsed publish_issue payload so the
 * caller can render + dispatch the email.
 *
 * Persists an Issue + IssueItem rows on successful publish. Does NOT render
 * the email or call Mailgun — that's Phase 9.
 */
export async function generateIssueSession(
  beatId: string,
): Promise<{ issueId: string; payload: PublishIssueInput }> {
  const beat = await loadBeat(beatId);
  if (!beat.specMemoryStoreId || !beat.historyMemoryStoreId) {
    throw new Error("Cannot generate issue: beat missing memory stores");
  }
  if (beat.status !== "ACTIVE") {
    throw new Error(`Cannot generate issue: beat status is ${beat.status}`);
  }

  const session = await createSession({
    agent: EDITOR_AGENT_ID(),
    environment_id: ENVIRONMENT_ID(),
    title: `issue ${beat.slug}`,
    resources: [
      {
        type: "memory_store",
        memory_store_id: beat.specMemoryStoreId,
        access: "read_write",
        instructions:
          "Beat spec store. Read spec.yaml, relevance.md, and sources.yaml inside this mount.",
      },
      {
        type: "memory_store",
        memory_store_id: beat.historyMemoryStoreId,
        access: "read_write",
        instructions:
          "Issue history store. Skim issues/ for last 7 days; append the new issue here after publish_issue.",
      },
      {
        type: "memory_store",
        memory_store_id: GLOBAL_PATTERNS_STORE_ID(),
        access: "read_only",
        instructions: "Reference only.",
      },
    ],
  });

  await sendSessionEvents(session.id, [
    {
      type: "user.message",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            action: "generate_issue",
            beat_slug: beat.slug,
            as_of: new Date().toISOString(),
          }),
        },
      ],
    },
  ]);

  const payload = await driveEditor(session.id);

  // Persist Issue + IssueItem rows
  const issue = await prisma.issue.create({
    data: {
      beatId,
      sessionId: session.id,
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
          secondarySourceUrls: JSON.stringify(
            item.secondary_source_urls ?? [],
          ),
          tags: JSON.stringify(item.tags ?? []),
          fingerprint: item.fingerprint,
        })),
      },
    },
  });

  return { issueId: issue.id, payload };
}

// =========================================================================
// updateRelevanceSession — Designer in feedback-learning mode
// =========================================================================

/**
 * Runs a Designer session in feedback-learning mode: reads relevance.md and
 * appends dated entries to "## Learned from feedback". Does not call
 * finalize_beat_spec in this mode (per Designer prompt §3.1.2).
 */
export async function updateRelevanceSession(
  beatId: string,
  feedbackBatch: Array<{
    item_headline: string;
    source_url: string;
    feedback: "up" | "down";
  }>,
): Promise<void> {
  const beat = await loadBeat(beatId);
  if (!beat.specMemoryStoreId) {
    throw new Error("Cannot update relevance: beat has no spec store");
  }
  if (!feedbackBatch.length) return;

  const session = await createSession({
    agent: BEAT_DESIGNER_AGENT_ID(),
    environment_id: ENVIRONMENT_ID(),
    title: `relevance ${beat.slug}`,
    resources: [
      {
        type: "memory_store",
        memory_store_id: beat.specMemoryStoreId,
        access: "read_write",
        instructions:
          "Beat spec store. Append new dated entries to the '## Learned from feedback' section of relevance.md.",
      },
    ],
  });

  await sendSessionEvents(session.id, [
    {
      type: "user.message",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            action: "update_relevance",
            beat_slug: beat.slug,
            feedback_batch: feedbackBatch,
          }),
        },
      ],
    },
  ]);

  // Drain the stream until end_turn. No custom tool expected in this mode.
  for await (const ev of streamSession(session.id)) {
    const data = ev.data as any;
    if (data?.type === "session.error") {
      throw new Error(
        `session.error: ${JSON.stringify(data.error ?? data).slice(0, 300)}`,
      );
    }
    if (
      data?.type === "session.status_idle" &&
      data.stop_reason?.type === "end_turn"
    ) {
      return;
    }
    if (data?.type === "session.status_terminated") {
      throw new Error(
        `session terminated: ${JSON.stringify(data).slice(0, 300)}`,
      );
    }
  }
}

// =========================================================================
// Session drivers (shared stream loop)
// =========================================================================

const MAX_EVENTS = 3000;
const MAX_MS = 25 * 60 * 1000;

/** Driver for Designer session — handles needs_clarification + finalize_beat_spec. */
async function* driveDesigner(
  beatId: string,
  sessionId: string,
): AsyncIterable<OrchestratorEvent> {
  const eventsById = new Map<
    string,
    { id: string; name: string; input: unknown; session_thread_id?: string }
  >();
  const startedAt = Date.now();
  let eventCount = 0;

  for await (const ev of streamSession(sessionId)) {
    if (++eventCount > MAX_EVENTS) {
      throw new Error(`driveDesigner: exceeded ${MAX_EVENTS} events`);
    }
    if (Date.now() - startedAt > MAX_MS) {
      throw new Error(`driveDesigner: exceeded ${MAX_MS / 60000}min budget`);
    }

    const data = ev.data as any;
    const type: string = data?.type ?? ev.type;

    if (type === "agent.message") {
      const text = data.content?.find?.((c: any) => c.type === "text")?.text;
      if (text) yield { type: "designer.thinking", message: text };
    }

    if (type === "agent.custom_tool_use") {
      eventsById.set(data.id, {
        id: data.id,
        name: data.name,
        input: data.input,
        session_thread_id: data.session_thread_id,
      });
    }

    if (type === "session.error") {
      const err = `designer session.error: ${JSON.stringify(
        data.error ?? data,
      ).slice(0, 300)}`;
      await markFailed(beatId, err);
      yield { type: "beat.failed", error: err };
      return;
    }
    if (type === "session.status_terminated") {
      const err = `designer session terminated`;
      await markFailed(beatId, err);
      yield { type: "beat.failed", error: err };
      return;
    }

    if (type !== "session.status_idle") continue;

    const stopType = data.stop_reason?.type;

    if (stopType === "end_turn") {
      return; // session done. Caller decides whether to run scout next.
    }

    if (stopType !== "requires_action") continue;

    // Handle each blocking custom tool call
    for (const eventId of data.stop_reason.event_ids ?? []) {
      const tool = eventsById.get(eventId);
      if (!tool) continue;

      if (tool.name === "needs_clarification") {
        const parsed = NeedsClarificationSchema.safeParse(tool.input);
        if (!parsed.success) {
          await replyTool(sessionId, eventId, tool, {
            ok: false,
            error: "invalid needs_clarification payload",
          });
          continue;
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
        yield {
          type: "designer.needs_clarification",
          questions: parsed.data.questions,
          reasoning: parsed.data.reasoning,
          sessionId,
        };
        // Caller must invoke resumeBeatSession with the user's reply.
        // End this generator — we don't drain further events from this session now.
        return;
      }

      if (tool.name === "finalize_beat_spec") {
        const parsed = FinalizeBeatSpecSchema.safeParse(tool.input);
        if (!parsed.success) {
          await replyTool(sessionId, eventId, tool, {
            ok: false,
            error: "invalid finalize_beat_spec payload",
          });
          continue;
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
        yield {
          type: "designer.finalized",
          summary: parsed.data.summary,
          defaultsApplied: parsed.data.defaults_applied,
        };
        continue;
      }

      // Unknown tool — reply with error to unblock
      await replyTool(sessionId, eventId, tool, {
        ok: false,
        error: `unexpected tool for Designer: ${tool.name}`,
      });
    }
  }
}

/** Driver for Scout session — handles scout_complete. */
async function* driveScout(
  beatId: string,
  sessionId: string,
): AsyncIterable<OrchestratorEvent> {
  const eventsById = new Map<
    string,
    { id: string; name: string; input: unknown; session_thread_id?: string }
  >();
  const startedAt = Date.now();
  let eventCount = 0;

  for await (const ev of streamSession(sessionId)) {
    if (++eventCount > MAX_EVENTS) {
      throw new Error(`driveScout: exceeded ${MAX_EVENTS} events`);
    }
    if (Date.now() - startedAt > MAX_MS) {
      throw new Error(`driveScout: exceeded ${MAX_MS / 60000}min budget`);
    }

    const data = ev.data as any;
    const type: string = data?.type ?? ev.type;

    if (type === "agent.message") {
      const text = data.content?.find?.((c: any) => c.type === "text")?.text;
      if (text) yield { type: "scout.progress", note: text.slice(0, 200) };
    }

    if (type === "agent.custom_tool_use") {
      eventsById.set(data.id, {
        id: data.id,
        name: data.name,
        input: data.input,
        session_thread_id: data.session_thread_id,
      });
    }

    if (type === "session.error") {
      const err = `scout session.error: ${JSON.stringify(
        data.error ?? data,
      ).slice(0, 300)}`;
      await markFailed(beatId, err);
      yield { type: "beat.failed", error: err };
      return;
    }
    if (type === "session.status_terminated") {
      const err = `scout session terminated`;
      await markFailed(beatId, err);
      yield { type: "beat.failed", error: err };
      return;
    }

    if (type !== "session.status_idle") continue;

    const stopType = data.stop_reason?.type;
    if (stopType === "end_turn") {
      yield { type: "beat.ready", beatId };
      return;
    }
    if (stopType !== "requires_action") continue;

    for (const eventId of data.stop_reason.event_ids ?? []) {
      const tool = eventsById.get(eventId);
      if (!tool) continue;

      if (tool.name === "scout_complete") {
        const parsed = ScoutCompleteSchema.safeParse(tool.input);
        if (!parsed.success) {
          await replyTool(sessionId, eventId, tool, {
            ok: false,
            error: "invalid scout_complete payload",
          });
          continue;
        }
        await prisma.beat.update({
          where: { id: beatId },
          data: {
            status: "ACTIVE",
            sourceCount: parsed.data.source_count,
            coverageAssessment: parsed.data.coverage_assessment,
            coverageNote: parsed.data.notes,
          },
        });
        await replyTool(sessionId, eventId, tool, { ok: true });
        yield {
          type: "scout.complete",
          sourceCount: parsed.data.source_count,
          coverage: parsed.data.coverage_assessment,
          note: parsed.data.notes,
        };
        continue;
      }

      await replyTool(sessionId, eventId, tool, {
        ok: false,
        error: `unexpected tool for Scout: ${tool.name}`,
      });
    }
  }
}

/** Driver for Editor session — waits for publish_issue, returns payload. */
async function driveEditor(sessionId: string): Promise<PublishIssueInput> {
  const eventsById = new Map<
    string,
    { id: string; name: string; input: unknown; session_thread_id?: string }
  >();
  const startedAt = Date.now();
  let eventCount = 0;
  let captured: PublishIssueInput | null = null;

  for await (const ev of streamSession(sessionId)) {
    if (++eventCount > MAX_EVENTS) {
      throw new Error(`driveEditor: exceeded ${MAX_EVENTS} events`);
    }
    if (Date.now() - startedAt > MAX_MS) {
      throw new Error(`driveEditor: exceeded ${MAX_MS / 60000}min budget`);
    }

    const data = ev.data as any;
    const type: string = data?.type ?? ev.type;

    if (type === "agent.custom_tool_use") {
      eventsById.set(data.id, {
        id: data.id,
        name: data.name,
        input: data.input,
        session_thread_id: data.session_thread_id,
      });
    }
    if (type === "session.error") {
      throw new Error(
        `editor session.error: ${JSON.stringify(data.error ?? data).slice(0, 300)}`,
      );
    }
    if (type === "session.status_terminated") {
      throw new Error(`editor session terminated`);
    }

    if (type !== "session.status_idle") continue;
    const stopType = data.stop_reason?.type;
    if (stopType === "end_turn") {
      if (!captured) throw new Error("Editor ended without publish_issue");
      return captured;
    }
    if (stopType !== "requires_action") continue;

    for (const eventId of data.stop_reason.event_ids ?? []) {
      const tool = eventsById.get(eventId);
      if (!tool) continue;

      if (tool.name === "publish_issue") {
        const parsed = PublishIssueSchema.safeParse(tool.input);
        if (!parsed.success) {
          await replyTool(sessionId, eventId, tool, {
            ok: false,
            error: `invalid publish_issue: ${parsed.error.message.slice(0, 200)}`,
          });
          continue;
        }
        captured = parsed.data;
        await replyTool(sessionId, eventId, tool, { ok: true });
        continue;
      }

      await replyTool(sessionId, eventId, tool, {
        ok: false,
        error: `unexpected tool for Editor: ${tool.name}`,
      });
    }
  }
  throw new Error("Editor stream ended without end_turn");
}

// -------- shared low-level helpers --------

async function replyTool(
  sessionId: string,
  eventId: string,
  tool: { session_thread_id?: string },
  payload: unknown,
): Promise<void> {
  await sendSessionEvents(sessionId, [
    {
      type: "user.custom_tool_result",
      custom_tool_use_id: eventId,
      ...(tool.session_thread_id
        ? { session_thread_id: tool.session_thread_id }
        : {}),
      content: [{ type: "text", text: JSON.stringify(payload) }],
    },
  ]);
}

async function markFailed(beatId: string, _error: string): Promise<void> {
  await prisma.beat
    .update({ where: { id: beatId }, data: { status: "FAILED" } })
    .catch(() => void 0);
}
