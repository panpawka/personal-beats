import { Link, useNavigate } from "react-router";
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

const DEPTH_LABEL: Record<string, string> = {
  BRIEF: "Tight · 3–5 picks",
  STANDARD: "Standard · 8–12 picks",
  DEEP: "Deep · everything that matters",
};

export function ActivePanel(props: ActivePanelProps) {
  const navigate = useNavigate();
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

  return (
    <AppShell>
      <Masthead
        section={`The beat · ${beat.title}`}
        subMiddle={isActive ? "Live" : isPaused ? "Paused" : beat.status.toLowerCase()}
        right={
          <>
            <EditorialButton variant="ghost" onClick={() => navigate("/dashboard")}>
              <Icon name="arrow-left" size={13} />
              <span>All beats</span>
            </EditorialButton>
          </>
        }
      />

      <header className="b-hero">
        <div className="meta">
          {isActive ? (
            <span className="live">Active</span>
          ) : isPaused ? (
            <span>Paused</span>
          ) : (
            <span>{beat.status}</span>
          )}
          <span>· Next run: {beat.cadenceType === "ON_DEMAND" ? "On demand" : cadence}</span>
          <span>· {depth}</span>
          <span>· {lang}</span>
          <span>· est. {formatShortDate(beat.createdAt)}</span>
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
              <span>Resume</span>
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
              <span>Pause</span>
            </button>
          ) : null}
          <button
            type="button"
            className="pb-btn"
            onClick={onDelete}
            disabled={deletePending}
            aria-label="Delete beat"
          >
            <Icon name="trash" size={13} />
            <span>Delete</span>
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
                ? "Queuing…"
                : isGenerating
                  ? "Generating…"
                  : "Send me one now"}
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
            <span>Editor working — first issue drops in a few minutes.</span>
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
                session ↗
              </a>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="twocol">
        <div>
          <h3>Past issues</h3>
          {!issues || issues.length === 0 ? (
            <div style={{ padding: "26px 0", color: "var(--ink-3)" }} className="pb-body">
              No issues delivered yet.
              {isActive
                ? " The first one will land on the schedule above."
                : " Resume the beat or run it on demand to produce one."}
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
            <h4>What I've learned</h4>
            <p className="sub">
              {beat.coverageAssessment
                ? `Coverage looks ${beat.coverageAssessment} so far.`
                : "Patterns will appear here once a few issues ship."}
            </p>
            <div className="learned">
              <div className="row">
                <span className="sign plus">+</span>
                <span>Lead with the most actionable item in the issue.</span>
              </div>
              <div className="row">
                <span className="sign plus">+</span>
                <span>Cite primary sources before commentary.</span>
              </div>
              {beat.coverageNote ? (
                <div className="row">
                  <span className="sign plus">+</span>
                  <span>{beat.coverageNote}</span>
                </div>
              ) : null}
              <div className="row">
                <span className="sign minus">−</span>
                <span>Skip listicle-style filler — go straight to specifics.</span>
              </div>
            </div>
            {userEmail ? (
              <p
                className="sub"
                style={{ marginTop: 14, fontFamily: "var(--mono)", letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                Delivered to {userEmail}
              </p>
            ) : null}
          </div>

          <div className="side-block">
            <h4>Sources I rely on</h4>
            <p className="sub">
              {sourceTotal > 0
                ? `Tracking ${sourceTotal} source${sourceTotal === 1 ? "" : "s"}.`
                : "Source list will fill in as issues ship."}
            </p>
            <div className="src-list">
              {sourceTotal > 0 ? (
                <span className="src">{sourceTotal} sources tracked</span>
              ) : (
                <span className="src">awaiting first issue</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
