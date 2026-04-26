import { useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Icon } from "../../components/editorial/Icon";
import { cadenceLabel } from "../../shared/cadence";
import type { CadenceType } from "../../shared/types";

type Frequency = "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY";

const FREQUENCIES: Frequency[] = ["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Decode a cron we previously generated back into form fields. Falls back to
// safe defaults when the cron came from somewhere else (e.g. AI-driven brief).
function decodeCron(cron: string | null): {
  frequency: Frequency;
  weekday: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
} {
  const fallback = {
    frequency: "DAILY" as Frequency,
    weekday: 1,
    dayOfMonth: 1,
    hour: 8,
    minute: 0,
  };
  if (!cron) return fallback;
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return fallback;
  const [min, hr, dom, mon, dow] = parts;
  const minN = /^\d+$/.test(min) ? Number(min) : NaN;
  const hrN = /^\d+$/.test(hr) ? Number(hr) : NaN;
  if (Number.isNaN(minN) || Number.isNaN(hrN) || mon !== "*") return fallback;

  if (dom === "*" && dow === "*") {
    return { ...fallback, frequency: "DAILY", hour: hrN, minute: minN };
  }
  if (dom === "*" && dow === "1-5") {
    return { ...fallback, frequency: "WEEKDAYS", hour: hrN, minute: minN };
  }
  if (dom === "*" && /^[0-6]$/.test(dow)) {
    return {
      ...fallback,
      frequency: "WEEKLY",
      weekday: Number(dow),
      hour: hrN,
      minute: minN,
    };
  }
  if (dow === "*" && /^([1-9]|1\d|2[0-8])$/.test(dom)) {
    return {
      ...fallback,
      frequency: "MONTHLY",
      dayOfMonth: Number(dom),
      hour: hrN,
      minute: minN,
    };
  }
  return fallback;
}

function buildCron(input: {
  frequency: Frequency;
  weekday: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
}): string {
  const { frequency, weekday, dayOfMonth, hour, minute } = input;
  switch (frequency) {
    case "DAILY":
      return `${minute} ${hour} * * *`;
    case "WEEKDAYS":
      return `${minute} ${hour} * * 1-5`;
    case "WEEKLY":
      return `${minute} ${hour} * * ${weekday}`;
    case "MONTHLY":
      return `${minute} ${hour} ${dayOfMonth} * *`;
  }
}

interface ScheduleEditorProps {
  beat: {
    cadenceType: string;
    cronExpression: string | null;
    timezone?: string | null;
  };
  onSave: (input: {
    cadenceType: CadenceType;
    cronExpression?: string | null;
    timezone?: string | null;
  }) => Promise<boolean>;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}

export function ScheduleEditor({
  beat,
  onSave,
  onCancel,
  pending,
  error,
}: ScheduleEditorProps) {
  const { t, i18n } = useLingui();

  const initialCadence: CadenceType =
    beat.cadenceType === "ON_DEMAND" ? "ON_DEMAND" : "TIME_BASED";
  const decoded = useMemo(() => decodeCron(beat.cronExpression), [beat.cronExpression]);

  const [cadenceType, setCadenceType] = useState<CadenceType>(initialCadence);
  const [frequency, setFrequency] = useState<Frequency>(decoded.frequency);
  const [weekday, setWeekday] = useState<number>(decoded.weekday);
  const [dayOfMonth, setDayOfMonth] = useState<number>(decoded.dayOfMonth);
  const [hour, setHour] = useState<number>(decoded.hour);
  // Snap to nearest 15-min slot so the dropdown can always render the value.
  const [minute, setMinute] = useState<number>(
    [0, 15, 30, 45].reduce((closest, m) =>
      Math.abs(m - decoded.minute) < Math.abs(closest - decoded.minute) ? m : closest,
      0,
    ),
  );

  // Auto-detected from browser; never user-editable. Falls back to existing
  // beat tz, then to "UTC" if Intl is unavailable (SSR / very old engines).
  const detectedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || beat.timezone || "UTC";
    } catch {
      return beat.timezone ?? "UTC";
    }
  }, [beat.timezone]);

  const FREQ_LABEL: Record<Frequency, string> = {
    DAILY: t`Every day`,
    WEEKDAYS: t`Weekdays (Mon–Fri)`,
    WEEKLY: t`Weekly`,
    MONTHLY: t`Monthly`,
  };

  // Localized weekday names; ISO Monday=1 ... Sunday=0 (cron) — we display
  // Mon–Sun and map to cron values.
  // ISO Monday=1 ... Sunday=0 (cron). Anchor 2024-01-01 was a Monday.
  const WEEKDAY_OPTIONS = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 0].map((cronDow) => {
        const offset = cronDow === 0 ? 6 : cronDow - 1;
        const d = new Date(Date.UTC(2024, 0, 1 + offset));
        const name = d.toLocaleDateString(i18n.locale || "en", {
          weekday: "long",
          timeZone: "UTC",
        });
        return { value: cronDow, label: name };
      }),
    [i18n.locale],
  );

  const effectiveCron = buildCron({
    frequency,
    weekday,
    dayOfMonth,
    hour,
    minute,
  });

  const previewBeat = {
    cadenceType,
    cronExpression: cadenceType === "TIME_BASED" ? effectiveCron : null,
    timezone: detectedTimezone,
  };
  const previewLabel = cadenceLabel(previewBeat, i18n);

  async function submit() {
    if (pending) return;
    if (cadenceType === "ON_DEMAND") {
      const ok = await onSave({
        cadenceType: "ON_DEMAND",
        cronExpression: null,
        timezone: null,
      });
      if (ok) onCancel();
      return;
    }
    const ok = await onSave({
      cadenceType: "TIME_BASED",
      cronExpression: effectiveCron,
      timezone: detectedTimezone,
    });
    if (ok) onCancel();
  }

  const labelStyle = {
    fontFamily: "var(--mono)",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--ink-3)",
    display: "block",
    marginBottom: 6,
  };
  const inputStyle = {
    width: "100%",
    fontFamily: "var(--mono)",
    fontSize: 13,
    padding: "8px 10px",
    background: "var(--paper)",
    border: "var(--hairline) solid var(--rule)",
    borderRadius: 4,
    color: "var(--ink-1)",
  };

  return (
    <div
      className="pb-enter"
      style={{
        marginTop: 18,
        padding: "16px 18px",
        background: "var(--paper-2)",
        border: "var(--hairline) solid var(--rule)",
        borderRadius: 6,
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          marginBottom: 14,
        }}
      >
        <Trans>Edit schedule</Trans>
      </div>

      <div style={{ marginBottom: 14 }}>
        <span style={labelStyle}>
          <Trans>Cadence</Trans>
        </span>
        <label style={{ marginRight: 16, fontSize: 13 }}>
          <input
            type="radio"
            name="cadenceType"
            value="TIME_BASED"
            checked={cadenceType === "TIME_BASED"}
            onChange={() => setCadenceType("TIME_BASED")}
            style={{ marginRight: 6 }}
          />
          <Trans>Time-based</Trans>
        </label>
        <label style={{ fontSize: 13 }}>
          <input
            type="radio"
            name="cadenceType"
            value="ON_DEMAND"
            checked={cadenceType === "ON_DEMAND"}
            onChange={() => setCadenceType("ON_DEMAND")}
            style={{ marginRight: 6 }}
          />
          <Trans>On demand only</Trans>
        </label>
      </div>

      {cadenceType === "TIME_BASED" ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle} htmlFor="schedule-frequency">
              <Trans>Frequency</Trans>
            </label>
            <select
              id="schedule-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              style={inputStyle}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABEL[f]}
                </option>
              ))}
            </select>
          </div>

          {frequency === "WEEKLY" ? (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="schedule-weekday">
                <Trans>Day of week</Trans>
              </label>
              <select
                id="schedule-weekday"
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                style={inputStyle}
              >
                {WEEKDAY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {frequency === "MONTHLY" ? (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="schedule-dom">
                <Trans>Day of month (1–28)</Trans>
              </label>
              <select
                id="schedule-dom"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                style={inputStyle}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div style={{ marginBottom: 12 }}>
            <span style={labelStyle}>
              <Trans>Time of day (24h)</Trans>
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                aria-label={t`Hour`}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                style={{ ...inputStyle, width: 90 }}
              >
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>
                    {pad2(h)}
                  </option>
                ))}
              </select>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  color: "var(--ink-3)",
                  fontSize: 14,
                }}
              >
                :
              </span>
              <select
                aria-label={t`Minute`}
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                style={{ ...inputStyle, width: 90 }}
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {pad2(m)}
                  </option>
                ))}
              </select>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  marginLeft: 4,
                }}
              >
                {detectedTimezone}
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "var(--ink-2)",
              marginBottom: 4,
            }}
          >
            <Trans>Preview: {previewLabel}</Trans>
          </div>
        </>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-2)",
            marginBottom: 4,
          }}
        >
          <Trans>This beat will only fire when you press “Send me one now”.</Trans>
        </div>
      )}

      {error ? (
        <div className="editorial-error" style={{ marginTop: 14 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="pb-btn pb-btn-signal"
          onClick={submit}
          disabled={pending}
        >
          <Icon name="check" size={13} />
          <span>
            {pending ? <Trans>Saving…</Trans> : <Trans>Save schedule</Trans>}
          </span>
        </button>
        <button
          type="button"
          className="pb-btn pb-btn-ghost"
          onClick={onCancel}
          disabled={pending}
        >
          <Icon name="x" size={13} />
          <span><Trans>Cancel</Trans></span>
        </button>
      </div>
    </div>
  );
}
