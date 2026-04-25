type DotKind = "live" | "paused" | "default";

export function Dot({ kind = "default" }: { kind?: DotKind }) {
  const cls = kind === "default" ? "dot" : `dot ${kind}`;
  return <span className={cls} />;
}
