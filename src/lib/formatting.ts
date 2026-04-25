export function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

export function formatIssueNumber(n: number): string {
  return `№${pad3(n)}`;
}

export function formatShortDate(input: Date | string | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTimeAgo(input: Date | string | null | undefined): string {
  if (!input) return "never";
  const then = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(then.getTime())) return "never";
  const diff = Date.now() - then.getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
