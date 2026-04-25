export function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

export function formatIssueNumber(n: number): string {
  return `№${pad3(n)}`;
}

export function formatShortDate(
  input: Date | string | null | undefined,
  locale: string = "en",
): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale || "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
