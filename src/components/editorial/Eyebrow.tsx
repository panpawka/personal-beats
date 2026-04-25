import type { ReactNode } from "react";

export function Eyebrow({
  children,
  mono = false,
  className = "",
}: {
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  const base = mono ? "eyebrow-mono" : "eyebrow";
  return <span className={className ? `${base} ${className}` : base}>{children}</span>;
}
