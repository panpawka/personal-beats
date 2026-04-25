/**
 * Thin wrapper around @anthropic-ai/sdk beta sessions. Replaces the old
 * hand-rolled HTTP + SSE parser. All session/event IO goes through the SDK;
 * memory-store CRUD stays on the raw REST API because the SDK surface is
 * less stable there and the calls are infrequent.
 */
import Anthropic from "@anthropic-ai/sdk";

const CMA_BASE = "https://api.anthropic.com";
const BETA_HEADER = "managed-agents-2026-04-01";
const API_VERSION = "2023-06-01";

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in env");
  return key;
}

let _client: Anthropic | null = null;
export function sdk(): Anthropic {
  if (_client) return _client;
  _client = new Anthropic({
    apiKey: apiKey(),
    defaultHeaders: { "anthropic-beta": BETA_HEADER },
  });
  return _client;
}

// -------- Session + events (via SDK) --------

export async function createSession(body: {
  agent: string;
  environment_id: string;
  title?: string;
  resources?: unknown[];
}): Promise<{ id: string }> {
  // SDK types may lag behind the beta; cast through unknown for forward-compat.
  const res = await (sdk().beta.sessions as unknown as {
    create: (b: unknown) => Promise<{ id: string }>;
  }).create(body);
  return { id: res.id };
}

export async function sendSessionEvents(
  sessionId: string,
  events: unknown[],
): Promise<void> {
  await (sdk().beta.sessions as unknown as {
    events: { send: (id: string, b: { events: unknown[] }) => Promise<unknown> };
  }).events.send(sessionId, { events });
}

export type ListedEvent = {
  id?: string;
  type: string;
  // Pass-through for the rest of the CMA event shape. The driver destructures
  // the specific fields it cares about (content, name, input, stop_reason).
  [k: string]: unknown;
};

export async function listSessionEvents(
  sessionId: string,
  opts: { limit?: number } = {},
): Promise<ListedEvent[]> {
  const api = sdk().beta.sessions as unknown as {
    events: {
      list: (
        id: string,
        opts?: { limit?: number },
      ) => Promise<{ data: ListedEvent[] }>;
    };
  };
  const page = await api.events.list(sessionId, { limit: opts.limit ?? 100 });
  return page.data;
}

// -------- Memory stores (raw REST — SDK coverage is uneven here) --------

function headers(): Record<string, string> {
  return {
    "x-api-key": apiKey(),
    "anthropic-version": API_VERSION,
    "anthropic-beta": BETA_HEADER,
    accept: "application/json",
    "content-type": "application/json",
  };
}

async function cma<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${CMA_BASE}${path}`, {
    method,
    headers: headers(),
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

// Unused after the refactor — kept to support tooling scripts that reference
// the bulk agent/env creation paths. Safe to delete if no callers remain.
export async function createAgent(
  body: Record<string, unknown>,
): Promise<{ id: string; version: number }> {
  return await cma<{ id: string; version: number }>("POST", "/v1/agents", body);
}
export async function createEnvironment(
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  return await cma<{ id: string }>("POST", "/v1/environments", body);
}
