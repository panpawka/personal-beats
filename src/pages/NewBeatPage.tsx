import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { createBeat } from "wasp/client/operations";
import { AppShell } from "../layout/AppShell";
import { Masthead } from "../layout/Masthead";

const DEFAULT_CRON = "0 7 * * *";
const DEFAULT_CADENCE: "TIME_BASED" | "ON_DEMAND" = "TIME_BASED";

const STARTERS = [
  "Wrocław weekends with the kids",
  "Iran–Israel daily briefing",
  "AI agent frameworks",
  "Polish cinema",
  "Climbing trips, weekend Europe",
];

const SUGG_CADENCE = [
  "Friday at 5pm, standard read",
  "Every morning, tight briefing",
  "Only when something big is on",
];

const SUGG_FLAGS = [
  "Always weather + dress code",
  "Skip nightlife and adult-only",
  "Cite 2+ primary sources",
];

interface Rules {
  cadence?: string;
  depth?: string;
  language?: string;
  weather?: string;
  sources?: string;
  skip?: string;
}

const RULE_LABELS: Record<keyof Rules, string> = {
  cadence: "Cadence",
  depth: "Depth",
  language: "Language",
  weather: "Always with",
  sources: "Sourcing",
  skip: "Skip",
};

interface Turn {
  who: "me" | "ed";
  text: string;
  sugg?: string[];
  ask?: string;
}

