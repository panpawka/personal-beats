import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  useQuery,
  getBeat,
  getIssuesForBeat,
  submitClarification,
  triggerOnDemandRun,
  pauseBeat,
  resumeBeat,
  deleteBeat,
} from "wasp/client/operations";
import { getSessionId } from "wasp/client/api";
import { config } from "wasp/client";

// -------- SSE event types (mirror OrchestratorEvent on server) --------

type SseEvent =
  | { type: "designer.thinking"; message: string }
  | {
      type: "designer.needs_clarification";
      questions: string[];
      reasoning: string;
      sessionId: string;
    }
  | { type: "designer.finalized"; summary: string; defaultsApplied: string[] }
  | { type: "scout.progress"; note: string }
  | { type: "scout.complete"; sourceCount: number; coverage: string; note: string }
  | { type: "editor.thinking"; message: string }
  | { type: "editor.published"; issueId: string }
  | { type: "beat.ready"; beatId: string }
  | { type: "beat.failed"; error: string };

// -------- minimal SSE parser over fetch() (so we can pass Bearer header) --------

async function* sseLines(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let event = "message";
  let data = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
      if (line === "") {
        if (data) {
          yield { event, data };
        }
        event = "message";
        data = "";
      } else if (line.startsWith(":")) {
        // heartbeat / comment
      } else if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice(5).trim();
      }
    }
  }
}

// -------- display helpers --------

function statusColor(s: string) {
  switch (s) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800";
    case "PAUSED":
      return "bg-amber-100 text-amber-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "AWAITING_CLARIFICATION":
      return "bg-blue-100 text-blue-800";
    case "DESIGNING":
    case "SCOUTING":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-neutral-200 text-neutral-700";
  }
}

// Statuses that warrant opening an SSE stream.
const STREAMABLE = new Set([
  "DRAFT",
  "DESIGNING",
  "AWAITING_CLARIFICATION",
  "SCOUTING",
]);

// =========================================================================

