import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { AppShell } from "../../layout/AppShell";
import { Masthead } from "../../layout/Masthead";
import { Icon } from "../../components/editorial/Icon";
import { EditorialButton } from "../../components/editorial/Button";
import { cadenceLabel } from "../../shared/cadence";
import { formatShortDate } from "../../lib/formatting";
import type { ClarificationSummary } from "../../hooks/useBeatActions";

interface Issue {
  id: string;
  subject: string;
  dek?: string | null;
  publishedAt: Date | string;
  issueDate?: Date | string | null;
  emailStatus: string;
}

interface ActivePanelProps {
  beat: {
    id: string;
    title: string;
    brief: string;
    summary: string | null;
    status: string;
    cadenceType: string;
    cronExpression: string | null;
    timezone?: string | null;
    depth: string;
    outputLanguage: string;
    sourceCount: number | null;
    coverageAssessment: string | null;
    coverageNote: string | null;
    createdAt: Date | string;
  };
  issues: Issue[] | undefined;
  sourceDomains: string[];
  isGenerating: boolean;
  triggerPending: boolean;
  triggerError: string | null;
  sessionLinkId: string | null;
  userEmail: string | null;
  onTrigger: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  pausePending: boolean;
  deletePending: boolean;
  agentEventsError: unknown;
  latestClarification: ClarificationSummary | null;
  sendClarification: (reply: string) => Promise<void>;
  clarifyPending: boolean;
  clarifyError: string | null;
}

