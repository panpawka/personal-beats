import type { ReactNode } from "react";

type PillKind = "default" | "live" | "paused" | "running";

export function Pill({
  kind = "default",
  children,
}: {
  kind?: PillKind;
  children: ReactNode;
}) {
  const cls = kind === "default" ? "pill" : `pill pill-${kind}`;
  return <span className={cls}>{children}</span>;
}