export function BeatDetailPage() {
  const { beatId } = useParams<{ beatId: string }>();
  const navigate = useNavigate();

  const {
    data: beat,
    isLoading: beatLoading,
    error: beatError,
    refetch: refetchBeat,
  } = useQuery(getBeat, { beatId: beatId! });
  const { data: issues, refetch: refetchIssues } = useQuery(getIssuesForBeat, {
    beatId: beatId!,
  });

  const [events, setEvents] = useState<SseEvent[]>([]);
  const [clarifyReply, setClarifyReply] = useState("");
  const [clarifyPending, setClarifyPending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamEpoch, setStreamEpoch] = useState(0); // bump to force reconnect
  const [triggerPending, setTriggerPending] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  // Timestamp of the last successful Run-now click. While set, poll the
  // issues query so the new issue row appears without a manual refresh.
  const [generatingSince, setGeneratingSince] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Latest clarification event (shown in the clarification form).
  const latestClarify = [...events]
    .reverse()
    .find((e) => e.type === "designer.needs_clarification") as
    | Extract<SseEvent, { type: "designer.needs_clarification" }>
    | undefined;

  // Open SSE ONCE when beat first loads in a streamable state, or after an
  // explicit reconnect (streamEpoch bump from clarification submit). Do NOT
  // re-open on status transitions — the server drives the full flow to a
  // terminal event on a single connection. Tearing down mid-flight races the
  // server's `activeDrivers` mutex and surfaces "already streaming".
  useEffect(() => {
    if (!beat || !beatId) return;
    if (!STREAMABLE.has(beat.status)) return;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreamError(null);

    (async () => {
      try {
        const sessionId = getSessionId();
        if (!sessionId) {
          setStreamError("not authenticated");
          return;
        }
        const res = await fetch(
          `${config.apiUrl}/api/stream/beat/${beatId}`,
          {
            headers: {
              Accept: "text/event-stream",
              Authorization: `Bearer ${sessionId}`,
            },
            signal: ctrl.signal,
          },
        );
        if (!res.ok || !res.body) {
          setStreamError(`stream failed: ${res.status}`);
          return;
        }
        for await (const { event, data } of sseLines(res.body)) {
          if (ctrl.signal.aborted) return;
          try {
            const payload = JSON.parse(data);
            const ev = { type: event, ...payload } as SseEvent;
            setEvents((prev) => [...prev, ev]);
          } catch {
            // ignore malformed payload
          }
        }
      } catch (err: any) {
        if (ctrl.signal.aborted) return;
        setStreamError(err?.message ?? String(err));
      } finally {
        // Stream closed naturally (or errored). Refetch DB state once so UI
        // reflects the terminal status without triggering another connection.
        if (!ctrl.signal.aborted) {
          refetchBeat();
          refetchIssues();
        }
      }
    })();

    return () => {
      ctrl.abort();
    };
    // Dependencies intentionally exclude `beat.status` so refetch-driven
    // status changes do NOT tear down an in-flight stream. `beat?.id` is
    // stable per route, so this fires once on first beat load and again
    // only when streamEpoch bumps (clarification reconnect).
  }, [beatId, beat?.id, streamEpoch]);

  // Poll for a new issue after Run-now. Stops when a newer issue appears or
  // after 15 min (Editor session hard cap). 20s cadence = reasonable CMA load.
  useEffect(() => {
    if (!generatingSince) return;
    const firstIssueTs = issues?.[0]?.publishedAt
      ? new Date(issues[0].publishedAt).getTime()
      : 0;
    if (firstIssueTs > generatingSince) {
      setGeneratingSince(null);
      return;
    }
    if (Date.now() - generatingSince > 15 * 60 * 1000) {
      setGeneratingSince(null);
      return;
    }
    const t = setTimeout(() => {
      refetchIssues();
    }, 20_000);
    return () => clearTimeout(t);
  }, [generatingSince, issues]);

  async function onSubmitClarification(e: React.FormEvent) {
    e.preventDefault();
    if (!beatId) return;
    const reply = clarifyReply.trim();
    if (!reply) return;
    setClarifyPending(true);
    try {
      await submitClarification({ beatId, reply });
      setClarifyReply("");
      // Close current SSE (it already ended after replaying questions) and
      // reconnect so the server re-reads status + picks up the reply.
      abortRef.current?.abort();
      setEvents([]); // optional: clear transcript for the follow-up pass
      await refetchBeat();
      setStreamEpoch((n) => n + 1);
    } catch (err: any) {
      setStreamError(err?.message ?? String(err));
    } finally {
      setClarifyPending(false);
    }
  }

  async function onTrigger() {
    if (!beatId || triggerPending) return;
    setTriggerPending(true);
    setTriggerError(null);
    try {
      await triggerOnDemandRun({ beatId });
      setGeneratingSince(Date.now());
      refetchIssues();
    } catch (err: any) {
      setTriggerError(err?.message ?? String(err));
    } finally {
      setTriggerPending(false);
    }
  }
  async function onPause() {
    if (!beatId) return;
    await pauseBeat({ beatId });
    refetchBeat();
  }
  async function onResume() {
    if (!beatId) return;
    await resumeBeat({ beatId });
    refetchBeat();
  }
  async function onDelete() {
    if (!beatId) return;
    if (!confirm("Delete this beat? This cannot be undone.")) return;
    await deleteBeat({ beatId });
    navigate("/dashboard");
  }

  if (beatLoading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }
  if (beatError || !beat) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-red-600">Beat not found.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const defaultsApplied: string[] = (() => {
    try {
      return JSON.parse(beat.defaultsApplied || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link to="/dashboard" className="text-sm text-neutral-500 hover:underline">
        ← Back to dashboard
      </Link>

      <header className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{beat.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded px-2 py-0.5 font-medium ${statusColor(beat.status)}`}
            >
              {beat.status}
            </span>
            <span className="text-neutral-500">
              {beat.cadenceType === "TIME_BASED"
                ? `cron: ${beat.cronExpression} (${beat.timezone})`
                : "On-demand"}
            </span>
            <span className="text-neutral-500">depth: {beat.depth}</span>
            {beat.sourceCount != null && (
              <span className="text-neutral-500">
                {beat.sourceCount} sources ({beat.coverageAssessment ?? "—"})
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {beat.status === "ACTIVE" && (
            <>
              <button
                onClick={onTrigger}
                disabled={triggerPending || generatingSince !== null}
                className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {triggerPending
                  ? "Queuing…"
                  : generatingSince
                    ? "Generating…"
                    : "Run now"}
              </button>
              <button
                onClick={onPause}
                className="rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
              >
                Pause
              </button>
            </>
          )}
          {beat.status === "PAUSED" && (
            <button
              onClick={onResume}
              className="rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
            >
              Resume
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </header>

      {/* Brief + spec summary */}
      <section className="mt-6 rounded border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Brief</h2>
        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
          {beat.brief}
        </p>
        {beat.summary && (
          <>
            <h2 className="mt-4 text-sm font-semibold text-neutral-700">
              Spec summary
            </h2>
            <p className="mt-1 text-sm text-neutral-800">{beat.summary}</p>
          </>
        )}
        {defaultsApplied.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            Defaults applied: {defaultsApplied.join(", ")}
          </p>
        )}
        {beat.coverageNote && (
          <p className="mt-2 text-xs text-neutral-500">
            Coverage: {beat.coverageNote}
          </p>
        )}
      </section>

      {/* Live creation feed */}
      {STREAMABLE.has(beat.status) && (
        <section className="mt-6 rounded border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="text-sm font-semibold text-neutral-700">
            Live status
          </h2>
          {streamError && (
            <p className="mt-2 text-xs text-red-600">stream: {streamError}</p>
          )}
          <ul className="mt-2 space-y-1 text-xs text-neutral-700">
            {events.length === 0 && (
              <li className="text-neutral-400">Waiting for agent…</li>
            )}
            {events.map((e, i) => (
              <li key={i}>
                <span className="font-mono text-neutral-500">{e.type}</span>
                {" — "}
                {renderEventPayload(e)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Clarification form */}
      {beat.status === "AWAITING_CLARIFICATION" && latestClarify && (
        <section className="mt-6 rounded border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-blue-900">
            Designer needs clarification
          </h2>
          {latestClarify.reasoning && (
            <p className="mt-1 text-xs text-blue-800">
              {latestClarify.reasoning}
            </p>
          )}
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-900">
            {latestClarify.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <form onSubmit={onSubmitClarification} className="mt-3">
            <textarea
              value={clarifyReply}
              onChange={(e) => setClarifyReply(e.target.value)}
              rows={3}
              placeholder="Your answer…"
              maxLength={4000}
              className="w-full rounded border border-blue-300 bg-white p-2 text-sm focus:border-blue-500 focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={clarifyPending}
              className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {clarifyPending ? "Submitting…" : "Submit answer"}
            </button>
          </form>
        </section>
      )}

      {/* On-demand trigger feedback */}
      {triggerError && (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
          Trigger failed: {triggerError}
        </p>
      )}
      {generatingSince && (
        <p className="mt-4 rounded bg-neutral-100 p-3 text-sm text-neutral-700">
          Issue generation queued. The Editor runs in the background (~5–10
          min) and will appear below when ready. Polling every 20s.
        </p>
      )}

      {/* Issues list */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Past issues</h2>
        {!issues || issues.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No issues yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {issues.map((iss) => (
              <li
                key={iss.id}
                className="rounded border border-neutral-200 bg-white p-3"
              >
                <Link
                  to={`/beats/${beatId}/issues/${iss.id}`}
                  className="block hover:underline"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="truncate text-sm font-semibold">
                      {iss.subject}
                    </h3>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {new Date(iss.publishedAt).toLocaleString()}
                    </span>
                  </div>
                  {iss.dek && (
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                      {iss.dek}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-neutral-400">
                    email: {iss.emailStatus}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function renderEventPayload(e: SseEvent): string {
  switch (e.type) {
    case "designer.thinking":
    case "editor.thinking":
      return e.message;
    case "designer.needs_clarification":
      return `${e.questions.length} question${e.questions.length === 1 ? "" : "s"}`;
    case "designer.finalized":
      return e.summary;
    case "scout.progress":
      return e.note;
    case "scout.complete":
      return `${e.sourceCount} sources (${e.coverage}) — ${e.note}`;
    case "editor.published":
      return `issue ${e.issueId}`;
    case "beat.ready":
      return "ready";
    case "beat.failed":
      return e.error;
    default:
      return "";
  }
}
