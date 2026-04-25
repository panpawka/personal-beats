import { msg } from "@lingui/core/macro";
import type { I18n } from "@lingui/core";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localizedDayName(dow: number, locale: string): string {
  const ref = new Date(Date.UTC(2024, 0, 7 + dow));
  return ref.toLocaleDateString(locale || "en", {
    weekday: "long",
    timeZone: "UTC",
  });
}

export function cadenceLabel(
  beat: {
    cadenceType: string;
    cronExpression: string | null;
    timezone?: string | null;
  },
  i18n: I18n,
): string {
  if (beat.cadenceType === "ON_DEMAND") return i18n._(msg`On demand`);
  const cron = beat.cronExpression?.trim();
  if (!cron) return i18n._(msg`Time-based`);
  const parts = cron.split(/\s+/);
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const everyMin = min.startsWith("*/");
  const tz = beat.timezone ? ` ${beat.timezone}` : "";
  if (everyMin) return i18n._(msg`Every ${min.slice(2)}m`);
  if (min === "*" && hour === "*") return i18n._(msg`Continuous`);
  const mm = /^\d+$/.test(min) ? pad2(Number(min)) : min;
  const hh = /^\d+$/.test(hour) ? pad2(Number(hour)) : hour;
  const time = `${hh}:${mm}`;
  if (dow !== "*" && dom === "*" && mon === "*") {
    if (/^\d$/.test(dow)) {
      const day = localizedDayName(Number(dow), i18n.locale);
      return i18n._(msg`Weekly · ${day} ${time}${tz}`);
    }
    if (dow === "1-5") return i18n._(msg`Weekdays ${time}${tz}`);
    if (dow === "0,6" || dow === "6,0") return i18n._(msg`Weekends ${time}${tz}`);
    return i18n._(msg`Weekly ${dow} ${time}${tz}`);
  }
  if (dom !== "*" && mon === "*" && dow === "*") {
    return i18n._(msg`Monthly · day ${dom} ${time}${tz}`);
  }
  if (dom === "*" && mon === "*" && dow === "*") return i18n._(msg`Daily ${time}${tz}`);
  return cron;
}
