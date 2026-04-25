/**
 * Thin wrapper around @anthropic-ai/sdk beta CMA. All session, event, and
 * memory-store IO goes through the typed SDK. The raw HTTP fallback (`cma()`)
 * remains only for `/v1/agents` and `/v1/environments`, which scripts/
 * provision-agents.ts and scripts/reprovision-*.ts call with arbitrary JSON
 * bodies — those endpoints have typed bindings in the SDK too, but the
 * scripts predate the migration and pass raw shapes.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/core/streaming";
import type {
  BetaManagedAgentsMemoryStoreResourceParam,
  BetaManagedAgentsSession,
  SessionCreateParams,
} from "@anthropic-ai/sdk/resources/beta/sessions/sessions";
import type {
  BetaManagedAgentsEventParams,
  BetaManagedAgentsSessionEvent,
  BetaManagedAgentsStreamSessionEvents,
} from "@anthropic-ai/sdk/resources/beta/sessions/events";

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

export type SessionResource = NonNullable<SessionCreateParams["resources"]>[number];
export type MemoryStoreResource = BetaManagedAgentsMemoryStoreResourceParam;

// `agent` accepts string shorthand (latest version) or pinned object form.
// Pinning is preferred so in-flight sessions don't pick up a freshly-published
// agent version mid-run.
export type AgentRef = string | { type: "agent"; id: string; version: number };

export async function createSession(body: {
  agent: AgentRef;
  environment_id: string;
  title?: string;
  resources?: SessionResource[];
}): Promise<{ id: string }> {
  const session: BetaManagedAgentsSession = await sdk().beta.sessions.create({
    agent: body.agent,
    environment_id: body.environment_id,
    title: body.title,
    resources: body.resources,
  });
  return { id: session.id };
}

export async function archiveSession(sessionId: string): Promise<void> {
  await sdk().beta.sessions.archive(sessionId);
}

export async function sendSessionEvents(
  sessionId: string,
  events: BetaManagedAgentsEventParams[],
): Promise<void> {
  await sdk().beta.sessions.events.send(sessionId, { events });
}

// Re-export the SDK's typed event union under a shorter local alias so the
// driver doesn't have to import the verbose name everywhere.
export type ListedEvent = BetaManagedAgentsSessionEvent;

export async function listSessionEvents(
  sessionId: string,
  opts: { limit?: number } = {},
): Promise<ListedEvent[]> {
  const page = await sdk().beta.sessions.events.list(sessionId, {
    limit: opts.limit ?? 100,
  });
  return page.data;
}

export async function streamSessionEvents(
  sessionId: string,
): Promise<Stream<BetaManagedAgentsStreamSessionEvents>> {
  return await sdk().beta.sessions.events.stream(sessionId);
}

// -------- Memory stores (via SDK) --------

export async function createMemoryStore(
  name: string,
  description: string,
): Promise<{ id: string }> {
  const store = await sdk().beta.memoryStores.create({ name, description });
  return { id: store.id };
}

export async function deleteMemoryStore(storeId: string): Promise<void> {
  await sdk().beta.memoryStores.delete(storeId);
}

// -------- Raw HTTP — agents + environments only --------
//
// These two endpoints are still called by version-controlled provisioning
// scripts (scripts/provision-agents.ts, scripts/reprovision-*.ts) that pass
// arbitrary JSON shapes. The SDK has typed bindings for both; migrating those
// scripts is out of scope for the brief-chat review.

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
