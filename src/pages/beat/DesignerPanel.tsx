import { useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "../../layout/AppShell";
import { Masthead } from "../../layout/Masthead";
import { EditorialButton } from "../../components/editorial/Button";
import { Icon } from "../../components/editorial/Icon";
import {
  parseEventPayload,
  type TranscriptEvent,
  type ClarificationSummary,
} from "../../hooks/useBeatActions";

interface DesignerPanelProps {
  beat: {
    id: string;
    title: string;
    brief: string;
    summary: string | null;
    status: string;
    cadenceType: string;
    cronExpression: string | null;
    outputLanguage: string;
    depth: string;
    defaultsApplied: string;
  };
  events: TranscriptEvent[] | undefined;
  agentEventsError: unknown;
  latestClarification: ClarificationSummary | null;
  sendClarification: (reply: string) => Promise<void>;
  clarifyPending: boolean;
  clarifyError: string | null;
  onCancel: () => void;
  onDelete: () => void;
  deletePending: boolean;
}

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  body: string;
  meta?: string;
  occurredAt?: Date | string;
}

const STATUS_COPY: Record<string, { eyebrow: string; title: string }> = {
  DRAFT: {
    eyebrow: "Designer · getting started",
    title: "Reviewing your brief.",
  },
  DESIGNING: {
    eyebrow: "Designer · working",
    title: "Drafting the spec.",
  },
  AWAITING_CLARIFICATION: {
    eyebrow: "Designer · one question",
    title: "Quick clarification before I file this beat.",
  },
  SCOUTING: {
    eyebrow: "Scout · looking for sources",
    title: "Finding the right sources for this beat.",
  },
};

function shortType(type: string): string {
  return type.replace(/^designer\./, "").replace(/^scout\./, "").replace(/_/g, " ");
}

function itemsFromEvents(
  beat: DesignerPanelProps["beat"],
  events: TranscriptEvent[] | undefined,
): ChatItem[] {
  const rows: ChatItem[] = [];
  rows.push({
    id: "seed",
    role: "user",
    body: beat.brief,
    meta: "Your brief",
  });
  if (!events) return rows;
  for (const e of events) {
    const p = parseEventPayload(e.payload);
    if (e.type === "designer.thinking") {
      const msg = String(p.message ?? "").trim();
      if (!msg) continue;
      rows.push({ id: e.id, role: "assistant", body: msg, meta: "Designer", occurredAt: e.occurredAt });
    } else if (e.type === "designer.needs_clarification") {
      const qs = Array.isArray(p.questions) ? (p.questions as string[]) : [];
      const reason = String(p.reasoning ?? "").trim();
      const body =
        (reason ? `${reason}\n\n` : "") +
        qs.map((q, i) => `${i + 1}. ${q}`).join("\n");
      rows.push({
        id: e.id,
        role: "assistant",
        body: body || "I have a follow-up question.",
        meta: "Designer · needs clarification",
        occurredAt: e.occurredAt,
      });
    } else if (e.type === "designer.finalized") {
      const summary = String(p.summary ?? "").trim();
      rows.push({
        id: e.id,
        role: "assistant",
        body: summary || "Spec finalized.",
        meta: "Designer · finalized",
        occurredAt: e.occurredAt,
      });
    } else if (e.type === "scout.progress") {
      const msg = String(p.message ?? p.note ?? "").trim();
      if (!msg) continue;
      rows.push({ id: e.id, role: "assistant", body: msg, meta: "Scout", occurredAt: e.occurredAt });
    } else if (e.type === "scout.complete") {
      rows.push({
        id: e.id,
        role: "assistant",
        body: `Found ${p.sourceCount ?? "?"} sources (${p.coverage ?? "—"}). ${p.note ?? ""}`.trim(),
        meta: "Scout · complete",
        occurredAt: e.occurredAt,
      });
    } else if (e.type === "beat.failed") {
      rows.push({
        id: e.id,
        role: "assistant",
        body: String(p.error ?? "Something went wrong."),
        meta: "Designer · failed",
        occurredAt: e.occurredAt,
      });
    } else {
      // generic fallthrough
      const msg = String(p.message ?? "").trim();
      if (msg) {
        rows.push({
          id: e.id,
          role: "assistant",
          body: msg,
          meta: shortType(e.type),
          occurredAt: e.occurredAt,
        });
      }
    }
  }
  return rows;
}

