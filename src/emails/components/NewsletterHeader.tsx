import * as React from "react";
import { Heading, Section, Text } from "@react-email/components";
import { EDITORIAL, FONT_MONO, FONT_SANS, FONT_SERIF } from "./tokens";
import type { BeatSpec } from "../../shared/types";

interface Props {
  spec: BeatSpec;
  issueDate: string;
  issueNumber: number;
  subject: string;
  dek: string;
  itemCount?: number;
  fromEmail?: string;
  toEmail?: string;
}

const META_STYLE: React.CSSProperties = {
  padding: "14px 28px",
  borderBottom: `1px solid ${EDITORIAL.rule}`,
  fontFamily: FONT_MONO,
  fontSize: 11,
  color: EDITORIAL.ink3,
  margin: 0,
};

const EST_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: FONT_MONO,
  fontSize: "9.5px",
  color: EDITORIAL.ink3,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const H1_STYLE: React.CSSProperties = {
  fontFamily: FONT_SANS,
  fontWeight: 400,
  fontSize: 44,
  lineHeight: 1,
  letterSpacing: "-0.02em",
  margin: "6px 0 8px",
  color: EDITORIAL.ink,
};

const DECK_STYLE: React.CSSProperties = {
  fontFamily: FONT_SERIF,
  fontStyle: "italic",
  fontSize: 15,
  lineHeight: 1.45,
  color: EDITORIAL.ink3,
  margin: "4px 0 14px",
};

const FOLIO_STYLE: React.CSSProperties = {
  fontFamily: FONT_MONO,
  fontSize: "9.5px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: EDITORIAL.ink3,
  borderTop: `1px solid ${EDITORIAL.rule}`,
  paddingTop: 12,
  margin: 0,
};

export function NewsletterHeader({
  spec,
  issueDate,
  subject,
  dek,
  itemCount,
  fromEmail,
  toEmail,
}: Props) {
  const showMeta = !!(fromEmail || toEmail);
  return (
    <>
      {showMeta ? (
        <Section style={META_STYLE}>
          <Text
            style={{
              margin: 0,
              fontFamily: FONT_MONO,
              fontSize: 11,
              color: EDITORIAL.ink3,
            }}
          >
            <span style={{ color: EDITORIAL.ink, fontWeight: 500 }}>
              {fromEmail ?? ""}
            </span>
            {fromEmail && toEmail ? "  →  " : ""}
            <span>{toEmail ?? ""}</span>
          </Text>
        </Section>
      ) : null}

      <Section
        style={{
          padding: "32px 36px 24px",
          borderBottom: `2px solid ${EDITORIAL.ink}`,
          textAlign: "center",
        }}
      >
        <Text style={EST_STYLE}>
          {spec.title} · Vol. I
        </Text>
        <Heading as="h1" style={H1_STYLE}>
          {subject}
        </Heading>
        {dek ? <Text style={DECK_STYLE}>{dek}</Text> : null}

        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={FOLIO_STYLE}
        >
          <tbody>
            <tr>
              <td align="left" style={{ padding: 0 }}>
                {issueDate}
              </td>
              {typeof itemCount === "number" ? (
                <td align="right" style={{ padding: 0 }}>
                  {itemCount} {itemCount === 1 ? "story" : "stories"}
                </td>
              ) : null}
            </tr>
          </tbody>
        </table>
      </Section>
    </>
  );
}
