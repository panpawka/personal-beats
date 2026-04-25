import { Link, useLocation, useNavigate } from "react-router";
import { useAuth, logout } from "wasp/client/auth";
import { Trans, useLingui } from "@lingui/react/macro";
import { Icon } from "../components/editorial/Icon";


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
  ];

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
        <span>P<b>B</b></span>
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
          className="rail-tab"
          onClick={() => {
            void logout();
          }}
          title={t`Sign out`}
          aria-label={t`Sign out`}
        >
          <span className="glyph" aria-hidden>
            <Icon name="external" size={16} />
          </span>
          <span className="lbl">
            <Trans>Logout</Trans>
          </span>
        </button>
      ) : (
        <Link
          to="/login"
          className="rail-tab"
          onClick={onClose}
          title={t`Log in`}
          aria-label={t`Log in`}
        >
          <span className="glyph" aria-hidden>
            <Icon name="external" size={16} />
          </span>
          <span className="lbl">
            <Trans>Login</Trans>
          </span>
        </Link>
      )}
    </aside>
  );
}
