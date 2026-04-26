import React from 'react';
import { Button, Link, Section, Text } from 'react-email';
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

