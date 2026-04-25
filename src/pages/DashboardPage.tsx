import { Link, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, getBeats } from "wasp/client/operations";
import { Trans, useLingui } from "@lingui/react/macro";
import { AppShell } from "../layout/AppShell";
import { Masthead } from "../layout/Masthead";
import { cadenceLabel } from "../shared/cadence";

const SUGGESTED_BRIEFS = [
  "Climbing trips, weekend Europe",
  "Polish kid-lit new releases",
  "Wrocław restaurant openings",
  "Indie game launches",
];

function languageTag(lang: string): string {
  return (lang ?? "").toUpperCase();
}

interface BeatRow {
  id: string;
  title: string;
  brief: string;
  summary?: string | null;
  status: string;
  cadenceType: string;
  cronExpression: string | null;
  timezone?: string | null;
  depth: string;
  outputLanguage: string;
  sourceCount?: number | null;
  coverageAssessment?: string | null;
  issueCount?: number;
  lastIssueAt?: Date | string | null;
}

interface BeatStatusBucket {
  active: BeatRow[];
  planned: BeatRow[];
  paused: BeatRow[];
  designing: BeatRow[];
}

function bucket(beats: BeatRow[]): BeatStatusBucket {
  const out: BeatStatusBucket = { active: [], planned: [], paused: [], designing: [] };
  for (const b of beats) {
    if (b.status === "ACTIVE") out.active.push(b);
    else if (b.status === "PAUSED") out.paused.push(b);
    else if (b.status === "DRAFT") out.planned.push(b);
    else out.designing.push(b);
  }
  return out;
}

function pitch(b: BeatRow): string {
  const s = b.summary?.trim();
  if (s) return s.length > 220 ? `${s.slice(0, 217)}…` : s;
  const br = b.brief?.trim() ?? "";
  return br.length > 220 ? `${br.slice(0, 217)}…` : br;
}

function statusKind(b: BeatRow): "live" | "planned" | "paused" {
  if (b.status === "ACTIVE") return "live";
  if (b.status === "PAUSED") return "paused";
  return "planned";
}

function signalLevel(b: BeatRow): number {
  const c = b.coverageAssessment;
  if (c === "healthy") return 5;
  if (c === "thin") return 3;
  if (c === "sparse") return 1;
  return 3;
}

