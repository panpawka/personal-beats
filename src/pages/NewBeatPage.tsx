import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { createBeat, chatBeatBrief } from "wasp/client/operations";
import { Trans, useLingui } from "@lingui/react/macro";
import { AppShell } from "../layout/AppShell";
import { Masthead } from "../layout/Masthead";

interface BriefDraft {
  title: string | null;
  topic: string | null;
  cadenceType: "TIME_BASED" | "ON_DEMAND" | null;
  cronExpression: string | null;
  timezone: string | null;
  depth: "BRIEF" | "STANDARD" | "DEEP" | null;
  outputLanguage: string | null;
  rules: string[];
}

const EMPTY_DRAFT: BriefDraft = {
  title: null,
  topic: null,
  cadenceType: null,
  cronExpression: null,
  timezone: null,
  depth: null,
  outputLanguage: null,
  rules: [],
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type TFn = (strings: TemplateStringsArray, ...values: unknown[]) => string;

function depthLabel(depth: BriefDraft["depth"], t: TFn): string {
  if (depth === "BRIEF") return t`Tight · 3–5 picks`;
  if (depth === "DEEP") return t`Deep · everything that matters`;
  if (depth === "STANDARD") return t`Standard · 8–12 picks`;
  return "";
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function cadenceLabel(draft: BriefDraft, t: TFn): string {
  if (draft.cadenceType === "ON_DEMAND") return t`On demand`;
  if (draft.cadenceType !== "TIME_BASED" || !draft.cronExpression) return "";
  const parts = draft.cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return draft.cronExpression;
  const [min, hour, dom, mon, dow] = parts;
  const mm = /^\d+$/.test(min) ? String(min).padStart(2, "0") : min;
  const hh = /^\d+$/.test(hour) ? String(hour).padStart(2, "0") : hour;
  const time = `${hh}:${mm}`;
  if (dow !== "*" && dom === "*" && mon === "*") {
    if (/^\d$/.test(dow)) return t`Weekly · ${DAY_NAMES[Number(dow)]} ${time}`;
    if (dow === "1-5") return t`Weekdays · ${time}`;
    if (dow === "0,6" || dow === "6,0") return t`Weekends · ${time}`;
    return `${dow} · ${time}`;
  }
  if (dom === "*" && mon === "*" && dow === "*") return t`Daily · ${time}`;
  return draft.cronExpression;
}

function languageLabel(code: string | null): string {
  if (!code) return "";
  const c = code.toLowerCase();
  const NAMES: Record<string, string> = {
    en: "English",
    pl: "Polish",
    de: "German",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    nl: "Dutch",
    pt: "Portuguese",
    cs: "Czech",
    sk: "Slovak",
    uk: "Ukrainian",
  };
  return NAMES[c] ?? code.toUpperCase();
}

function deriveTitle(draft: BriefDraft, fallback: string, t: TFn): string {
  const candidate = draft.title?.trim() || draft.topic?.trim() || fallback.trim();
  if (!candidate) return t`Untitled beat`;
  const first = candidate.split(/[.!?\n]/)[0].trim();
  const trimmed = first.length > 80 ? `${first.slice(0, 77)}…` : first;
  return trimmed.replace(/^./, (c) => c.toUpperCase());
}

export function NewBeatPage() {
  const { t, i18n } = useLingui();
  const navigate = useNavigate();

  const STARTERS = [
    t`Wrocław weekends with the kids`,
    t`Iran–Israel daily briefing`,
    t`AI agent frameworks`,
    t`Polish cinema`,
    t`Climbing trips, weekend Europe`,
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<BriefDraft>(EMPTY_DRAFT);
  const [complete, setComplete] = useState(false);
  const [composer, setComposer] = useState("");
  const [pending, setPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seedHandledRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  async function exchange(nextMessages: ChatMessage[]) {
    setPending(true);
    setError(null);
    try {
      const res = await chatBeatBrief({
        messages: nextMessages,
        locale: i18n.locale || "en",
      });
      setMessages([
        ...nextMessages,
        { role: "assistant", content: res.reply },
      ]);
      setDraft(res.draft);
      setComplete(Boolean(res.complete));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (seedHandledRef.current) return;
    let initial = "";
    try {
      const s = localStorage.getItem("pb.newBeatSeed");
      if (s) {
        initial = s.trim();
        localStorage.removeItem("pb.newBeatSeed");
      }
    } catch {
      // ignore
    }
    if (!initial) return;
    seedHandledRef.current = true;
    const seedMessages: ChatMessage[] = [{ role: "user", content: initial }];
    setMessages(seedMessages);
    void exchange(seedMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, complete, pending]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(180, el.scrollHeight)}px`;
  }, [composer]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setComposer("");
    void exchange(next);
  }

  function pickStarter(seed: string) {
    if (pending || messages.length > 0) return;
    seedHandledRef.current = true;
    const seedMessages: ChatMessage[] = [{ role: "user", content: seed }];
    setMessages(seedMessages);
    void exchange(seedMessages);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(composer);
    }
  }

  async function fileBeat() {
    setError(null);
    const firstUser = messages.find((m) => m.role === "user")?.content ?? "";
    const brief = (draft.topic?.trim() || firstUser).trim();
    if (brief.length < 4) {
      setError(t`Tell me a bit more about the beat first.`);
      return;
    }
    if (!draft.cadenceType) {
      setError(t`We still need to settle the schedule.`);
      return;
    }
    if (draft.cadenceType === "TIME_BASED" && !draft.cronExpression) {
      setError(t`We still need to settle the schedule.`);
      return;
    }
    setSubmitting(true);
    try {
      const { beatId } = await createBeat({
        brief,
        title: draft.title?.trim() || undefined,
        cadenceType: draft.cadenceType,
        cronExpression:
          draft.cadenceType === "TIME_BASED"
            ? (draft.cronExpression ?? undefined)
            : undefined,
        timezone: draft.timezone?.trim() || undefined,
        depth: draft.depth ?? undefined,
        outputLanguage: draft.outputLanguage?.trim() || i18n.locale || "en",
      });
      navigate(`/beats/${beatId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  }

  const isEmpty = messages.length === 0;
  const briefTitle = deriveTitle(
    draft,
    messages.find((m) => m.role === "user")?.content ?? "",
    t,
  );
  const cadenceText = cadenceLabel(draft, t);
  const depthText = depthLabel(draft.depth, t);
  const languageText = languageLabel(draft.outputLanguage);

  const inlineRules: { key: string; label: string; value: string }[] = [];
  if (cadenceText) inlineRules.push({ key: "cadence", label: t`Cadence`, value: cadenceText });
  if (depthText) inlineRules.push({ key: "depth", label: t`Depth`, value: depthText });
  if (languageText) inlineRules.push({ key: "language", label: t`Language`, value: languageText });
  if (draft.timezone && draft.cadenceType === "TIME_BASED")
    inlineRules.push({ key: "tz", label: t`Timezone`, value: draft.timezone });
  draft.rules.slice(0, 4).forEach((r, i) =>
    inlineRules.push({ key: `r${i}`, label: t`Rule`, value: r }),
  );

  const showInlineRules = !complete && inlineRules.length > 0 && messages.length >= 2;

  return (
    <AppShell>
      <Masthead />
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
                onClick={() => pickStarter(s)}
                disabled={pending}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="turns">
          {messages.map((turn, i) => (
            <Fragment key={i}>
              <div className={`turn ${turn.role === "user" ? "me" : "ed"}`}>
                <div className="who" aria-hidden>
                  {turn.role === "user" ? "M" : "P"}
                </div>
                <div className="bub">{turn.content}</div>
              </div>
            </Fragment>
          ))}

          {pending ? (
            <div className="turn ed">
              <div className="who" aria-hidden>P</div>
              <div className="bub" style={{ opacity: 0.6 }}>
                <Trans>Thinking…</Trans>
              </div>
            </div>
          ) : null}

          {showInlineRules ? (
            <div className="rules-inline">
              <span className="label"><Trans>Pencil notes —</Trans></span>
              {inlineRules.map((r) => (
                <div key={r.key} className="rule-chip">
                  <span className="k">{r.label}:</span>
                  <span>{r.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div ref={endRef} />
        </div>

        {error && !complete ? (
          <div className="editorial-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        {!complete ? (
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
              disabled={pending}
            />
            <button
              type="button"
              className={`send ${composer.trim() ? "ready" : ""}`}
              onClick={() => send(composer)}
              disabled={!composer.trim() || pending}
            >
              <Trans>Send</Trans> <span aria-hidden>↵</span>
            </button>
          </div>
        ) : null}

        {complete ? (
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
                  <div className="v">{draft.topic ?? briefTitle}</div>
                </div>
                <div className="brief-row">
                  <div className="k"><Trans>Cadence</Trans></div>
                  <div className="v">{cadenceText || t`Daily · 07:00`}</div>
                </div>
                <div className="brief-row">
                  <div className="k"><Trans>Depth</Trans></div>
                  <div className="v">{depthText || t`Standard · 8–12 picks`}</div>
                </div>
                <div className="brief-row">
                  <div className="k"><Trans>Language</Trans></div>
                  <div className="v">{languageText || (i18n.locale || "en").toUpperCase()}</div>
                </div>
                {draft.timezone && draft.cadenceType === "TIME_BASED" ? (
                  <div className="brief-row">
                    <div className="k"><Trans>Timezone</Trans></div>
                    <div className="v">{draft.timezone}</div>
                  </div>
                ) : null}
                {draft.rules.length > 0 ? (
                  <div className="brief-row">
                    <div className="k"><Trans>Rules</Trans></div>
                    <div className="v">{draft.rules.join(" · ")}</div>
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
                <Trans>First issue arrives on schedule.</Trans>
              </span>
              <button
                type="button"
                className="pb-btn pb-btn-ghost"
                onClick={() => setComplete(false)}
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