function Completeness({ beat, events }: { beat: DesignerPanelProps["beat"]; events: TranscriptEvent[] | undefined }) {
  // Rough heuristic: DRAFT 10 · DESIGNING 45 · AWAITING 65 · SCOUTING 85 · else 100
  let pct = 10;
  if (beat.status === "DESIGNING") pct = 45;
  if (beat.status === "AWAITING_CLARIFICATION") pct = 65;
  if (beat.status === "SCOUTING") pct = 85;
  if (beat.status === "ACTIVE" || beat.status === "PAUSED") pct = 100;
  // Lift by events count to show motion
  if (events?.length) pct = Math.min(pct + Math.min(events.length, 5) * 2, 95);
  return (
    <div className="confidence">
      <span className="eyebrow-mono">Brief completeness</span>
      <div className="confidence-bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <span className="ui-xs">{pct}%</span>
    </div>
  );
}

function SpecCard({
  beat,
  events,
}: {
  beat: DesignerPanelProps["beat"];
  events: TranscriptEvent[] | undefined;
}) {
  const defaults: string[] = (() => {
    try {
      const parsed = JSON.parse(beat.defaultsApplied || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();
  const copy = STATUS_COPY[beat.status];
  const title = beat.title?.trim() ? beat.title : "Untitled beat";
  const topicMuted = !beat.summary;
  return (
    <div className="spec-card">
      <div className="spec-card-h">
        <span className="eyebrow-mono">
          Beat draft · {copy ? copy.eyebrow.split(" · ")[1] : beat.status.toLowerCase()}
        </span>
        <span className="ui-xs">{beat.status}</span>
      </div>
      <div
        className="h-2"
        style={{
          padding: "18px 0 14px",
          color: topicMuted ? "var(--ink-4)" : "var(--ink)",
          fontStyle: topicMuted ? "italic" : "normal",
        }}
      >
        {title}
      </div>
      <div className="spec-table">
        <div className="k">Topic</div>
        <div className={`v${beat.summary ? "" : " muted"}`}>
          {beat.summary ?? "awaiting spec"}
        </div>
        <div className="k">Language</div>
        <div className="v">{beat.outputLanguage?.toUpperCase() ?? "—"}</div>
        <div className="k">Cadence</div>
        <div className="v">
          {beat.cadenceType === "ON_DEMAND"
            ? "On demand"
            : beat.cronExpression
              ? `cron: ${beat.cronExpression}`
              : "—"}
        </div>
        <div className="k">Depth</div>
        <div className="v">{beat.depth}</div>
        <div className="k">Rules</div>
        <div className={`v${defaults.length === 0 ? " muted" : ""}`}>
          {defaults.length === 0
            ? "none yet"
            : defaults.map((d) => (
                <span className="tag" key={d}>
                  {d}
                </span>
              ))}
        </div>
      </div>
      <Completeness beat={beat} events={events} />
      <p
        className="pb-body"
        style={{
          padding: "18px 0 6px",
          borderTop: "var(--hairline) dashed var(--rule)",
          marginTop: 14,
        }}
      >
        When the spec is locked, the Scout looks for sources and the beat becomes
        live. You'll get the first issue on the cadence above.
      </p>
    </div>
  );
}

function ClarifyComposer({
  sendClarification,
  clarifyPending,
  clarifyError,
  questions,
  reasoning,
}: {
  sendClarification: (r: string) => Promise<void>;
  clarifyPending: boolean;
  clarifyError: string | null;
  questions: string[];
  reasoning: string;
}) {
  const [reply, setReply] = useState("");

  async function submit() {
    if (clarifyPending) return;
    const trimmed = reply.trim();
    if (!trimmed) return;
    await sendClarification(trimmed);
    setReply("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  const placeholder = questions[0]
    ? `Answer: ${questions[0]}`
    : "Type your answer…";

  return (
    <div className="chat-composer">
      {clarifyError ? (
        <div className="editorial-error" style={{ marginTop: 0, marginBottom: 12 }}>
          {clarifyError}
        </div>
      ) : null}
      {reasoning ? (
        <p
          className="ui-xs"
          style={{ marginBottom: 8, color: "var(--ink-3)", fontStyle: "italic" }}
        >
          {reasoning}
        </p>
      ) : null}
      <div className="composer-box">
        <textarea
          className="composer-input"
          placeholder={placeholder}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
        />
        <div className="composer-foot">
          <div className="composer-hints">
            <span className="kbd">⌘↵</span>
            <span>to send</span>
          </div>
          <EditorialButton
            variant="primary"
            disabled={clarifyPending || reply.trim().length === 0}
            onClick={submit}
          >
            <Icon name="send" size={13} />
            <span>{clarifyPending ? "Sending" : "Reply"}</span>
          </EditorialButton>
        </div>
      </div>
    </div>
  );
}

export function DesignerPanel({
  beat,
  events,
  agentEventsError,
  latestClarification,
  sendClarification,
  clarifyPending,
  clarifyError,
  onCancel,
  onDelete,
  deletePending,
}: DesignerPanelProps) {
  const navigate = useNavigate();
  void navigate;
  const items = useMemo(() => itemsFromEvents(beat, events), [beat, events]);
  const awaiting = beat.status === "AWAITING_CLARIFICATION" && !!latestClarification;
  const copy = STATUS_COPY[beat.status] ?? {
    eyebrow: "Designer",
    title: "Working on your beat.",
  };

  return (
    <AppShell>
      <Masthead
        title={copy.title}
        right={
          <>
            <EditorialButton variant="ghost" onClick={onCancel}>
              Back to beats
            </EditorialButton>
            <EditorialButton
              variant="ghost"
              onClick={onDelete}
              disabled={deletePending}
            >
              <Icon name="trash" size={13} />
              <span>Discard</span>
            </EditorialButton>
          </>
        }
      />

      <div className="designer">
        <div className="designer-l">
          <div className="chat-stream">
            <div>
              <div className="eyebrow-mono">{copy.eyebrow}</div>
              <h1 className="h-1" style={{ margin: "8px 0 14px" }}>
                {copy.title}
              </h1>
            </div>

            {agentEventsError ? (
              <div className="editorial-error">
                Connection interrupted — still listening for the designer.
              </div>
            ) : null}

            {items.map((it) => (
              <div
                key={it.id}
                className={`chat-row ${it.role === "user" ? "user" : ""}`}
              >
                {it.role === "assistant" ? (
                  <div className="chat-avatar" aria-hidden>
                    PB
                  </div>
                ) : null}
                <div>
                  <div className="chat-bubble" style={{ whiteSpace: "pre-wrap" }}>
                    {it.body}
                  </div>
                  {it.meta ? <div className="chat-meta">{it.meta}</div> : null}
                </div>
              </div>
            ))}

            {!events || events.length === 0 ? (
              <div className="chat-meta pb-typing">Waiting for the designer to respond…</div>
            ) : null}
          </div>

          {awaiting ? (
            <ClarifyComposer
              sendClarification={sendClarification}
              clarifyPending={clarifyPending}
              clarifyError={clarifyError}
              questions={latestClarification?.questions ?? []}
              reasoning={latestClarification?.reasoning ?? ""}
            />
          ) : (
            <div className="chat-composer">
              <div
                className="ui-xs"
                style={{ color: "var(--ink-3)", textAlign: "center", padding: "6px 0" }}
              >
                {beat.status === "SCOUTING"
                  ? "Scouting sources…"
                  : "Designer at work — reply field appears when you're needed."}
              </div>
            </div>
          )}
        </div>

        <div className="designer-r">
          <SpecCard beat={beat} events={events} />
        </div>
      </div>
    </AppShell>
  );
}