export function DashboardPage() {
  const { t } = useLingui();
  const { data: user } = useAuth();
  const { data: beats, isLoading, error } = useQuery(getBeats);
  const navigate = useNavigate();

  const greetText = (now: Date): string => {
    const h = now.getHours();
    if (h < 12) return t`Good morning`;
    if (h < 18) return t`Good afternoon`;
    return t`Good evening`;
  };

  const fullNameDisplay = (email: string | null | undefined): string => {
    if (!email) return t`there`;
    const local = email.split("@")[0] ?? "";
    if (!local) return t`there`;
    const first = local.split(/[._+-]/)[0] ?? local;
    return first.charAt(0).toUpperCase() + first.slice(1);
  };

  const safeBeats: BeatRow[] = Array.isArray(beats) ? (beats as BeatRow[]) : [];
  const buckets = bucket(safeBeats);
  const totalBeats = safeBeats.length;
  const totalIssues = safeBeats.reduce((acc, b) => acc + (b.issueCount ?? 0), 0);

  // Issues "this week"
  const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const issuesThisWeek = safeBeats.reduce<number>((acc, b) => {
    if (!b.lastIssueAt) return acc;
    const t = new Date(b.lastIssueAt).getTime();
    if (Number.isNaN(t)) return acc;
    return t >= oneWeekAgo ? acc + 1 : acc;
  }, 0);

  const sourcesRead = safeBeats.reduce((acc, b) => acc + (b.sourceCount ?? 0), 0);

  const email =
    (user as unknown as { email?: string } | null)?.email ??
    (user as unknown as { identities?: { email?: { id?: string } } } | null)
      ?.identities?.email?.id ??
    null;

  const now = new Date();
  const greet = greetText(now);
  const dayLabel = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const designingBeat = buckets.designing[0] ?? null;
  const allCards: BeatRow[] = [
    ...buckets.active,
    ...buckets.planned,
    ...buckets.designing,
    ...buckets.paused,
  ];

  function pickStarter(prompt: string) {
    try {
      sessionStorage.setItem("pb.newBeatSeed", prompt);
    } catch {
      // ignore
    }
    navigate("/beats/new");
  }

  return (
    <AppShell>
      <Masthead section={t`Today's edition`} subMiddle={dayLabel} />

      <div className="dash">
        <div className="greet">
          <h2>
            {greet}, <b>{fullNameDisplay(email)}</b>.
          </h2>
          <span className="meta">
            {dayLabel} · {timeLabel}
          </span>
        </div>

        {error ? (
          <div className="editorial-error">
            <Trans>Couldn't load your beats. Try again in a moment.</Trans>
          </div>
        ) : null}

        {isLoading ? (
          <div
            className="pb-loading"
            style={{
              fontFamily: "var(--mono)",
              color: "var(--ink-3)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "40px 0",
            }}
          >
            <Trans>Loading beats</Trans>
          </div>
        ) : (
          <>
            <div className="dash-stats">
              <div className="dash-stat">
                <div className="k"><Trans>Active beats</Trans></div>
                <div className="v">
                  {buckets.active.length}
                  <small>/{totalBeats || 0}</small>
                </div>
              </div>
              <div className="dash-stat">
                <div className="k"><Trans>Planned</Trans></div>
                <div className="v">{buckets.planned.length + buckets.designing.length}</div>
              </div>
              <div className="dash-stat">
                <div className="k"><Trans>Issues this week</Trans></div>
                <div className="v">{issuesThisWeek}</div>
              </div>
              <div className="dash-stat">
                <div className="k"><Trans>Sources read</Trans></div>
                <div className="v">{sourcesRead}</div>
              </div>
            </div>

            {designingBeat ? (
              <Link
                to={`/beats/${designingBeat.id}`}
                className="dash-working"
                style={{ textDecoration: "none" }}
              >
                <div className="working-pulse" aria-hidden />
                <div>
                  <div className="lbl"><Trans>Working on it now</Trans></div>
                  <div className="h">{designingBeat.title}</div>
                  <div className="s">
                    {designingBeat.status === "AWAITING_CLARIFICATION"
                      ? t`Designer is asking a question.`
                      : designingBeat.status === "SCOUTING"
                        ? t`Looking for sources to follow.`
                        : t`Drafting the spec.`}
                  </div>
                </div>
                <span className="pb-btn"><Trans>See progress</Trans></span>
              </Link>
            ) : null}

            <div className="sec-h">
              <div className="ttl"><Trans>Your beats</Trans></div>
              <div className="right">
                <Trans>
                  {buckets.active.length} running ·{" "}
                  {buckets.planned.length + buckets.designing.length} planned ·{" "}
                  {buckets.paused.length} paused
                </Trans>
              </div>
            </div>

            {allCards.length === 0 ? (
              <EmptyDashboard onNew={() => navigate("/beats/new")} />
            ) : (
              <div className="beats-grid">
                {allCards.map((b, i) => (
                  <BeatCard
                    key={b.id}
                    beat={b}
                    lead={i === 0 && b.status === "ACTIVE"}
                  />
                ))}
              </div>
            )}

            <div className="dash-add">
              <div>
                <div className="t">
                  <Trans>Want me to also <b>watch something else?</b></Trans>
                </div>
                <div className="chips">
                  {SUGGESTED_BRIEFS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="c"
                      onClick={() => pickStarter(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="pb-btn pb-btn-primary"
                onClick={() => navigate("/beats/new")}
              >
                <Trans>+ Begin designing</Trans>
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function BeatCard({ beat, lead }: { beat: BeatRow; lead: boolean }) {
  const { t } = useLingui();
  const kind = statusKind(beat);
  const cad = cadenceLabel(beat);
  const lvl = signalLevel(beat);
  const issues = beat.issueCount ?? 0;

  const depthText = (() => {
    if (beat.depth === "BRIEF") return t`Tight · 3–5 picks`;
    if (beat.depth === "STANDARD") return t`Standard · 8–12 picks`;
    if (beat.depth === "DEEP") return t`Deep · everything that matters`;
    return beat.depth;
  })();

  const nextText = (() => {
    if (beat.status === "PAUSED") return t`Paused`;
    if (beat.status === "DRAFT") return t`First issue: ${cad}`;
    if (
      beat.status === "DESIGNING" ||
      beat.status === "AWAITING_CLARIFICATION" ||
      beat.status === "SCOUTING"
    )
      return t`Designing now`;
    return cad;
  })();

  return (
    <Link to={`/beats/${beat.id}`} className={`beat-card${lead ? " lead" : ""}`}>
      <div className="meta">
        {kind === "live" ? (
          <span className="live">{cad}</span>
        ) : kind === "planned" ? (
          <span className="planned"><Trans>Planned · {cad}</Trans></span>
        ) : (
          <span className="paused">{cad}</span>
        )}
        <span>{depthText}</span>
        <span>{languageTag(beat.outputLanguage)}</span>
      </div>

      <h4>{beat.title}</h4>
      <p>{pitch(beat)}</p>

      {kind !== "planned" || issues > 0 ? (
        <div className="signal-bars" title={t`Relevance ${lvl}/5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              style={{
                height: 4 + i * 3,
                opacity: i <= lvl ? 0.85 : 0.18,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="beat-foot-row">
        <span>
          {issues > 0 ? t`${issues} issues · ` : ""}
          {nextText}
        </span>
        <span className="arrow"><Trans>Open →</Trans></span>
      </div>
    </Link>
  );
}

function EmptyDashboard({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ padding: "60px 0" }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        <Trans>Empty newsroom</Trans>
      </div>
      <h2 className="h-1" style={{ margin: 0, maxWidth: 620 }}>
        <Trans>You haven't filed a beat yet.</Trans>
      </h2>
      <p className="lede" style={{ marginTop: 14, maxWidth: 520 }}>
        <Trans>
          Tell me one thing you wish someone was watching for you. The editor
          will read between the lines and ask if anything's unclear.
        </Trans>
      </p>
      <div className="row" style={{ gap: 10, marginTop: 22 }}>
        <button type="button" className="pb-btn pb-btn-primary pb-btn-lg" onClick={onNew}>
          <Trans>+ Begin designing</Trans>
        </button>
      </div>
    </div>
  );
}
