import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useLingui } from "@lingui/react/macro";
import { Rail } from "./Rail";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { data: user } = useAuth();
  const { t } = useLingui();

  useEffect(() => {
    document.body.classList.add("pb-editorial");
    return () => {
      document.body.classList.remove("pb-editorial");
    };
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="app" data-no-rail={user ? undefined : true}>
      {user ? (
        <Rail open={navOpen} onClose={() => setNavOpen(false)} />
      ) : null}
      {user && navOpen && (
        <div
          className="rail-backdrop"
          aria-hidden
          onClick={() => setNavOpen(false)}
        />
      )}
      <main className="main">{children}</main>
      {user ? (
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label={t`Open navigation`}
          onClick={() => setNavOpen(true)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 6h18M3 12h18M3 18h10" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
