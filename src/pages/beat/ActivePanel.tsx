import { Link, useNavigate } from "react-router";
import { Trans, useLingui, Plural } from "@lingui/react/macro";
import { AppShell } from "../../layout/AppShell";
import { Masthead } from "../../layout/Masthead";
import { EditorialButton } from "../../components/editorial/Button";
import { Icon } from "../../components/editorial/Icon";
import { cadenceLabel } from "../../shared/cadence";
import { formatShortDate } from "../../lib/formatting";

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
}

export function ActivePanel(props: ActivePanelProps) {
  const navigate = useNavigate();
  const { t } = useLingui();
  const DEPTH_LABEL: Record<string, string> = {
    BRIEF: t`Tight · 3–5 picks`,
    STANDARD: t`Standard · 8–12 picks`,
    DEEP: t`Deep · everything that matters`,
  };
  const {
    beat,
    issues,
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
  } = props;

  const isPaused = beat.status === "PAUSED";
  const isActive = beat.status === "ACTIVE";
  const cadence = cadenceLabel(beat);
  const depth = DEPTH_LABEL[beat.depth] ?? beat.depth;
  const lang = (beat.outputLanguage ?? "").toUpperCase();
  const sourceTotal = beat.sourceCount ?? 0;
  const nextRun = beat.cadenceType === "ON_DEMAND" ? t`On demand` : cadence;
  const createdAtLabel = formatShortDate(beat.createdAt);

  return (
    <AppShell>
      <Masthead
        section={t`The beat · ${beat.title}`}
        subMiddle={isActive ? t`Live` : isPaused ? t`Paused` : beat.status.toLowerCase()}
        right={
          <>
            <EditorialButton variant="ghost" onClick={() => navigate("/dashboard")}>
              <Icon name="arrow-left" size={13} />
              <span><Trans>All beats</Trans></span>
            </EditorialButton>
          </>
        }
      />

      <header className="b-hero">
        <div className="meta">
          {isActive ? (
            <span className="live"><Trans>Active</Trans></span>
          ) : isPaused ? (
            <span><Trans>Paused</Trans></span>
          ) : (
            <span>{beat.status}</span>
          )}
          <span>
            <Trans>· Next run: {nextRun}</Trans>
          </span>
          <span>· {depth}</span>
          <span>· {lang}</span>
          <span>
            <Trans>· est. {createdAtLabel}</Trans>
          </span>
        </div>
        <h1>{beat.title}</h1>
        <p className="pitch">{beat.summary ?? beat.brief}</p>
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
        </div>
        {triggerError ? (
          <div className="editorial-error" style={{ marginTop: 18 }}>
            {triggerError}
          </div>
        ) : null}
        {isGenerating ? (
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
            <span><Trans>Editor working — first issue drops in a few minutes.</Trans></span>
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
      </header>

      <div className="twocol">
        <div>
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
                        {formatShortDate(iss.issueDate ?? iss.publishedAt)}
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
        </div>

        <div>
          <div className="side-block">
            <h4><Trans>What I've learned</Trans></h4>
            <p className="sub">
              {beat.coverageAssessment
                ? t`Coverage looks ${beat.coverageAssessment} so far.`
                : t`Patterns will appear here once a few issues ship.`}
            </p>
            <div className="learned">
              <div className="row">
                <span className="sign plus">+</span>
                <span><Trans>Lead with the most actionable item in the issue.</Trans></span>
              </div>
              <div className="row">
                <span className="sign plus">+</span>
                <span><Trans>Cite primary sources before commentary.</Trans></span>
              </div>
              {beat.coverageNote ? (
                <div className="row">
                  <span className="sign plus">+</span>
                  <span>{beat.coverageNote}</span>
                </div>
              ) : null}
              <div className="row">
                <span className="sign minus">−</span>
                <span><Trans>Skip listicle-style filler — go straight to specifics.</Trans></span>
              </div>
            </div>
            {userEmail ? (
              <p
                className="sub"
                style={{ marginTop: 14, fontFamily: "var(--mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                <Trans>Delivered to {userEmail}</Trans>
              </p>
            ) : null}
          </div>

          <div className="side-block">
            <h4><Trans>Sources I rely on</Trans></h4>
            <p className="sub">
              {sourceTotal > 0 ? (
                <Plural
                  value={sourceTotal}
                  one="Tracking # source."
                  other="Tracking # sources."
                />
              ) : (
                <Trans>Source list will fill in as issues ship.</Trans>
              )}
            </p>
            <div className="src-list">
              {sourceTotal > 0 ? (
                <span className="src">
                  <Plural
                    value={sourceTotal}
                    one="# source tracked"
                    other="# sources tracked"
                  />
                </span>
              ) : (
                <span className="src"><Trans>awaiting first issue</Trans></span>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
