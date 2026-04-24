import React from 'react';
import { Button, Hr, Link, Section, Text } from 'react-email';
import { COLOR, FONT_SANS, SPACE } from './tokens';

// ─── Typography ──────────────────────────────────────────────────────────────

export function EmailH1({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: `0 0 ${SPACE.md}`,
        font: `700 24px/1.25 ${FONT_SANS}`,
        letterSpacing: '-0.015em',
        color: COLOR.fg,
      }}>
      {children}
    </Text>
  );
}

export function EmailH2({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: `0 0 ${SPACE.sm}`,
        font: `700 16px/1.3 ${FONT_SANS}`,
        letterSpacing: '-0.01em',
        color: COLOR.fg,
      }}>
      {children}
    </Text>
  );
}

export function EmailOverline({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: `0 0 ${SPACE.sm}`,
        font: `600 11px/1.4 ${FONT_SANS}`,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: COLOR.fgMuted,
      }}>
      {children}
    </Text>
  );
}

export function EmailLead({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: `0 0 ${SPACE.lg}`,
        font: `400 15px/1.6 ${FONT_SANS}`,
        color: COLOR.fg,
      }}>
      {children}
    </Text>
  );
}

export function EmailBody({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: `0 0 ${SPACE.md}`,
        font: `400 14px/1.6 ${FONT_SANS}`,
        color: COLOR.fg,
      }}>
      {children}
    </Text>
  );
}

export function EmailSmall({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <Text
      style={{
        margin: `${SPACE.md} 0 0`,
        font: `400 12px/1.55 ${FONT_SANS}`,
        color: COLOR.fgMuted,
        textAlign: align,
      }}>
      {children}
    </Text>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

export interface EmailButtonProps {
  href: string;
  variant?: 'primary' | 'outline';
  children: React.ReactNode;
}

export function EmailButton({ href, variant = 'primary', children }: EmailButtonProps) {
  const primary: React.CSSProperties = {
    backgroundColor: COLOR.brand,
    color: '#111',
    border: `1px solid ${COLOR.brand}`,
  };
  const outline: React.CSSProperties = {
    backgroundColor: COLOR.bg,
    color: COLOR.fg,
    border: `1px solid ${COLOR.border}`,
  };
  return (
    <Section style={{ textAlign: 'left', margin: `${SPACE.lg} 0` }}>
      <Button
        href={href}
        style={{
          ...(variant === 'primary' ? primary : outline),
          font: `700 14px/1 ${FONT_SANS}`,
          letterSpacing: '-0.005em',
          padding: '14px 22px',
          borderRadius: 0,
          textDecoration: 'none',
          display: 'inline-block',
        }}>
        {children}
      </Button>
    </Section>
  );
}

export function EmailInlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        color: COLOR.accent700,
        textDecoration: 'underline',
        fontWeight: 500,
      }}>
      {children}
    </Link>
  );
}

// ─── Dividers & cards ────────────────────────────────────────────────────────

export function EmailDivider({ spacing = SPACE.xl }: { spacing?: string }) {
  return (
    <Hr
      style={{
        border: 'none',
        borderTop: `1px solid ${COLOR.border}`,
        margin: `${spacing} 0`,
      }}
    />
  );
}

export interface EmailSectionCardProps {
  children: React.ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'danger' | 'muted';
  accentBar?: boolean;
}

/**
 * Sharp-corner content block. The "tone" prop maps to the semantic palette —
 * accent (amber) for highlights, success (green) for best-review callouts,
 * danger (red) for critical alerts, muted (olive) for neutral blocks.
 */
export function EmailSectionCard({
  children,
  tone = 'default',
  accentBar = false,
}: EmailSectionCardProps) {
  const toneStyles: Record<NonNullable<EmailSectionCardProps['tone']>, {
    bg: string;
    border: string;
    barColor: string;
  }> = {
    default: { bg: COLOR.bg, border: COLOR.border, barColor: COLOR.border },
    accent: { bg: COLOR.accent50, border: COLOR.accent200, barColor: COLOR.brand },
    success: { bg: '#F0FDF4', border: '#BBF7D0', barColor: COLOR.success },
    danger: { bg: COLOR.dangerBg, border: '#FECACA', barColor: COLOR.danger },
    muted: { bg: COLOR.bgSubtle, border: COLOR.border, barColor: COLOR.fgMuted },
  };
  const t = toneStyles[tone];

  return (
    <Section
      style={{
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        borderLeftWidth: accentBar ? '3px' : '1px',
        borderLeftColor: accentBar ? t.barColor : t.border,
        borderRadius: 0,
        padding: SPACE.lg,
        margin: `0 0 ${SPACE.lg}`,
      }}>
      {children}
    </Section>
  );
}

// ─── Pills & chips ───────────────────────────────────────────────────────────

export type PillTone = 'neutral' | 'amber' | 'success' | 'danger' | 'warning';

export function EmailPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: PillTone;
}) {
  const palette: Record<PillTone, { bg: string; fg: string }> = {
    neutral: { bg: COLOR.bgMuted, fg: COLOR.fgMuted },
    amber: { bg: COLOR.accent100, fg: COLOR.accent800 },
    success: { bg: COLOR.successBg, fg: COLOR.successText },
    danger: { bg: COLOR.dangerBg, fg: COLOR.dangerText },
    warning: { bg: COLOR.accent100, fg: COLOR.warningText },
  };
  const p = palette[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 9px',
        borderRadius: '999px',
        backgroundColor: p.bg,
        color: p.fg,
        font: `600 11px/1.4 ${FONT_SANS}`,
        letterSpacing: '0.01em',
      }}>
      {children}
    </span>
  );
}

// ─── KPI tile ────────────────────────────────────────────────────────────────

export function EmailKPITile({
  value,
  label,
  valueColor,
}: {
  value: React.ReactNode;
  label: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: COLOR.bgSubtle,
        border: `1px solid ${COLOR.border}`,
        padding: `${SPACE.md} ${SPACE.sm}`,
        textAlign: 'center',
      }}>
      <div
        style={{
          font: `700 22px/1.1 ${FONT_SANS}`,
          color: valueColor ?? COLOR.fg,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}>
        {value}
      </div>
      <div
        style={{
          font: `500 11px/1.4 ${FONT_SANS}`,
          color: COLOR.fgMuted,
          marginTop: '4px',
        }}>
        {label}
      </div>
    </div>
  );
}
