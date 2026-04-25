import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from "wasp/client/auth";
import { Trans, useLingui } from "@lingui/react/macro";
import { useTheme } from "../lib/theme";
import { Icon } from "../components/editorial/Icon";
import {
  dynamicActivate,
  getStoredLocale,
  isLocale,
  locales,
  persistLocale,
  type LocaleKey,
} from "../i18n";

function formatDate(date: Date, locale: string): string {
  const weekday = date.toLocaleDateString(locale, { weekday: "short" });
  const month = date.toLocaleDateString(locale, { month: "short" });
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

function LanguageToggle() {
  const { i18n, t } = useLingui();
  const current = (isLocale(i18n.locale) ? i18n.locale : getStoredLocale()) as LocaleKey;

  function set(locale: LocaleKey) {
    if (locale === current) return;
    persistLocale(locale);
    void dynamicActivate(locale);
  }

  return (
    <div className="theme-tog" role="group" aria-label={t`Language`}>
      {(Object.keys(locales) as LocaleKey[]).map((code) => (
        <button
          key={code}
          type="button"
          data-on={current === code}
          onClick={() => set(code)}
          aria-pressed={current === code}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLingui();
  const current = theme === "ink" ? "ink" : "paper";
  return (
    <div className="theme-tog" role="group" aria-label={t`Theme`}>
      <button
        type="button"
        data-on={current === "paper"}
        onClick={() => setTheme("paper")}
        aria-pressed={current === "paper"}
      >
        <span className="sq paper" aria-hidden />
        <Trans>Paper</Trans>
      </button>
      <button
        type="button"
        data-on={current === "ink"}
        onClick={() => setTheme("ink")}
        aria-pressed={current === "ink"}
      >
        <span className="sq ink" aria-hidden />
        <Trans>Ink</Trans>
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
  const { i18n, t } = useLingui();
  const email =
    (user as unknown as { email?: string } | null)?.email ??
    (user as unknown as { identities?: { email?: { id?: string } } } | null)
      ?.identities?.email?.id ??
    null;

  const today = formatDate(new Date(), i18n.locale || "en");
  const sectionLabel = section ?? title ?? t`Today's edition`;

  return (
    <>
      <div className="masthead">
        <div className="masthead-l">{volume}</div>
        <div className="masthead-c">
          <Trans>
            Personal <b>Beats</b>
          </Trans>
        </div>
        <div className="masthead-r">
          {showDate ? <span className="masthead-date">{today}</span> : null}
          <LanguageToggle />
          <ThemeToggle />
          {!user ? (
            <Link to="/login" className="masthead-login" aria-label={t`Log in`}>
              <Icon name="external" size={14} />
              <span>
                <Trans>Log in</Trans>
              </span>
            </Link>
          ) : null}
        </div>
      </div>
      {(sectionLabel || subMiddle || email || right) && (
        <div className="masthead-sub">
          <span>{sectionLabel}</span>
          {subMiddle ? <span>{subMiddle}</span> : <span />}
          <span className="masthead-sub-actions">
            {email ? <span>{email}</span> : null}
            {right ? right : null}
          </span>
        </div>
      )}
    </>
  );
}
