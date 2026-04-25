import { Link, useLocation, useNavigate } from "react-router";
import { useAuth, logout } from "wasp/client/auth";
import { Trans, useLingui } from "@lingui/react/macro";
import { Icon } from "../components/editorial/Icon";

function avatarInitial(email: string | null | undefined): string {
  if (!email) return "?";
  const c = email.trim()[0];
  return c ? c.toUpperCase() : "?";
}

interface TabDef {
  id: string;
  label: string;
  glyph: string;
  to: string;
  match: (path: string) => boolean;
}

export function Rail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLingui();

  const tabs: TabDef[] = [
    { id: "home", label: t`Home`, glyph: "◇", to: "/", match: (p) => p === "/" },
    { id: "today", label: t`Today`, glyph: "◧", to: "/dashboard", match: (p) => p.startsWith("/dashboard") },
    { id: "new", label: t`New`, glyph: "✎", to: "/beats/new", match: (p) => p === "/beats/new" },
    {
      id: "beat",
      label: t`Beat`,
      glyph: "▤",
      to: "/dashboard",
      match: (p) => p.startsWith("/beats/") && p !== "/beats/new" && !p.includes("/issues/"),
    },
    { id: "issue", label: t`Issue`, glyph: "✉", to: "/dashboard", match: (p) => p.includes("/issues/") },
  ];

  const email =
    (user as unknown as { email?: string } | null)?.email ??
    (user as unknown as { identities?: { email?: { id?: string } } } | null)
      ?.identities?.email?.id ??
    null;

  const goHome = () => {
    navigate(user ? "/dashboard" : "/");
    onClose();
  };

  return (
    <aside className={`rail${open ? " open" : ""}`} aria-label={t`Workspace navigation`}>
      <button
        type="button"
        className="brand-mark"
        onClick={goHome}
        aria-label={t`Personal Beats home`}
        title={t`Personal Beats`}
      >
        P
      </button>

      {tabs.map((tab) => {
        const active = tab.match(location.pathname);
        const reachable = !!user || tab.id === "home";
        if (!reachable) return null;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            className="rail-tab"
            data-active={active}
            onClick={onClose}
            title={tab.label}
            aria-label={tab.label}
          >
            <span className="glyph" aria-hidden>
              {tab.glyph}
            </span>
            <span className="lbl">{tab.label}</span>
          </Link>
        );
      })}

      <span className="rail-spacer" />

      {user ? (
        <button
          type="button"
          className="rail-you"
          onClick={() => {
            void logout();
          }}
          title={t`${email ?? t`signed in`} · click to sign out`}
          aria-label={t`Sign out`}
        >
          {avatarInitial(email)}
        </button>
      ) : (
        <Link
          to="/login"
          className="rail-tab"
          onClick={onClose}
          title="Log in"
          aria-label="Log in"
        >
          <span className="glyph" aria-hidden>
            <Icon name="external" size={16} />
          </span>
          <span className="lbl">Login</span>
        </Link>
      )}
    </aside>
  );
}
