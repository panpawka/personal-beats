import React from 'react';
import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email';
import { EDITORIAL, FONT_MONO, FONT_SANS, FONT_SERIF, SPACE } from './tokens';

export interface EmailTemplateLayoutProps {
  /** Document <title> + fallback subject line. */
  title: string;
  /** Inbox preview text (hidden in body, shown in inbox snippet). */
  previewText: string;
  /** Mono uppercase eyebrow rendered top-right of the masthead. */
  eyebrow?: string;
  /** Optional second line under the wordmark. */
  subtitle?: string;
  /** Optional unsubscribe URL. When provided, renders in the footer. */
  unsubscribeUrl?: string;
  children: React.ReactNode;
}

/**
 * Editorial transactional shell — newsroom chrome around the body.
 *
 *   [masthead — ink mark + serif italic wordmark + mono eyebrow]
 *     ── 1.5px double-rule (per DESIGN §2.4) ──
 *   [body — sans copy on paper, hairline rules]
 *     ── 1.5px double-rule ──
 *   [footer — mono uppercase legal line + optional unsubscribe]
 *
 * Newsletter sends use a separate chain (NewsletterEmail.tsx).
 */
export function EmailTemplateLayout({
  title,
  previewText,
  eyebrow,
  subtitle,
  unsubscribeUrl,
  children,
}: EmailTemplateLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <Font
          fontFamily="Source Serif 4"
          fallbackFontFamily="Georgia"
          webFont={{
            url: 'https://fonts.gstatic.com/s/sourceserif4/v8/vEFy2_tTDB4M7-auWDN0ahZJW1ge6OZw.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Source Serif 4"
          fallbackFontFamily="Georgia"
          webFont={{
            url: 'https://fonts.gstatic.com/s/sourceserif4/v8/vEFy2_tTDB4M7-auWDN0ahZJW1geyOZw.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="italic"
        />
        <Font
          fontFamily="JetBrains Mono"
          fallbackFontFamily="monospace"
          webFont={{
            url: 'https://fonts.gstatic.com/s/jetbrainsmono/v22/tDbY2o-flEEny0FZhsfKu5WU4xD-IQ-PuZJJXxfpAO-Lf1OQk6OK.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          padding: '32px 16px 56px',
          backgroundColor: EDITORIAL.frameBg,
          fontFamily: FONT_SANS,
          color: EDITORIAL.ink,
          WebkitFontSmoothing: 'antialiased',
        }}>
        <Container
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            backgroundColor: EDITORIAL.paper,
            border: `1px solid ${EDITORIAL.rule}`,
            boxShadow: '0 8px 32px -12px rgba(0,0,0,0.18)',
          }}>
          <Masthead eyebrow={eyebrow} subtitle={subtitle} />
          <Section style={{ padding: '32px 36px 36px' }}>{children}</Section>
        </Container>
        <LegalFooter unsubscribeUrl={unsubscribeUrl} />
      </Body>
    </Html>
  );
}

function Masthead({ eyebrow, subtitle }: { eyebrow?: string; subtitle?: string }) {
  return (
    <Section
      style={{
        padding: '26px 36px 16px',
        borderBottom: `1.5px double ${EDITORIAL.ink}`,
      }}>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        width="100%"
        style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', width: '1%', whiteSpace: 'nowrap' }}>
              <BrandMark />
            </td>
            <td
              style={{
                verticalAlign: 'middle',
                paddingLeft: SPACE.md,
                font: `400 22px/1 ${FONT_SERIF}`,
                fontStyle: 'italic',
                letterSpacing: '-0.01em',
                color: EDITORIAL.ink,
              }}>
              <span style={{ fontWeight: 600, color: EDITORIAL.accent }}>Personal</span>{' '}
              Beats
            </td>
            {eyebrow && (
              <td
                style={{
                  verticalAlign: 'middle',
                  textAlign: 'right',
                  font: `500 10.5px/1 ${FONT_MONO}`,
                  color: EDITORIAL.ink3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                }}>
                {eyebrow}
              </td>
            )}
          </tr>
        </tbody>
      </table>
      {subtitle && (
        <Text
          style={{
            margin: `${SPACE.md} 0 0`,
            font: `400 13px/1.45 ${FONT_SANS}`,
            color: EDITORIAL.ink3,
          }}>
          {subtitle}
        </Text>
      )}
    </Section>
  );
}

/** 38×38 ink square with serif italic "P" in paper. The accent dot from the
 *  in-app brand mark (DESIGN §3.2) is omitted — absolute positioning is
 *  unreliable in Outlook/Gmail. */
function BrandMark() {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td
            width={38}
            height={38}
            style={{
              width: '38px',
              height: '38px',
              backgroundColor: EDITORIAL.ink,
              textAlign: 'center',
              verticalAlign: 'middle',
              font: `400 22px/1 ${FONT_SERIF}`,
              fontStyle: 'italic',
              color: EDITORIAL.paper,
              letterSpacing: '-0.02em',
            }}>
            P
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function LegalFooter({ unsubscribeUrl }: { unsubscribeUrl?: string }) {
  const year = new Date().getFullYear();
  const linkStyle: React.CSSProperties = {
    color: EDITORIAL.ink3,
    textDecoration: 'underline',
  };
  return (
    <Container
      style={{
        maxWidth: '640px',
        margin: `${SPACE.lg} auto 0`,
        padding: `${SPACE.lg} ${SPACE.sm} 0`,
        textAlign: 'center',
      }}>
      <Text
        style={{
          margin: 0,
          font: `500 10.5px/1.6 ${FONT_MONO}`,
          color: EDITORIAL.ink3,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
        © {year} Personal Beats · Lemonode sp. z o.o. · Warszawa
      </Text>
      {unsubscribeUrl && (
        <>
          <Hr
            style={{
              border: 'none',
              borderTop: `1px solid ${EDITORIAL.rule}`,
              margin: `${SPACE.md} auto`,
              width: '40px',
            }}
          />
          <Text
            style={{
              margin: 0,
              font: `400 11px/1.6 ${FONT_SANS}`,
              color: EDITORIAL.ink3,
            }}>
            <Link href={unsubscribeUrl} style={linkStyle}>
              Unsubscribe from this kind of message
            </Link>
          </Text>
        </>
      )}
    </Container>
  );
}

export default EmailTemplateLayout;
