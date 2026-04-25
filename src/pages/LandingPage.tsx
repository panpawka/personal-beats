import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { Trans, useLingui } from "@lingui/react/macro";
import { AppShell } from "../layout/AppShell";
import { Masthead } from "../layout/Masthead";

export function LandingPage() {
  const { data: user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLingui();
  const [val, setVal] = useState("");

  const STARTERS = [
    t`Wrocław weekends with the kids`,
    t`Iran–Israel daily briefing`,
    t`AI agent frameworks`,
    t`Polish cinema`,
    t`Climbing trips, weekend Europe`,
    t`Wrocław restaurant openings`,
  ];

  useEffect(() => {
    document.body.classList.add("pb-editorial");
    return () => {
      document.body.classList.remove("pb-editorial");
    };
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          background: "var(--paper)",
          color: "var(--ink-3)",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <Trans>Loading</Trans>
      </div>
    );
  }

  function begin(seed: string) {
    const trimmed = seed.trim();
    if (trimmed) {
      try {
        localStorage.setItem("pb.newBeatSeed", trimmed);
      } catch {
        // ignore
      }
    }
    navigate("/signup");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    begin(val);
  }

  return (
    <AppShell>
      <Masthead />
      <section className="hero">
        <div className="kicker"><Trans>A personal newsroom, yours alone</Trans></div>
        <h1>
          <Trans>
            What should <em>we</em> be reading
            <br />
            for <em>you</em>?
          </Trans>
        </h1>
        <p className="sub">
          <Trans>
            One sentence is enough. We'll ask a couple of follow-ups, then deliver
            a paper shaped to your life — on your schedule, from sources you trust.
          </Trans>
        </p>

        <form className="hero-input" onSubmit={onSubmit}>
          <input
            autoFocus
            placeholder={t`Tell me one thing you wish someone was watching for you…`}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            aria-label={t`Beat brief`}
          />
          <button
            type="submit"
            className={`go ${val.trim() ? "signal" : ""}`}
            aria-label={t`Begin`}
          >
            <Trans>Begin <span aria-hidden>→</span></Trans>
          </button>
        </form>

        <div className="hero-chips">
          <span className="label"><Trans>or borrow a starter:</Trans></span>
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              className="hero-chip"
              onClick={() => begin(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {!user ? (<div className="hero-foot">
          <span><Trans>Est. MMXXVI · Vol. I</Trans></span>
          <span><Trans>Beats run quietly. You review, revise, pause any time.</Trans></span>
          <a onClick={() => navigate("/login")}><Trans>Already a reader → log in</Trans></a>
        </div>):null}
      </section>
    </AppShell>
  );
}
