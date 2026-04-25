import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { createBeat } from "wasp/client/operations";
import { Trans, useLingui } from "@lingui/react/macro";
import { AppShell } from "../layout/AppShell";
import { Masthead } from "../layout/Masthead";

const DEFAULT_CRON = "0 7 * * *";
const DEFAULT_CADENCE: "TIME_BASED" | "ON_DEMAND" = "TIME_BASED";

interface Rules {
  cadence?: string;
  depth?: string;
  language?: string;
  weather?: string;
  sources?: string;
  skip?: string;
}

interface Turn {
  who: "me" | "ed";
  text: string;
  sugg?: string[];
  ask?: string;
}

type TFn = (strings: TemplateStringsArray, ...values: unknown[]) => string;

function parseRules(text: string, t: TFn): Rules {
  const lower = text.toLowerCase();
  const r: Rules = {};
  if (/(every )?morning|daily|each day|every day/.test(lower)) r.cadence = t`Every morning · 7 am`;
  else if (/friday|fri\b|weekend/.test(lower)) r.cadence = t`Every Friday · 5 pm`;
  else if (/monday|weekly/.test(lower)) r.cadence = t`Every Monday · 8 am`;
  else if (/only.*(when|if).*(big|important|breaking|happens)/.test(lower))
    r.cadence = t`Only when something breaks`;
  const tm = lower.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (tm && r.cadence) {
    const hr = tm[1];
    const mn = tm[2] ?? "00";
    const ap = tm[3] ?? (parseInt(hr, 10) < 8 ? "pm" : "am");
    r.cadence = r.cadence.replace(/·.*$/, `· ${hr}:${mn} ${ap}`);
  }
  if (/deep|thorough|long|full|in.?depth|planner/.test(lower)) r.depth = t`Deep · everything that matters`;
  else if (/short|tight|brief|essential|quick/.test(lower)) r.depth = t`Tight · 3–5 picks`;
  else if (/standard|regular|normal/.test(lower)) r.depth = t`Standard · 8–12 picks`;
  if (/english.?friendly|in english|english/.test(lower)) r.language = t`English (Polish translated)`;
  if (/weather|dress|rain|outdoor|kids|stroller/.test(lower))
    r.weather = t`Always lead with weather + dress code`;
  if (/primary source|original source|source.?first|cite/.test(lower))
    r.sources = t`Primary sources first, opinion labelled`;
  if (/skip nightlife|no nightlife|kid.?friendly|no adult/.test(lower))
    r.skip = t`Skip nightlife, adult-only`;
  return r;
}

function deriveTitle(brief: string, _rules: Rules, t: TFn): string {
  const trimmedBrief = brief.trim();
  if (!trimmedBrief) return t`Untitled beat`;
  // first sentence, capitalised
  const first = trimmedBrief.split(/[.!?\n]/)[0].trim();
  const trimmed = first.length > 80 ? first.slice(0, 77) + "…" : first;
  return trimmed.replace(/^./, (c) => c.toUpperCase());
}

