import { useMemo, useState, type KeyboardEvent } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
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
}

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  body: string;
  meta?: string;
  occurredAt?: Date | string;
}

function useStatusCopy(): Record<string, { eyebrow: string; title: string }> {
  const { t } = useLingui();
  return {
    DRAFT: {
      eyebrow: t`Designer · getting started`,
      title: t`Reviewing your brief.`,
    },
    DESIGNING: {
      eyebrow: t`Designer · working`,
      title: t`Drafting the spec.`,
    },
    AWAITING_CLARIFICATION: {
      eyebrow: t`Designer · one question`,
      title: t`Quick clarification before I file this beat.`,
    },
    SCOUTING: {
      eyebrow: t`Scout · looking for sources`,
      title: t`Finding the right sources for this beat.`,
    },
  };
}

function shortType(type: string): string {
  return type.replace(/^designer\./, "").replace(/^scout\./, "").replace(/_/g, " ");
}

function itemsFromEvents(
  beat: DesignerPanelProps["beat"],
  events: TranscriptEvent[] | undefined,
  t: (literals: TemplateStringsArray, ...placeholders: any[]) => string,
): ChatItem[] {
  const rows: ChatItem[] = [];
  rows.push({
    id: "seed",
    role: "user",
    body: beat.brief,
    meta: t`Your brief`,
  });
  if (!events) return rows;
  for (const e of events) {
    const p = parseEventPayload(e.payload);
    if (e.type === "designer.thinking") {
      const msg = String(p.message ?? "").trim();
      if (!msg) continue;
      rows.push({ id: e.id, role: "assistant", body: msg, meta: t`Designer`, occurredAt: e.occurredAt });
    } else if (e.type === "designer.needs_clarification") {
      const qs = Array.isArray(p.questions) ? (p.questions as string[]) : [];
      const reason = String(p.reasoning ?? "").trim();
      const body =
        (reason ? `${reason}\n\n` : "") +
        qs.map((q, i) => `${i + 1}. ${q}`).join("\n");
      rows.push({
        id: e.id,
        role: "assistant",
        body: body || t`I have a follow-up question.`,
        meta: t`Designer · needs clarification`,
        occurredAt: e.occurredAt,
      });
    } else if (e.type === "designer.finalized") {
      const summary = String(p.summary ?? "").trim();
      rows.push({
        id: e.id,
        role: "assistant",
        body: summary || t`Spec finalized.`,
        meta: t`Designer · finalized`,
        occurredAt: e.occurredAt,
      });
    } else if (e.type === "scout.progress") {
      const msg = String(p.message ?? p.note ?? "").trim();
      if (!msg) continue;
      rows.push({ id: e.id, role: "assistant", body: msg, meta: t`Scout`, occurredAt: e.occurredAt });
    } else if (e.type === "scout.complete") {
      rows.push({
        id: e.id,
        role: "assistant",
        body: t`Found ${p.sourceCount ?? "?"} sources (${p.coverage ?? "—"}). ${p.note ?? ""}`.trim(),
        meta: t`Scout · complete`,
        occurredAt: e.occurredAt,
      });
    } else if (e.type === "beat.failed") {
      rows.push({
        id: e.id,
        role: "assistant",
        body: String(p.error ?? t`Something went wrong.`),
        meta: t`Designer · failed`,
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
      <span className="eyebrow-mono"><Trans>Brief completeness</Trans></span>
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
  const { t } = useLingui();
  const STATUS_COPY = useStatusCopy();
  const defaults: string[] = (() => {
    try {
      const parsed = JSON.parse(beat.defaultsApplied || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();
  const copy = STATUS_COPY[beat.status];
  const title = beat.title?.trim() ? beat.title : t`Untitled beat`;
  const topicMuted = !beat.summary;
  const phase = copy ? copy.eyebrow.split(" · ")[1] : beat.status.toLowerCase();
  return (
    <div className="spec-card">
      <div className="spec-card-h">
        <span className="eyebrow-mono">
          <Trans>Beat draft · {phase}</Trans>
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
        <div className="k"><Trans>Topic</Trans></div>
        <div className={`v${beat.summary ? "" : " muted"}`}>
          {beat.summary ?? t`awaiting spec`}
        </div>
        <div className="k"><Trans>Language</Trans></div>
        <div className="v">{beat.outputLanguage?.toUpperCase() ?? "—"}</div>
        <div className="k"><Trans>Cadence</Trans></div>
        <div className="v">
          {beat.cadenceType === "ON_DEMAND"
            ? t`On demand`
            : beat.cronExpression
              ? t`cron: ${beat.cronExpression}`
              : "—"}
        </div>
        <div className="k"><Trans>Depth</Trans></div>
        <div className="v">{beat.depth}</div>
        <div className="k"><Trans>Rules</Trans></div>
        <div className={`v${defaults.length === 0 ? " muted" : ""}`}>
          {defaults.length === 0
            ? t`none yet`
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
        <Trans>
          When the spec is locked, the Scout looks for sources and the beat becomes
          live. You'll get the first issue on the cadence above.
        </Trans>
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
  const { t } = useLingui();
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
    ? t`Answer: ${questions[0]}`
    : t`Type your answer…`;

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
            <span><Trans>to send</Trans></span>
          </div>
          <EditorialButton
            variant="primary"
            disabled={clarifyPending || reply.trim().length === 0}
            onClick={submit}
          >
            <Icon name="send" size={13} />
            <span>{clarifyPending ? <Trans>Sending</Trans> : <Trans>Reply</Trans>}</span>
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
}: DesignerPanelProps) {
  const { t } = useLingui();
  const STATUS_COPY = useStatusCopy();
  const items = useMemo(() => itemsFromEvents(beat, events, t), [beat, events, t]);
  const awaiting = beat.status === "AWAITING_CLARIFICATION" && !!latestClarification;
  const copy = STATUS_COPY[beat.status] ?? {
    eyebrow: t`Designer`,
    title: t`Working on your beat.`,
  };

  return (
    <AppShell>
      <Masthead />

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
                <Trans>Connection interrupted — still listening for the designer.</Trans>
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
              <div className="chat-meta pb-typing"><Trans>Waiting for the designer to respond…</Trans></div>
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
                  ? t`Scouting sources…`
                  : t`Designer at work — reply field appears when you're needed.`}
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
