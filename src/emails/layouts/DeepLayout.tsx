import * as React from "react";
import { Heading, Section, Text } from "@react-email/components";
import { NewsletterHeader } from "../components/NewsletterHeader";
import { NewsletterFooter } from "../components/NewsletterFooter";
import { Analysis } from "../components/Analysis";
import { EditorsNote } from "../components/EditorsNote";
import { SourceLink } from "../components/SourceLink";
import { EDITORIAL, FONT_MONO, FONT_SANS, FONT_SERIF } from "../components/tokens";
import type { EmailItem, LayoutProps } from "../types";

export function DeepLayout({ spec, issue, issueNumber, unsubscribeUrl, dashboardUrl }: LayoutProps) {
  return (
    <>
      <NewsletterHeader
        spec={spec}
        issueDate={issue.issue_date}
        issueNumber={issueNumber}
        subject={issue.subject}
        dek={issue.dek}
        itemCount={issue.items.length}
      />
      <Section style={{ padding: "28px 36px 36px" }}>
        {issue.coverage_note ? <EditorsNote>{issue.coverage_note}</EditorsNote> : null}
        {issue.items.map((item, idx) => (
          <DeepItem
            key={item.fingerprint}
            item={item}
            index={idx + 1}
            isFirst={idx === 0}
          />
        ))}
      </Section>
      <NewsletterFooter
        unsubscribeUrl={unsubscribeUrl}
        dashboardUrl={dashboardUrl}
      />
    </>
  );
}



const TAG_STYLE: React.CSSProperties = {
  color: EDITORIAL.ink3,
  marginRight: 8,
};

const CAT_STYLE: React.CSSProperties = {
  color: EDITORIAL.accentInk,
  marginRight: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function DeepItem({
  item,
  index,
  isFirst,
}: {
  item: EmailItem;
  index: number;
  isFirst: boolean;
}) {
  const paragraphs = splitParagraphs(item.summary);
  const tags = safeArray(item.tags).slice(0, 2);
  return (
    <Section
      style={{
        padding: isFirst ? "0 0 30px" : "30px 0",
        borderTop: isFirst ? "none" : `1px solid ${EDITORIAL.rule}`,
      }}
    >
      <Text
        style={{
          margin: "0px",
          fontFamily: FONT_MONO,
          fontSize: "9.5px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: EDITORIAL.accentInk,
        }}
      >
        <span style={CAT_STYLE}>№{pad2(index)}</span>
        {tags.map((t) => (
          <span key={t} style={TAG_STYLE}>
            {t}
          </span>
        ))}
      </Text>
      <Heading
        as="h2"
        style={{
          fontFamily: FONT_SANS,
          fontWeight: 600,
          fontSize: 26,
          lineHeight: 1.18,
          textAlign: "justify",
          letterSpacing: "-0.012em",
          color: EDITORIAL.ink,
          margin: "0 0 6px",
        }}
      >
        {item.headline}
      </Heading>
      {paragraphs.map((p, i) => (
        <Text
          key={i}
          style={{
            margin: "0 0 8px",
            fontFamily: FONT_SERIF,
            textAlign: "justify",
            fontSize: 16,
            lineHeight: 1.4,
            color: EDITORIAL.ink2,
          }}
        >
          {p}
        </Text>
      ))}
      {item.why_it_matters ? (
        <Analysis label="Analysis">{item.why_it_matters}</Analysis>
      ) : null}
      <Section
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: `1px dashed ${EDITORIAL.rule}`,
        }}
      >
        <SourceLink url={item.primary_source_url} />
      </Section>
    </Section>
  );
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
