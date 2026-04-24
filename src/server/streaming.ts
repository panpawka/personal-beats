/**
 * SSE endpoint for live beat-creation streaming.
 *
 * The SSE connection is the SINGLE driver of createBeatSession /
 * resumeBeatSession / runScoutPhase (Phase 6 actions only mutate DB state).
 * On connect we read Beat.status and dispatch:
 *
 *   DRAFT                             -> createBeatSession, then chain Scout
 *   AWAITING_CLARIFICATION + reply    -> resumeBeatSession, then chain Scout
 *   AWAITING_CLARIFICATION (no reply) -> replay stored questions, close
 *   SCOUTING                          -> runScoutPhase (recovery after crash)
 *   DESIGNING / already-driving       -> mutex rejection, close
 *   ACTIVE / FAILED / PAUSED          -> emit terminal event, close
 */
import type { MiddlewareConfigFn } from "wasp/server";
import type { StreamBeatCreation } from "wasp/server/api";
import { HttpError, prisma } from "wasp/server";
import {
  createBeatSession,
  continueBeatSession,
  resumeBeatSession,
  runScoutPhase,
  type OrchestratorEvent,
} from "./agents/orchestrator.js";

// Namespace middleware: remove body parsers (SSE is a GET) so nothing buffers.
// Keep cors/helmet/cookieParser for auth.
export const streamNamespaceMiddleware: MiddlewareConfigFn = (config) => {
  config.delete("express.json");
  config.delete("express.urlencoded");
  return config;
};

// Per-route middleware mirrors the namespace — belt and suspenders, and the
// route middleware runs even if the namespace isn't matched first.
export const streamRouteMiddleware: MiddlewareConfigFn = (config) => {
  config.delete("express.json");
  config.delete("express.urlencoded");
  return config;
};

// In-memory mutex keyed by beatId. Prevents two SSE clients from both
// driving the same beat's agent sessions concurrently. Good enough for a
// single-node dev setup; Phase 11 / multi-node would need Redis or a DB lock.
const activeDrivers = new Set<string>();

export const streamBeatCreation: StreamBeatCreation = async (
  req,
  res,
  context,
) => {
  const { beatId } = req.params as { beatId: string };
  if (!context.user) throw new HttpError(401);

  const beat = await prisma.beat.findUnique({ where: { id: beatId } });
  if (!beat || beat.userId !== context.user.id) {
    throw new HttpError(404);
  }

  // SSE headers.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  // Flush the head immediately so proxies commit to the streaming response.
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const sendEvent = (event: string, data: unknown) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, 15_000);

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const forward = (ev: OrchestratorEvent) => {
    // The orchestrator events are already shaped as { type, ...payload }.
    // SSE splits event name from data, so strip `type` for the data field.
    const { type, ...rest } = ev;
    sendEvent(type, rest);
  };

  // Acquire mutex. If already driving, emit a soft-failure and close — the
  // caller should refresh (which will find a terminal state or await reply).
  if (activeDrivers.has(beatId)) {
    sendEvent("beat.failed", { error: "already streaming this beat" });
    clearInterval(heartbeat);
    res.end();
    return;
  }
  activeDrivers.add(beatId);

  try {
    await dispatch(beatId, beat.status, forward, () => closed);
  } catch (err) {
    const message = String(err).slice(0, 500);
    console.error(`[stream ${beatId}] unhandled:`, err);
    sendEvent("beat.failed", { error: message });
  } finally {
    activeDrivers.delete(beatId);
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
};

async function dispatch(
  beatId: string,
  status: string,
  forward: (ev: OrchestratorEvent) => void,
  isClosed: () => boolean,
): Promise<void> {
  switch (status) {
    case "DRAFT": {
      await drainGenerator(createBeatSession(beatId), forward, isClosed);
      if (isClosed()) return;
      await chainScoutIfReady(beatId, forward, isClosed);
      return;
    }

    case "DESIGNING": {
      // A prior SSE died mid-drive but the DB + CMA session are already
      // provisioned. Re-attach to the existing designSessionId instead of
      // spinning up a new Designer session (which would burn CMA quota and
      // create a second memory store). If designSessionId is missing we
      // fall back to a fresh session.
      const beat = await prisma.beat.findUnique({ where: { id: beatId } });
      const gen = beat?.designSessionId
        ? continueBeatSession(beatId)
        : createBeatSession(beatId);
      await drainGenerator(gen, forward, isClosed);
      if (isClosed()) return;
      await chainScoutIfReady(beatId, forward, isClosed);
      return;
    }

    case "AWAITING_CLARIFICATION": {
      const beat = await prisma.beat.findUnique({ where: { id: beatId } });
      const pending = safeParse(beat?.pendingClarification);
      if (!pending) {
        forward({ type: "beat.failed", error: "clarification state lost" });
        return;
      }
      if (!pending.reply) {
        // Replay stored questions so a reconnecting client can render the form.
        forward({
          type: "designer.needs_clarification",
          questions: pending.questions ?? [],
          reasoning: pending.reasoning ?? "",
          sessionId: pending.sessionId ?? "",
        });
        return;
      }
      // Has reply → resume and chain Scout.
      await drainGenerator(
        resumeBeatSession(beatId, pending.reply),
        forward,
        isClosed,
      );
      if (isClosed()) return;
      await chainScoutIfReady(beatId, forward, isClosed);
      return;
    }

    case "SCOUTING": {
      // Recovery: designer finished but scout never ran to completion.
      await drainGenerator(runScoutPhase(beatId), forward, isClosed);
      return;
    }

    case "ACTIVE": {
      forward({ type: "beat.ready", beatId });
      return;
    }

    case "FAILED": {
      forward({ type: "beat.failed", error: "beat previously failed" });
      return;
    }

    case "PAUSED": {
      forward({ type: "beat.failed", error: "beat is paused" });
      return;
    }

    default: {
      forward({ type: "beat.failed", error: `unknown status: ${status}` });
      return;
    }
  }
}

async function chainScoutIfReady(
  beatId: string,
  forward: (ev: OrchestratorEvent) => void,
  isClosed: () => boolean,
): Promise<void> {
  const beat = await prisma.beat.findUnique({ where: { id: beatId } });
  if (!beat) return;
  if (beat.status === "SCOUTING") {
    await drainGenerator(runScoutPhase(beatId), forward, isClosed);
    return;
  }
  // AWAITING_CLARIFICATION / FAILED / ACTIVE handled by upstream yields; nothing to do.
}

async function drainGenerator(
  gen: AsyncIterable<OrchestratorEvent>,
  forward: (ev: OrchestratorEvent) => void,
  isClosed: () => boolean,
): Promise<void> {
  for await (const ev of gen) {
    if (isClosed()) return;
    forward(ev);
    if (ev.type === "beat.failed") return;
  }
}

function safeParse(
  raw: string | null | undefined,
): {
  questions?: string[];
  reasoning?: string;
  sessionId?: string;
  reply?: string;
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
