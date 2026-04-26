import * as React from "react";

const CITE_PATTERN = /<cite\b[^>]*>([\s\S]*?)<\/cite>/g;

export interface RenderCitationsOptions {
  tag?: React.ElementType;
  style?: React.CSSProperties;
  className?: string;
}

export function renderWithCitations(
  text: string | null | undefined,
  options: RenderCitationsOptions = {},
): React.ReactNode {
  if (!text) return text ?? null;
  const { tag: Tag = "cite", style, className } = options;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(CITE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }
    nodes.push(
      <Tag key={`cite-${key++}`} style={style} className={className}>
        {match[1]}
      </Tag>,
    );
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function stripCitations(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(CITE_PATTERN, (_m, inner) => String(inner));
}
