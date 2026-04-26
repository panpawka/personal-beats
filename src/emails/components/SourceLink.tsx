import * as React from "react";
import { Link, Text } from "@react-email/components";
import { EDITORIAL, FONT_MONO } from "./tokens";
import { useEmailT } from "../i18n";

interface Props {
  url: string;
  variant?: "pill" | "inline" | "button";
  label?: string;
}

const PILL_STYLE: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 7px",
  marginRight: 6,
  marginBottom: 6,
  borderRadius: 3,
  backgroundColor: EDITORIAL.paper2,
  color: EDITORIAL.ink2,
  textDecoration: "none",
  border: `1px solid ${EDITORIAL.rule}`,
  fontFamily: FONT_MONO,
  fontSize: 11,
  lineHeight: 1.4,
};

const INLINE_STYLE: React.CSSProperties = {
  color: EDITORIAL.accentInk,
  textDecoration: "underline",
  fontFamily: FONT_MONO,
  fontSize: 12,
};

export function SourceLink({ url, variant = "pill", label }: Props) {
  const host = safeHost(url);
  const text = label ?? host;
  if (variant === "inline") {
    return (
      <Link href={url} style={INLINE_STYLE}>
        {text}
      </Link>
    );
  }
  // "button" kept as alias for "pill" for API stability.
  return (
    <Link href={url} style={PILL_STYLE}>
      {text}
    </Link>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
