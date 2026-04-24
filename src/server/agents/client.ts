const CMA_BASE = "https://api.anthropic.com";
const BETA_HEADER = "managed-agents-2026-04-01";
const API_VERSION = "2023-06-01";

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set in env");
  }
  return key;
}

function headers(accept: "json" | "sse" = "json"): Record<string, string> {
  return {
    "x-api-key": apiKey(),
    "anthropic-version": API_VERSION,
    "anthropic-beta": BETA_HEADER,
    accept: accept === "sse" ? "text/event-stream" : "application/json",
    "content-type": "application/json",
  };
}

/**
 * Generic CMA JSON call. Throws with response body on non-2xx.
 */
export async function cma<T = unknown>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${CMA_BASE}${path}`, {
    method,
    headers: headers("json"),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `CMA ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`,
    );
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type SseEvent = { type: string; data: unknown };

/**
 * Stream CMA SSE endpoint. Yields parsed events. Caller breaks out on
 * terminal event types (session.status_idle, session.error, etc.).
 */
export async function* cmaStream(path: string): AsyncIterable<SseEvent> {
  const res = await fetch(`${CMA_BASE}${path}`, {
    method: "GET",
    headers: headers("sse"),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(
      `CMA stream ${path} -> ${res.status}: ${errText.slice(0, 500)}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      let eventType: string | null = null;
      let dataPayload = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith(":")) continue; // comment / heartbeat
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataPayload += line.slice(5).trim();
        }
      }
      if (!dataPayload) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(dataPayload);
      } catch {
        parsed = dataPayload;
      }
      const type =
        eventType ??
        (typeof parsed === "object" && parsed !== null && "type" in parsed
          ? String((parsed as { type: unknown }).type)
          : "unknown");
      yield { type, data: parsed };
    }
  }
}

// -------- Convenience wrappers --------

export async function createAgent(body: Record<string, unknown>): Promise<{
  id: string;
  version: number;
}> {
  const res = await cma<{ id: string; version: number }>(
    "POST",
    "/v1/agents",
    body,
  );
  return res;
}

export async function createEnvironment(body: Record<string, unknown>): Promise<{
  id: string;
}> {
  return await cma<{ id: string }>("POST", "/v1/environments", body);
}

export async function createMemoryStore(
  name: string,
  description: string,
): Promise<{ id: string }> {
  return await cma<{ id: string }>("POST", "/v1/memory_stores", {
    name,
    description,
  });
}

export async function createMemory(
  storeId: string,
  path: string,
  content: string,
): Promise<{ id: string; content_sha256: string }> {
  return await cma<{ id: string; content_sha256: string }>(
    "POST",
    `/v1/memory_stores/${storeId}/memories`,
    { path, content },
  );
}

export async function deleteMemoryStore(storeId: string): Promise<void> {
  await cma("DELETE", `/v1/memory_stores/${storeId}`);
}

export async function createSession(body: Record<string, unknown>): Promise<{
  id: string;
}> {
  return await cma<{ id: string }>("POST", "/v1/sessions", body);
}

export async function sendSessionEvents(
  sessionId: string,
  events: unknown[],
): Promise<void> {
  await cma("POST", `/v1/sessions/${sessionId}/events?beta=true`, { events });
}

export function streamSession(sessionId: string): AsyncIterable<SseEvent> {
  // The managed-agents stream path is /events/stream (not /stream — that
  // routes to an older, incompatible agent-api beta).
  return cmaStream(`/v1/sessions/${sessionId}/events/stream?beta=true`);
}