function parseRules(text: string): Rules {
  const t = text.toLowerCase();
  const r: Rules = {};
  if (/(every )?morning|daily|each day|every day/.test(t)) r.cadence = "Every morning · 7 am";
  else if (/friday|fri\b|weekend/.test(t)) r.cadence = "Every Friday · 5 pm";
  else if (/monday|weekly/.test(t)) r.cadence = "Every Monday · 8 am";
  else if (/only.*(when|if).*(big|important|breaking|happens)/.test(t))
    r.cadence = "Only when something breaks";
  const tm = t.match(/at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (tm && r.cadence) {
    const hr = tm[1];
    const mn = tm[2] ?? "00";
    const ap = tm[3] ?? (parseInt(hr, 10) < 8 ? "pm" : "am");
    r.cadence = r.cadence.replace(/·.*$/, `· ${hr}:${mn} ${ap}`);
  }
  if (/deep|thorough|long|full|in.?depth|planner/.test(t)) r.depth = "Deep · everything that matters";
  else if (/short|tight|brief|essential|quick/.test(t)) r.depth = "Tight · 3–5 picks";
  else if (/standard|regular|normal/.test(t)) r.depth = "Standard · 8–12 picks";
  if (/english.?friendly|in english|english/.test(t)) r.language = "English (Polish translated)";
  if (/weather|dress|rain|outdoor|kids|stroller/.test(t))
    r.weather = "Always lead with weather + dress code";
  if (/primary source|original source|source.?first|cite/.test(t))
    r.sources = "Primary sources first, opinion labelled";
  if (/skip nightlife|no nightlife|kid.?friendly|no adult/.test(t))
    r.skip = "Skip nightlife, adult-only";
  return r;
}

function deriveTitle(brief: string, rules: Rules): string {
  const t = brief.trim();
  if (!t) return "Untitled beat";
  // first sentence, capitalised
  const first = t.split(/[.!?\n]/)[0].trim();
  const trimmed = first.length > 80 ? first.slice(0, 77) + "…" : first;
  return trimmed.replace(/^./, (c) => c.toUpperCase());
}

export function NewBeatPage() {
  const navigate = useNavigate();
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
        text: "Got it. Two things I'd love your call on — when should I send, and how much do you want each time? Say it however feels natural.",
        sugg: SUGG_CADENCE,
        ask: "cadence_depth",
      };
    }
    if (!askedNow.includes("flags")) {
      const cad = rulesNow.cadence ?? "your schedule";
      const dep = (rulesNow.depth ?? "a standard read").toLowerCase();
      return {
        text: `${cad}, ${dep}. Last thing — should I always lead with weather and what to wear? And anything you'd like me to always skip?`,
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
    const r = parseRules(first);
    setRules(r);
    setTurns([{ who: "me", text: first }]);
    const t = window.setTimeout(() => {
      const a = agentReply(r, []);
      if (a) {
        setTurns((prev) => [...prev, { who: "ed", text: a.text, sugg: a.sugg, ask: a.ask }]);
        if (a.ask) setAsked((k) => [...k, a.ask!]);
      }
    }, 450);
    return () => window.clearTimeout(t);
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
    const merged: Rules = { ...rules, ...parseRules(trimmed) };
    setRules(merged);
    setTurns((t) => [...t, { who: "me", text: trimmed }]);
    setComposer("");
    window.setTimeout(() => {
      const a = agentReply(merged, asked);
      if (a) {
        setTurns((t) => [...t, { who: "ed", text: a.text, sugg: a.sugg, ask: a.ask }]);
        if (a.ask) setAsked((k) => [...k, a.ask!]);
      } else {
        setTurns((t) => [
          ...t,
          { who: "ed", text: "Done. Your beat is ready — I'll start reading and send the first issue on schedule." },
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
    const brief = (seed || turns.find((t) => t.who === "me")?.text || "").trim();
    if (brief.length < 4) {
      setError("Tell me a bit more about the beat first.");
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
  const briefTitle = deriveTitle(seed || turns.find((t) => t.who === "me")?.text || "", rules);

  // Empty state — show starter chips if no seed yet
  const isEmpty = turns.length === 0;

  return (
    <AppShell>
      <Masthead section="Designing a new beat" />
      <div className="design">
        <div className="design-head">
          <div className="lbl">The editor · conversation</div>
          <h1>
            Tell me <em>what</em> you'd like me to read for you.
          </h1>
          <p className="sub">
            Talk to me normally — I'll read between the lines and ask if I need
            to. As we go, I'll jot the rules I've understood as pencil notes; at
            the end, I'll read the whole brief back.
          </p>
        </div>

        {isEmpty ? (
          <div className="hero-chips" style={{ justifyContent: "flex-start", marginTop: 0, marginBottom: 28 }}>
            <span className="label">or borrow a starter:</span>
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
          {turns.map((t, i) => (
            <Fragment key={i}>
              <div className={`turn ${t.who}`}>
                <div className="who" aria-hidden>
                  {t.who === "me" ? "M" : "P"}
                </div>
                <div className="bub">{t.text}</div>
              </div>
              {t.who === "ed" && t.sugg && i === turns.length - 1 && !done ? (
                <div className="suggests">
                  <span className="label">or pick one —</span>
                  {t.sugg.map((s) => (
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
              <span className="label">Pencil notes —</span>
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
                  ? "Tell me however you'd say it out loud…"
                  : "Reply with whatever feels natural…"
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
              Send <span aria-hidden>↵</span>
            </button>
          </div>
        ) : null}

        {done ? (
          <div className="brief-card">
            <div className="brief-head">
              <span className="lbl">✦ Your brief, filed</span>
              <span className="vol">Draft · Vol. I</span>
            </div>
            <div className="brief-body">
              <h3>{briefTitle}</h3>
              <div className="brief-rows">
                <div className="brief-row">
                  <div className="k">Topic</div>
                  <div className="v">{seed || briefTitle}</div>
                </div>
                <div className="brief-row">
                  <div className="k">Cadence</div>
                  <div className="v">{rules.cadence ?? "Daily · 7 am"}</div>
                </div>
                <div className="brief-row">
                  <div className="k">Depth</div>
                  <div className="v">{rules.depth ?? "Standard · 8–12 picks"}</div>
                </div>
                {rules.language ? (
                  <div className="brief-row">
                    <div className="k">Language</div>
                    <div className="v">{rules.language}</div>
                  </div>
                ) : null}
                {rules.weather ? (
                  <div className="brief-row">
                    <div className="k">Always with</div>
                    <div className="v">{rules.weather}</div>
                  </div>
                ) : null}
                {rules.skip ? (
                  <div className="brief-row">
                    <div className="k">Skip</div>
                    <div className="v">{rules.skip}</div>
                  </div>
                ) : null}
                {rules.sources ? (
                  <div className="brief-row">
                    <div className="k">Sourcing</div>
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
                First issue arrives {(rules.cadence ?? "soon").replace(/^Every /, "")}
              </span>
              <button
                type="button"
                className="pb-btn pb-btn-ghost"
                onClick={() => {
                  setDone(false);
                }}
                disabled={submitting}
              >
                Keep refining
              </button>
              <button
                type="button"
                className="pb-btn pb-btn-signal"
                onClick={() => void fileBeat()}
                disabled={submitting}
              >
                {submitting ? "Filing…" : "File this beat →"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
