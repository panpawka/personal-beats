import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useTheme } from "../lib/theme";
import { Icon } from "../components/editorial/Icon";

function formatDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday} · ${month} ${day}, ${year}`;
}

interface MastheadProps {
  /** Section text shown in the sub-strip (left). */
  section?: string;
  /** Optional middle text in the sub-strip (e.g. weather, location). */
  subMiddle?: string;
  /** Right-side action buttons rendered alongside theme toggle. */
  right?: ReactNode;
  /** Backwards-compat alias for `section`. */
  title?: string;
  /** Toggle the date+toggle row. Defaults to true. */
  showDate?: boolean;
  /** Volume label (left of centered title). Defaults to "Vol. I". */
  volume?: string;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = theme === "ink" ? "ink" : "paper";
  return (
    <div className="theme-tog" role="group" aria-label="Theme">
      <button
        type="button"
        data-on={current === "paper"}
        onClick={() => setTheme("paper")}
        aria-pressed={current === "paper"}
      >
        <span className="sq paper" aria-hidden />
        Paper
      </button>
      <button
        type="button"
        data-on={current === "ink"}
        onClick={() => setTheme("ink")}
        aria-pressed={current === "ink"}
      >
        <span className="sq ink" aria-hidden />
        Ink
      </button>
    </div>
  );
}

export function Masthead({
  section,
  subMiddle,
  right,
  title,
  showDate = true,
  volume = "Vol. I",
}: MastheadProps) {
  const { data: user } = useAuth();
  const email =
    (user as unknown as { email?: string } | null)?.email ??
    (user as unknown as { identities?: { email?: { id?: string } } } | null)
      ?.identities?.email?.id ??
    null;

  const today = formatDate(new Date());
  const sectionLabel = section ?? title ?? "Today's edition";

  return (
    <>
      <div className="masthead">
        <div className="masthead-l">{volume}</div>
        <div className="masthead-c">
          Personal <b>Beats</b>
        </div>
        <div className="masthead-r">
          {showDate ? <span className="masthead-date">{today}</span> : null}
          <ThemeToggle />
          {!user ? (
            <Link to="/login" className="masthead-login" aria-label="Log in">
              <Icon name="external" size={14} />
              <span>Log in</span>
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
