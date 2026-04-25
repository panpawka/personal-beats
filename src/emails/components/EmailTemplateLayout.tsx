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
import { COLOR, FONT_SANS, SPACE } from './tokens';

export interface EmailTemplateLayoutProps {
  /** Document <title> + fallback subject line. */
  title: string;
  /** Inbox preview text (hidden in body, shown in inbox snippet). */
  previewText: string;
  /** Overline text rendered next to the wordmark (e.g. "Tygodniowy Playbook"). */
  eyebrow?: string;
  /** Second line under the wordmark (e.g. business name). */
  subtitle?: string;
  /** Optional unsubscribe URL. When provided, an unsubscribe link renders in the footer. */
  unsubscribeUrl?: string;
  children: React.ReactNode;
}

/**
 * Shared email layout for transactional emails. Newsletter emails use a
 * separate chain. Structure:
 *
 *   [brand header — mark + wordmark + optional eyebrow/subtitle]
 *   [body content, 1px hairline borders, 600px container]
 *   [footer — legal line + Lemonode attribution + optional unsubscribe]
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
          fontFamily="Inter"
          fallbackFontFamily={['Arial', 'Helvetica', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1ZL7.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily={['Arial', 'Helvetica', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1pL7.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily={['Arial', 'Helvetica', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIa1Zr7.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: COLOR.bgPage,
          fontFamily: FONT_SANS,
          color: COLOR.fg,
          WebkitFontSmoothing: 'antialiased',
        }}>
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: `${SPACE.xxl} ${SPACE.lg}`,
          }}>
          <Section
            style={{
              backgroundColor: COLOR.bg,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 0,
            }}>
            <BrandHeader eyebrow={eyebrow} subtitle={subtitle} />
            <Section style={{ padding: `${SPACE.xl} ${SPACE.xxl}` }}>
              {children}
            </Section>
          </Section>
          <LegalFooter unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
}

function BrandHeader({ eyebrow, subtitle }: { eyebrow?: string; subtitle?: string }) {
  return (
    <Section
      style={{
        padding: `${SPACE.xl} ${SPACE.xxl}`,
        borderBottom: `1px solid ${COLOR.border}`,
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
                font: `800 18px/1 ${FONT_SANS}`,
                letterSpacing: '-0.01em',
                color: COLOR.fg,
              }}>
              personal newsroom
            </td>
            {eyebrow && (
              <td
                style={{
                  verticalAlign: 'middle',
                  textAlign: 'right',
                  font: `600 11px/1.2 ${FONT_SANS}`,
                  color: COLOR.fgMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
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
            font: `500 13px/1.45 ${FONT_SANS}`,
            color: COLOR.fgMuted,
          }}>
          {subtitle}
        </Text>
      )}
    </Section>
  );
}

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
            width={28}
            height={28}
            style={{
              width: '28px',
              height: '28px',
              backgroundColor: COLOR.brand,
              textAlign: 'center',
              verticalAlign: 'middle',
              font: `800 15px/1 ${FONT_SANS}`,
              color: '#111',
              letterSpacing: '-0.02em',
            }}>
            p
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function LegalFooter({ unsubscribeUrl }: { unsubscribeUrl?: string }) {
  const year = new Date().getFullYear();
  const linkStyle: React.CSSProperties = {
    color: COLOR.fgMuted,
    textDecoration: 'underline',
  };
  return (
    <Section style={{ padding: `${SPACE.xl} ${SPACE.sm} 0`, textAlign: 'center' }}>
      <Text
        style={{
          margin: 0,
          font: `500 11px/1.6 ${FONT_SANS}`,
          color: COLOR.fgMuted,
          letterSpacing: '0.02em',
        }}>
        © {year} Personal Beats · Lemonode sp. z o.o. · Warszawa
      </Text>
      {unsubscribeUrl && (
        <>
          <Hr
            style={{
              border: 'none',
              borderTop: `1px solid ${COLOR.border}`,
              margin: `${SPACE.md} auto`,
              width: '40px',
            }}
          />
          <Text
            style={{
              margin: 0,
              font: `400 11px/1.6 ${FONT_SANS}`,
              color: COLOR.fgMuted,
            }}>
            <Link href={unsubscribeUrl} style={linkStyle}>
              Unsubscribe from this kind of message
            </Link>
          </Text>
        </>
      )}
    </Section>
  );
}

export default EmailTemplateLayout;