export function NewBeatPage() {
  const { t } = useLingui();
  const navigate = useNavigate();

  const STARTERS = [
    t`Wrocław weekends with the kids`,
    t`Iran–Israel daily briefing`,
    t`AI agent frameworks`,
    t`Polish cinema`,
    t`Climbing trips, weekend Europe`,
  ];

  const SUGG_CADENCE = [
    t`Friday at 5pm, standard read`,
    t`Every morning, tight briefing`,
    t`Only when something big is on`,
  ];

  const SUGG_FLAGS = [
    t`Always weather + dress code`,
    t`Skip nightlife and adult-only`,
    t`Cite 2+ primary sources`,
  ];

  const RULE_LABELS: Record<keyof Rules, string> = {
    cadence: t`Cadence`,
    depth: t`Depth`,
    language: t`Language`,
    weather: t`Always with`,
    sources: t`Sourcing`,
    skip: t`Skip`,
  };

  const [seed, setSeed] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [rules, setRules] = useState<Rules>({});
  const [asked, setAsked] = useState<string[]>([]);
  const [composer, setComposer] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Pull seed from sessionStorage (set by LandingPage / DashboardPage chips)
  useEffect(() => {
    let initial = "";
    try {
      const s = sessionStorage.getItem("pb.newBeatSeed");
      if (s) {
        initial = s;
        sessionStorage.removeItem("pb.newBeatSeed");
      }
    } catch {
      // ignore
    }
    setSeed(initial);
  }, []);

  function agentReply(rulesNow: Rules, askedNow: string[]): Omit<Turn, "who"> | null {
    if (!askedNow.includes("cadence_depth")) {
      return {
        text: t`Got it. Two things I'd love your call on — when should I send, and how much do you want each time? Say it however feels natural.`,
        sugg: SUGG_CADENCE,
        ask: "cadence_depth",
      };
    }
    if (!askedNow.includes("flags")) {
      const cad = rulesNow.cadence ?? t`your schedule`;
      const dep = (rulesNow.depth ?? t`a standard read`).toLowerCase();
      return {
        text: t`${cad}, ${dep}. Last thing — should I always lead with weather and what to wear? And anything you'd like me to always skip?`,
        sugg: SUGG_FLAGS,
        ask: "flags",
      };
    }
    return null;
  }

  // Seed first exchange when seed value resolves
  useEffect(() => {
    if (turns.length > 0) return;
    const first = seed.trim();
    if (!first) return;
    const r = parseRules(first, t);
    setRules(r);
    setTurns([{ who: "me", text: first }]);
    const timeoutId = window.setTimeout(() => {
      const a = agentReply(r, []);
      if (a) {
        setTurns((prev) => [...prev, { who: "ed", text: a.text, sugg: a.sugg, ask: a.ask }]);
        if (a.ask) setAsked((k) => [...k, a.ask!]);
      }
    }, 450);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, done]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(180, el.scrollHeight)}px`;
  }, [composer]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (turns.length === 0) {
      // First turn — establish the seed
      setSeed(trimmed);
      return;
    }
    const merged: Rules = { ...rules, ...parseRules(trimmed, t) };
    setRules(merged);
    setTurns((prev) => [...prev, { who: "me", text: trimmed }]);
    setComposer("");
    window.setTimeout(() => {
      const a = agentReply(merged, asked);
      if (a) {
        setTurns((prev) => [...prev, { who: "ed", text: a.text, sugg: a.sugg, ask: a.ask }]);
        if (a.ask) setAsked((k) => [...k, a.ask!]);
      } else {
        setTurns((prev) => [
          ...prev,
          { who: "ed", text: t`Done. Your beat is ready — I'll start reading and send the first issue on schedule.` },
        ]);
        setDone(true);
      }
    }, 500);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(composer);
    }
  }

  async function fileBeat() {
    setError(null);
    const brief = (seed || turns.find((tn) => tn.who === "me")?.text || "").trim();
    if (brief.length < 4) {
      setError(t`Tell me a bit more about the beat first.`);
      return;
    }
    setSubmitting(true);
    try {
      const { beatId } = await createBeat({
        brief,
        cadenceType: DEFAULT_CADENCE,
        cronExpression: DEFAULT_CRON,
      });
      navigate(`/beats/${beatId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  }

  const filled = (Object.entries(rules) as [keyof Rules, string | undefined][]).filter(
    ([, v]) => Boolean(v),
  );
  const showInlineRules = turns.length >= 2 && !done && filled.length > 0;
  const briefTitle = deriveTitle(seed || turns.find((tn) => tn.who === "me")?.text || "", rules, t);

  // Empty state — show starter chips if no seed yet
  const isEmpty = turns.length === 0;

  return (
    <AppShell>
      <Masthead section={t`Designing a new beat`} />
      <div className="design">
        <div className="design-head">
          <div className="lbl"><Trans>The editor · conversation</Trans></div>
          <h1>
            <Trans>Tell me <em>what</em> you'd like me to read for you.</Trans>
          </h1>
          <p className="sub">
            <Trans>
              Talk to me normally — I'll read between the lines and ask if I need
              to. As we go, I'll jot the rules I've understood as pencil notes; at
              the end, I'll read the whole brief back.
            </Trans>
          </p>
        </div>

        {isEmpty ? (
          <div className="hero-chips" style={{ justifyContent: "flex-start", marginTop: 0, marginBottom: 28 }}>
            <span className="label"><Trans>or borrow a starter:</Trans></span>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className="hero-chip"
                onClick={() => setSeed(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="turns">
          {turns.map((turn, i) => (
            <Fragment key={i}>
              <div className={`turn ${turn.who}`}>
                <div className="who" aria-hidden>
                  {turn.who === "me" ? "M" : "P"}
                </div>
                <div className="bub">{turn.text}</div>
              </div>
              {turn.who === "ed" && turn.sugg && i === turns.length - 1 && !done ? (
                <div className="suggests">
                  <span className="label"><Trans>or pick one —</Trans></span>
                  {turn.sugg.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="qa"
                      onClick={() => send(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </Fragment>
          ))}

          {showInlineRules ? (
            <div className="rules-inline">
              <span className="label"><Trans>Pencil notes —</Trans></span>
              {filled.map(([k, v]) => (
                <div key={k} className="rule-chip">
                  <span className="k">{RULE_LABELS[k]}:</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div ref={endRef} />
        </div>

        {!done ? (
          <div className="composer-box-merged">
            <textarea
              ref={taRef}
              rows={1}
              placeholder={
                isEmpty
                  ? t`Tell me however you'd say it out loud…`
                  : t`Reply with whatever feels natural…`
              }
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={onKey}
            />
            <button
              type="button"
              className={`send ${composer.trim() ? "ready" : ""}`}
              onClick={() => send(composer)}
              disabled={!composer.trim()}
            >
              <Trans>Send</Trans> <span aria-hidden>↵</span>
            </button>
          </div>
        ) : null}

        {done ? (
          <div className="brief-card">
            <div className="brief-head">
              <span className="lbl"><Trans>✦ Your brief, filed</Trans></span>
              <span className="vol"><Trans>Draft · Vol. I</Trans></span>
            </div>
            <div className="brief-body">
              <h3>{briefTitle}</h3>
              <div className="brief-rows">
                <div className="brief-row">
                  <div className="k"><Trans>Topic</Trans></div>
                  <div className="v">{seed || briefTitle}</div>
                </div>
                <div className="brief-row">
                  <div className="k"><Trans>Cadence</Trans></div>
                  <div className="v">{rules.cadence ?? t`Daily · 7 am`}</div>
                </div>
                <div className="brief-row">
                  <div className="k"><Trans>Depth</Trans></div>
                  <div className="v">{rules.depth ?? t`Standard · 8–12 picks`}</div>
                </div>
                {rules.language ? (
                  <div className="brief-row">
                    <div className="k"><Trans>Language</Trans></div>
                    <div className="v">{rules.language}</div>
                  </div>
                ) : null}
                {rules.weather ? (
                  <div className="brief-row">
                    <div className="k"><Trans>Always with</Trans></div>
                    <div className="v">{rules.weather}</div>
                  </div>
                ) : null}
                {rules.skip ? (
                  <div className="brief-row">
                    <div className="k"><Trans>Skip</Trans></div>
                    <div className="v">{rules.skip}</div>
                  </div>
                ) : null}
                {rules.sources ? (
                  <div className="brief-row">
                    <div className="k"><Trans>Sourcing</Trans></div>
                    <div className="v">{rules.sources}</div>
                  </div>
                ) : null}
              </div>
              {error ? (
                <div className="editorial-error" style={{ marginTop: 18 }}>
                  {error}
                </div>
              ) : null}
            </div>
            <div className="brief-foot">
              <span className="spacer-msg">
                <Trans>
                  First issue arrives {(rules.cadence ?? t`soon`).replace(/^Every /, "")}
                </Trans>
              </span>
              <button
                type="button"
                className="pb-btn pb-btn-ghost"
                onClick={() => {
                  setDone(false);
                }}
                disabled={submitting}
              >
                <Trans>Keep refining</Trans>
              </button>
              <button
                type="button"
                className="pb-btn pb-btn-signal"
                onClick={() => void fileBeat()}
                disabled={submitting}
              >
                {submitting ? t`Filing…` : t`File this beat →`}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
