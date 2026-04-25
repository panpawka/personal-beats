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
import { Sun, Moon } from "lucide-react";

function formatDate(date: Date, locale: string): string {
  const weekday = date.toLocaleDateString(locale, { weekday: "short" });
  const month = date.toLocaleDateString(locale, { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday} · ${month} ${day}, ${year}`;
}

interface MastheadProps {
  showDate?: boolean;
  volume?: string;
  hideLogin?: boolean;
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
  const next = current === "paper" ? "ink" : "paper";
  return (
    <button
      type="button"
      className="theme-tog"
      onClick={() => setTheme(next)}
      aria-label={t`Theme`}
      title={t`Theme`}
    >
      {current === "paper" ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  );
}

export function Masthead({
  showDate = true,
  volume,
  hideLogin = false,
}: MastheadProps) {
  const { data: user } = useAuth();
  const { i18n, t } = useLingui();
  const today = formatDate(new Date(), i18n.locale || "en");

  return (
    <div className="masthead">
      <div className="masthead-l">
        {showDate ? <span className="masthead-date">{today}</span> : null}
      </div>
      <div className="masthead-c">
        <Trans>
          Personal <b>Beats</b>
        </Trans>
      </div>
      <div className="masthead-r">
        <LanguageToggle />
        <ThemeToggle />
        {!user && !hideLogin ? (
          <Link to="/login" className="masthead-login" aria-label={t`Log in`}>
            <Icon name="external" size={14} />
            <span>
              <Trans>Log in</Trans>
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
