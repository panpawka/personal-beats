/**
 * Phase 4 end-to-end smoke — Designer + Scout in sequential sessions.
 *
 * Multi-agent (callable_agents) is intentionally not used: Wasp owns the
 * phase state machine via drive.ts, so each phase runs in its own session.
 * Smoke test mirrors that — start a Designer session, drive it to
 * finalize_beat_spec, end. Then start a Scout session against the same spec
 * store, drive it to scout_complete.
 *
 * Run: `npx tsx scripts/e2e-smoke.ts [brief]`
 *
 * Cost: ~$1-4 per full run.
 */
import type { BetaManagedAgentsEventParams } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import { loadServerEnv } from "./env-loader.js";
import {
  createMemoryStore,
  createSession,
  listMemories,
  sendSessionEvents,
  streamSessionEvents,
} from "../src/server/agents/client.js";
import {
  FinalizeBeatSpecSchema,
  NeedsClarificationSchema,
  PublishIssueSchema,
  ScoutCompleteSchema,
} from "../src/shared/types.js";

loadServerEnv();

const BEAT_DESIGNER_AGENT_ID = req("BEAT_DESIGNER_AGENT_ID");
const SOURCES_SCOUT_AGENT_ID = req("SOURCES_SCOUT_AGENT_ID");
const ENVIRONMENT_ID = req("ENVIRONMENT_ID");
const GLOBAL_PATTERNS_STORE_ID = req("GLOBAL_PATTERNS_STORE_ID");

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing`);
  return v;
}

const ARGV = process.argv.slice(2);
const SKIP_SCOUT = ARGV.includes("--designer-only");
const BRIEF =
  ARGV.filter((a) => !a.startsWith("--"))[0] ?? "Daily news for Wrocław, Poland";
const BEAT_SLUG = "smoke-beat-" + Date.now().toString(36);

async function main() {
  console.log(`[smoke] brief=${JSON.stringify(BRIEF)} slug=${BEAT_SLUG}`);

  // --- Shared per-beat memory stores ---
  console.log("[smoke] creating per-beat memory stores...");
  const specStore = await createMemoryStore(
    `beat_${BEAT_SLUG}_spec`,
    "Per-beat spec + sources + relevance rules. Contains /spec.yaml, /sources.yaml, /relevance.md.",
  );
  const historyStore = await createMemoryStore(
    `beat_${BEAT_SLUG}_history`,
    "Per-beat issue history. Contains /issues/YYYY-MM-DD.md and /fingerprints.jsonl.",
  );
  console.log(`  spec=${specStore.id} history=${historyStore.id}`);

  // =========================================================================
  // Phase A — Designer
  // =========================================================================
  console.log("\n[smoke] PHASE A — Beat Designer");
  const designSession = await createSession({
    agent: BEAT_DESIGNER_AGENT_ID,
    environment_id: ENVIRONMENT_ID,
    title: `design ${BEAT_SLUG}`,
    resources: [
      {
        type: "memory_store",
        memory_store_id: specStore.id,
        access: "read_write",
        instructions:
          "Your beat's spec store. Write /spec.yaml and /relevance.md here.",
      },
      {
        type: "memory_store",
        memory_store_id: GLOBAL_PATTERNS_STORE_ID,
        access: "read_only",
        instructions:
          "Cross-beat patterns for reference. You may read to orient the spec; do not write here.",
      },
    ],
  });
  console.log(`  session=${designSession.id}`);

  const designerPayload = {
    action: "design_beat",
    brief: BRIEF,
    beat_slug: BEAT_SLUG,
  };
  await sendSessionEvents(designSession.id, [
    {
      type: "user.message",
      content: [{ type: "text", text: JSON.stringify(designerPayload) }],
    },
  ]);

  await drive(designSession.id);

  console.log("\n[smoke] spec store after Designer:");
  await listMemoryTree(specStore.id, "spec");

  if (SKIP_SCOUT) {
    console.log("\n[smoke] --designer-only set, done.");
    return;
  }

  // =========================================================================
  // Phase B — Scout
  // =========================================================================
  console.log("\n[smoke] PHASE B — Sources Scout");
  const scoutSession = await createSession({
    agent: SOURCES_SCOUT_AGENT_ID,
    environment_id: ENVIRONMENT_ID,
    title: `scout ${BEAT_SLUG}`,
    resources: [
      {
        type: "memory_store",
        memory_store_id: specStore.id,
        access: "read_write",
        instructions:
          "Beat spec store. Read /spec.yaml, then write /sources.yaml here.",
      },
      {
        type: "memory_store",
        memory_store_id: GLOBAL_PATTERNS_STORE_ID,
        access: "read_write",
        instructions:
          "Cross-beat source-discovery tactics. Read before scouting; may append new generalizable tactics.",
      },
    ],
  });
  console.log(`  session=${scoutSession.id}`);

  const scoutPayload = {
    action: "scout_sources",
    beat_slug: BEAT_SLUG,
  };
  await sendSessionEvents(scoutSession.id, [
    {
      type: "user.message",
      content: [{ type: "text", text: JSON.stringify(scoutPayload) }],
    },
  ]);

  await drive(scoutSession.id);

  console.log("\n[smoke] memory store contents after Scout:");
  await listMemoryTree(specStore.id, "spec");
  await listMemoryTree(historyStore.id, "history");

  console.log("\n[smoke] done.");
}

/**
 * Stream events from a single-agent session, handling custom tool calls,
 * until the session reaches a terminal state.
 */
async function drive(sessionId: string): Promise<void> {
  const eventsById = new Map<
    string,
    {
      id: string;
      name: string;
      input: unknown;
      session_thread_id?: string;
    }
  >();

  let eventCount = 0;
  let clarifiedOnce = false;
  let pendingFollowup: {
    text: string;
    session_thread_id?: string;
  } | null = null;
  const startedAt = Date.now();
  const MAX_EVENTS = 3000;
  const MAX_MS = 25 * 60 * 1000;

  for await (const ev of await streamSessionEvents(sessionId)) {
    eventCount++;
    if (eventCount > MAX_EVENTS) {
      throw new Error(`[drive] aborting: exceeded ${MAX_EVENTS} events`);
    }
    if (Date.now() - startedAt > MAX_MS) {
      throw new Error(`[drive] aborting: exceeded ${MAX_MS / 60000} min`);
    }

    const data = ev.data as any;
    const type: string = data?.type ?? ev.type;

    const tag =
      type === "agent.message"
        ? (data.content?.find?.((c: any) => c.type === "text")?.text ?? "")
            .toString()
            .slice(0, 120)
            .replace(/\n/g, " ")
        : type === "agent.tool_use"
          ? `tool=${data.name}`
          : type === "agent.custom_tool_use"
            ? `custom=${data.name}`
            : type === "session.status_idle"
              ? `stop=${data.stop_reason?.type ?? "?"}`
              : "";
    console.log(`  [${eventCount}] ${type}  ${tag}`);

    if (type === "agent.custom_tool_use") {
      eventsById.set(data.id, {
        id: data.id,
        name: data.name,
        input: data.input,
        session_thread_id: data.session_thread_id,
      });
    }

    // Follow-up user.message must wait until the session moves back to
    // running (i.e. the tool_result has been fully processed). Firing it
    // while the session is still "waiting on responses" is rejected.
    if (type === "session.status_running" && pendingFollowup) {
      const fu = pendingFollowup;
      pendingFollowup = null;
      console.log(`[drive] sending follow-up: ${fu.text.slice(0, 120)}`);
      await sendSessionEvents(sessionId, [
        {
          type: "user.message",
          ...(fu.session_thread_id
            ? { session_thread_id: fu.session_thread_id }
            : {}),
          content: [{ type: "text", text: fu.text }],
        },
      ]);
    }

    if (type === "session.error") {
      throw new Error(
        `session.error: ${JSON.stringify(data.error ?? data).slice(0, 500)}`,
      );
    }
    if (type === "session.status_terminated") {
      throw new Error(
        `session terminated: ${JSON.stringify(data).slice(0, 500)}`,
      );
    }

    if (type === "session.status_idle") {
      const stopType = data.stop_reason?.type;
      if (stopType === "end_turn") {
        console.log("[drive] session idle, end_turn — done");
        return;
      }
      if (stopType === "requires_action") {
        const blocking: string[] = data.stop_reason.event_ids ?? [];
        const replies: BetaManagedAgentsEventParams[] = [];
        let clarificationToAnswer: {
          input: any;
          session_thread_id?: string;
        } | null = null;

        for (const eventId of blocking) {
          const tool = eventsById.get(eventId);
          if (!tool) {
            console.warn(`  ! missing tool_use for ${eventId}`);
            continue;
          }
          const result = handleCustomTool(tool.name, tool.input);
          console.log(`  -> ${tool.name}: ${result.status}`);
          replies.push({
            type: "user.custom_tool_result",
            custom_tool_use_id: eventId,
            ...(tool.session_thread_id
              ? { session_thread_id: tool.session_thread_id }
              : {}),
            content: [{ type: "text", text: JSON.stringify(result.payload) }],
          });

          if (
            tool.name === "needs_clarification" &&
            !clarifiedOnce &&
            result.status === "ok"
          ) {
            clarificationToAnswer = {
              input: tool.input,
              session_thread_id: tool.session_thread_id,
            };
          }
        }

        if (replies.length) {
          await sendSessionEvents(sessionId, replies);
        }

        if (clarificationToAnswer) {
          clarifiedOnce = true;
          const answer = canonicalClarificationAnswer(
            clarificationToAnswer.input,
          );
          // Queue; actual send happens when the session transitions back
          // to running after processing the tool_result.
          pendingFollowup = {
            text: answer,
            session_thread_id: clarificationToAnswer.session_thread_id,
          };
          console.log(`[drive] queued clarification answer, waiting for running`);
        }
      }
    }
  }
  console.log("[drive] stream ended without terminal event");
}

function handleCustomTool(
  name: string,
  input: unknown,
): { status: "ok" | "error"; payload: unknown } {
  try {
    switch (name) {
      case "needs_clarification": {
        const parsed = NeedsClarificationSchema.parse(input);
        console.log(
          `     clarification: ${parsed.questions.join(" | ")}`,
        );
        return { status: "ok", payload: { ok: true } };
      }
      case "finalize_beat_spec": {
        const parsed = FinalizeBeatSpecSchema.parse(input);
        console.log(`     summary: ${parsed.summary}`);
        console.log(`     defaults: ${parsed.defaults_applied.join(", ")}`);
        return { status: "ok", payload: { ok: true } };
      }
      case "scout_complete": {
        const parsed = ScoutCompleteSchema.parse(input);
        console.log(
          `     sources=${parsed.source_count} coverage=${parsed.coverage_assessment}`,
        );
        console.log(`     notes: ${parsed.notes}`);
        return { status: "ok", payload: { ok: true } };
      }
      case "publish_issue": {
        const parsed = PublishIssueSchema.parse(input);
        console.log(
          `     publish_issue ${parsed.issue_date} "${parsed.subject}" (${parsed.items.length} items)`,
        );
        return { status: "ok", payload: { ok: true } };
      }
      default:
        return {
          status: "error",
          payload: { ok: false, error: `unknown tool ${name}` },
        };
    }
  } catch (err) {
    return {
      status: "error",
      payload: {
        ok: false,
        error: `validation failed: ${String(err).slice(0, 500)}`,
      },
    };
  }
}

function canonicalClarificationAnswer(input: any): string {
  const qs: string[] = input?.questions ?? [];
  const joined = qs.join(" ").toLowerCase();
  if (joined.includes("age") || joined.includes("dzieci")) {
    return "Parents of kids ages 6-10 in Wrocław.";
  }
  if (joined.includes("vertical") || joined.includes("stage")) {
    return "Early-stage B2B SaaS and dev tools.";
  }
  return "Broad interest for residents. Proceed with sensible defaults.";
}

async function listMemoryTree(storeId: string, label: string): Promise<void> {
  try {
    const items = await listMemories(storeId, {
      path_prefix: "/",
      depth: 5,
      order_by: "path",
    });
    console.log(`  ${label} (${storeId}):`);
    if (!items.length) {
      console.log(`    (empty)`);
      return;
    }
    for (const item of items) {
      console.log(`    ${item.type}  ${item.path}`);
    }
  } catch (err) {
    console.log(`  ${label} listing failed: ${String(err).slice(0, 200)}`);
  }
}

main().catch((err) => {
  console.error("\n[smoke] FAILED:", err);
  process.exit(1);
});
