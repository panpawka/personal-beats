export function SignalBars({ level = 3 }: { level?: number }) {
  const safe = Math.max(0, Math.min(5, Math.round(level)));
  return (
    <span className="signal-bars" aria-label={`signal ${safe}/5`}>
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