function usePhaseStatusPill(status: string): string | null {
  const { t } = useLingui();
  switch (status) {
    case "DRAFT":
      return t`Reading your brief…`;
    case "DESIGNING":
      return t`Drafting the spec…`;
    case "AWAITING_CLARIFICATION":
      return t`One question for you`;
    case "SCOUTING":
      return t`Finding sources…`;
    default:
      return null;
  }
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
    <div className="chat-composer" style={{ marginTop: 18 }}>
      {clarifyError ? (
        <div className="editorial-error" style={{ marginTop: 0, marginBottom: 12 }}>
          {clarifyError}
        </div>
      ) : null}
      {questions.length > 0 ? (
        <ol
          className="pb-body"
          style={{ marginBottom: 10, paddingLeft: 18 }}
        >
          {questions.map((q, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {q}
            </li>
          ))}
        </ol>
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

export function ActivePanel(props: ActivePanelProps) {
  const { t, i18n } = useLingui();
  const DEPTH_LABEL: Record<string, string> = {
    BRIEF: t`Tight · 3–5 picks`,
    STANDARD: t`Standard · 8–12 picks`,
    DEEP: t`Deep · everything that matters`,
  };
  const {
    beat,
    issues,
    sourceDomains,
    isGenerating,
    triggerPending,
    triggerError,
    sessionLinkId,
    userEmail,
    onTrigger,
    onPause,
    onResume,
    onDelete,
    pausePending,
    deletePending,
    agentEventsError,
    latestClarification,
    sendClarification,
    clarifyPending,
    clarifyError,
  } = props;

  const isPaused = beat.status === "PAUSED";
  const isActive = beat.status === "ACTIVE";
  const isFailed = beat.status === "FAILED";
  const phasePill = usePhaseStatusPill(beat.status);
  const isDesignerPhase = phasePill !== null;
  const showLiveSections = isActive || isPaused;
  const awaiting =
    beat.status === "AWAITING_CLARIFICATION" && !!latestClarification;

  const cadence = cadenceLabel(beat, i18n);
  const depth = DEPTH_LABEL[beat.depth] ?? beat.depth;
  const lang = (beat.outputLanguage ?? "").toUpperCase();
  const nextRun = beat.cadenceType === "ON_DEMAND" ? t`On demand` : cadence;
  const createdAtLabel = formatShortDate(beat.createdAt, i18n.locale);
  const title = beat.title?.trim() ? beat.title : t`Untitled beat`;

  return (
    <AppShell>
      <Masthead />

      <header className="b-hero">
        <div className="meta">
          {isActive ? (
            <span className="live"><Trans>Active</Trans></span>
          ) : isPaused ? (
            <span><Trans>Paused</Trans></span>
          ) : isFailed ? (
            <span><Trans>Failed</Trans></span>
          ) : (
            <span>{beat.status}</span>
          )}
          {showLiveSections ? (
            <span>
              <Trans>· Next run: {nextRun}</Trans>
            </span>
          ) : null}
          <span>· {depth}</span>
          <span>· {lang}</span>
          <span>
            <Trans>· est. {createdAtLabel}</Trans>
          </span>
        </div>
        <h1>{title}</h1>
        <p className="pitch">{beat.summary ?? beat.brief}</p>
        {sourceDomains.length > 0 ? (
          <div
            className="src-list"
            style={{ marginTop: 14, maxWidth: 700 }}
            aria-label={t`Source domains`}
          >
            {sourceDomains.map((d) => (
              <span key={d} className="src">
                {d}
              </span>
            ))}
          </div>
        ) : null}
        <div className="actions">
          {isPaused ? (
            <button
              type="button"
              className="pb-btn"
              onClick={onResume}
              disabled={pausePending}
            >
              <Icon name="play" size={13} />
              <span><Trans>Resume</Trans></span>
            </button>
          ) : null}
          {isActive ? (
            <button
              type="button"
              className="pb-btn"
              onClick={onPause}
              disabled={pausePending}
            >
              <Icon name="pause" size={13} />
              <span><Trans>Pause</Trans></span>
            </button>
          ) : null}
          <button
            type="button"
            className="pb-btn"
            onClick={onDelete}
            disabled={deletePending}
            aria-label={t`Delete beat`}
          >
            <Icon name="trash" size={13} />
            <span><Trans>Delete</Trans></span>
          </button>
          {showLiveSections ? (
            <button
              type="button"
              className="pb-btn pb-btn-signal"
              onClick={onTrigger}
              disabled={triggerPending || isGenerating || !isActive}
            >
              <Icon name="play" size={13} />
              <span>
                {triggerPending
                  ? t`Queuing…`
                  : isGenerating
                    ? t`Generating…`
                    : t`Send me one now`}
              </span>
            </button>
          ) : null}
        </div>
        {triggerError ? (
          <div className="editorial-error" style={{ marginTop: 18 }}>
            {triggerError}
          </div>
        ) : null}
        {agentEventsError && isDesignerPhase ? (
          <div className="editorial-error" style={{ marginTop: 18 }}>
            <Trans>Connection interrupted — still listening for the designer.</Trans>
          </div>
        ) : null}
        {isGenerating || isDesignerPhase ? (
          <div
            className="row pb-enter"
            style={{
              marginTop: 18,
              padding: "10px 12px",
              background: "var(--paper-2)",
              border: "var(--hairline) solid var(--rule)",
              borderRadius: 6,
              gap: 10,
              fontSize: 12,
              color: "var(--ink-2)",
            }}
          >
            <span className="dot live" />
            <span>
              {isDesignerPhase ? (
                phasePill
              ) : (
                <Trans>Editor working — first issue drops in a few minutes.</Trans>
              )}
            </span>
            {sessionLinkId ? (
              <a
                href={`https://platform.claude.com/sessions/${sessionLinkId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                }}
              >
                <Trans>session ↗</Trans>
              </a>
            ) : null}
          </div>
        ) : null}
        {awaiting ? (
          <ClarifyComposer
            sendClarification={sendClarification}
            clarifyPending={clarifyPending}
            clarifyError={clarifyError}
            questions={latestClarification?.questions ?? []}
            reasoning={latestClarification?.reasoning ?? ""}
          />
        ) : null}
      </header>

      {showLiveSections ? (
        <section className="b-issues">
          <h3><Trans>Past issues</Trans></h3>
          {!issues || issues.length === 0 ? (
            <div style={{ padding: "26px 0", color: "var(--ink-3)" }} className="pb-body">
              <Trans>No issues delivered yet.</Trans>
              {isActive
                ? <Trans> The first one will land on the schedule above.</Trans>
                : <Trans> Resume the beat or run it on demand to produce one.</Trans>}
            </div>
          ) : (
            <div>
              {issues.map((iss, i) => {
                const n = issues.length - i;
                return (
                  <Link
                    key={iss.id}
                    to={`/beats/${beat.id}/issues/${iss.id}`}
                    className="iss"
                  >
                    <div className="num">№ {String(n).padStart(2, "0")}</div>
                    <div>
                      <div className="h">{iss.subject}</div>
                      {iss.dek ? <div className="s">{iss.dek}</div> : null}
                    </div>
                    <div className="right">
                      <div className="when">
                        {formatShortDate(iss.issueDate ?? iss.publishedAt, i18n.locale)}
                      </div>
                      <div className="vote">
                        {iss.emailStatus.toLowerCase()}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {userEmail ? (
            <p
              className="sub"
              style={{
                marginTop: 22,
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              <Trans>Delivered to {userEmail}</Trans>
            </p>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
