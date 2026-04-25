import { useLingui } from "@lingui/react/macro";

export function SignalBars({ level = 3 }: { level?: number }) {
  const { t } = useLingui();
  const safe = Math.max(0, Math.min(5, Math.round(level)));
  return (
    <span className="signal-bars" aria-label={t`signal ${safe}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= safe ? "on" : ""}
          style={{ height: `${3 + i * 1.6}px` }}
        />
      ))}
    </span>
  );
}
