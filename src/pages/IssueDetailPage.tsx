import { Link, useNavigate, useParams } from "react-router";
import { useQuery, getIssue, getBeat } from "wasp/client/operations";
import { useAuth } from "wasp/client/auth";
import { AppShell } from "../layout/AppShell";
import { Masthead } from "../layout/Masthead";
import { EditorialButton } from "../components/editorial/Button";
import { Icon } from "../components/editorial/Icon";

function safeParseArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatEmailMetaDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function userEmailFrom(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const u = user as Record<string, unknown>;
  const direct = typeof u.email === "string" ? u.email : null;
  if (direct) return direct;
  const ids = (u.identities as { email?: { id?: string } } | undefined) ?? undefined;
  return ids?.email?.id ?? null;
}

export function IssueDetailPage() {
  const { beatId, issueId } = useParams<{ beatId: string; issueId: string }>();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const { data: issue, isLoading, error } = useQuery(getIssue, {
    issueId: issueId!,
  });
  const { data: beat } = useQuery(
    getBeat,
    { beatId: beatId! },
    { enabled: !!beatId },
  );

  if (isLoading) {
    return (
      <AppShell>
        <Masthead showDate={false} />
        <div
          className="content pb-loading"
          style={{
            fontFamily: "var(--mono)",
            color: "var(--ink-3)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Loading issue
        </div>
      </AppShell>
    );
  }

  if (error || !issue) {
    return (
      <AppShell>
        <Masthead showDate={false} title="Issue not found" />
        <div className="content">
          <div className="editorial-error">
            This issue doesn't exist or you don't have access.
          </div>
          <Link
            to={beatId ? `/beats/${beatId}` : "/dashboard"}
            className="pb-btn pb-btn-ghost"
            style={{ marginTop: 18, display: "inline-flex" }}
          >
            <Icon name="arrow-left" size={13} />
            <span>Back</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const toEmail = userEmailFrom(user) ?? "you";
  const fromEmail = "hello@lemonode.pl";
  const issueDate = issue.issueDate ?? issue.publishedAt;
  const folioDate = formatEmailMetaDate(issueDate);
  const sentDate = issue.emailSentAt ? formatEmailMetaDate(issue.emailSentAt) : folioDate;
  const emailFailed = issue.emailStatus === "FAILED";

  return (
    <AppShell>
      <Masthead
        showDate={false}
        right={
          <>
            <EditorialButton
              variant="ghost"
              onClick={() => navigate(beatId ? `/beats/${beatId}` : "/dashboard")}
            >
              <Icon name="arrow-left" size={13} />
              <span>Back to beat</span>
            </EditorialButton>
            <EditorialButton
              variant="ghost"
              onClick={() => {
                if (typeof window === "undefined") return;
                window.print();
              }}
            >
              <Icon name="external" size={13} />
              <span>Print</span>
            </EditorialButton>
          </>
        }
      />

      <div className="email-frame">
        {emailFailed ? (
          <div
            className="editorial-error"
            style={{ maxWidth: 640, margin: "0 auto 18px" }}
          >
            Delivery pending — email bounced. You can still read the issue below.
          </div>
        ) : null}
        <article className="email-window">
          <div className="email-meta">
            <span className="from">{fromEmail}</span>
            <span className="sep-dot">→</span>
            <span>{toEmail}</span>
            <span style={{ marginLeft: "auto" }}>{sentDate}</span>
          </div>

          <header className="email-masthead">
            <div className="est">
              {beat?.title ? beat.title : "Personal Newsroom"} · Vol. I
            </div>
            <h1>{issue.subject}</h1>
            {issue.dek ? <p className="deck">{issue.dek}</p> : null}
            <div className="email-folio">
              <span>{folioDate}</span>
              <span>
                {issue.items.length}{" "}
                {issue.items.length === 1 ? "story" : "stories"}
              </span>
            </div>
          </header>

          <div className="email-body">
            {issue.coverageNote ? (
              <div className="email-tldr">
                <span className="label">Editor's note</span>
                {issue.coverageNote}
              </div>
            ) : null}

            {issue.items.length === 0 ? (
              <p className="pb-body" style={{ color: "var(--ink-3)" }}>
                This issue had no publishable items.
              </p>
            ) : (
              issue.items.map((item, i) => {
                const secondary = safeParseArray(item.secondarySourceUrls);
                const allSources = [item.primarySourceUrl, ...secondary].filter(Boolean);
                const tags = safeParseArray(item.tags);
                return (
                  <article className="story" key={item.id}>
                    <div className="story-eyebrow">
                      <span className="cat">№{String(i + 1).padStart(2, "0")}</span>
                      {tags.slice(0, 2).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <h2>{item.headline}</h2>
                    {item.whyItMatters ? (
                      <p className="story-deck">{item.whyItMatters}</p>
                    ) : null}
                    <div className="story-body">
                      <p>{item.summary}</p>
                    </div>
                    <div className="story-meta">
                      <div className="sources">
                        {allSources.slice(0, 4).map((url, si) => (
                          <a
                            key={`${url}-${si}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="source"
                          >
                            {extractDomain(url)}
                          </a>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <footer className="email-foot">
            <div>
              You are reading issue №{String(issue.items.length ? 1 : 0).padStart(3, "0")} of{" "}
              {beat?.title ?? "your beat"}.
            </div>
            <div style={{ marginTop: 6 }}>
              <Link to={beatId ? `/beats/${beatId}` : "/dashboard"}>
                Adjust this beat
              </Link>
            </div>
          </footer>
        </article>
      </div>
    </AppShell>
  );
}
