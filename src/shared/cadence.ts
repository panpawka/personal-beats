const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function cadenceLabel(beat: {
  cadenceType: string;
  cronExpression: string | null;
  timezone?: string | null;
}): string {
  if (beat.cadenceType === "ON_DEMAND") return "On demand";
  const cron = beat.cronExpression?.trim();
  if (!cron) return "Time-based";
  const parts = cron.split(/\s+/);
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const everyMin = min.startsWith("*/");
  const tz = beat.timezone ? ` ${beat.timezone}` : "";
  if (everyMin) return `Every ${min.slice(2)}m`;
  if (min === "*" && hour === "*") return "Continuous";
  const mm = /^\d+$/.test(min) ? pad2(Number(min)) : min;
  const hh = /^\d+$/.test(hour) ? pad2(Number(hour)) : hour;
  const time = `${hh}:${mm}`;
  if (dow !== "*" && dom === "*" && mon === "*") {
    if (/^\d$/.test(dow)) return `Weekly · ${DOW_LABELS[Number(dow)]} ${time}${tz}`;
    if (dow === "1-5") return `Weekdays ${time}${tz}`;
    if (dow === "0,6" || dow === "6,0") return `Weekends ${time}${tz}`;
    return `Weekly ${dow} ${time}${tz}`;
  }
  if (dom !== "*" && mon === "*" && dow === "*") {
    return `Monthly · day ${dom} ${time}${tz}`;
  }
  if (dom === "*" && mon === "*" && dow === "*") return `Daily ${time}${tz}`;
  return cron;
}

export function nextRunLabel(beat: {
  cadenceType: string;
  lastScheduledAt?: Date | string | null;
}): string {
  if (beat.cadenceType === "ON_DEMAND") return "On demand";
  return "Scheduled";
}
