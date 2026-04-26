import React from 'react';
import { Button, Link, Section, Text } from 'react-email';
import { EDITORIAL, FONT_MONO, FONT_SANS, FONT_SERIF, SPACE } from './tokens';

// ─── Typography ──────────────────────────────────────────────────────────────

/**
 * Page headline — sans, weight 500, with optional `<EmailAccent>` spans
 * inline (serif italic, accent red). Mirrors the landing/dashboard h1 pattern
 * from DESIGN.md §2.2.
 */
export function EmailH1({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: `0 0 ${SPACE.md}`,
        font: `500 32px/1.1 ${FONT_SANS}`,
        letterSpacing: '-0.018em',
        color: EDITORIAL.ink,
      }}>
      {children}
    </Text>
  );
}

/** Serif-italic accent word, rendered in `--accent`. Use inside EmailH1. */
export function EmailAccent({ children }: { children: React.ReactNode }) {
  return (
    <em
      style={{
        fontFamily: FONT_SERIF,
        fontStyle: 'italic',
        fontWeight: 400,
        color: EDITORIAL.accent,
      }}>
      {children}
    </em>
  );
}

/** Body / lede paragraph — sans 15.5px, ink-2. */
export function EmailLead({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: `0 0 ${SPACE.lg}`,
        font: `400 15.5px/1.6 ${FONT_SANS}`,
        color: EDITORIAL.ink2,
      }}>
      {children}
    </Text>
  );
}

/** Micro-copy / disclaimer — sans 12.5px, ink-3. */
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
        font: `400 12.5px/1.6 ${FONT_SANS}`,
        color: EDITORIAL.ink3,
        textAlign: align,
      }}>
      {children}
    </Text>
  );
}

/** Mono uppercase eyebrow — for section labels and metadata rows. */
export function EmailEyebrow({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <Text
      style={{
        margin: 0,
        font: `500 10.5px/1 ${FONT_MONO}`,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: EDITORIAL.ink3,
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

/**
 * Primary editorial button — ink fill, paper label. Outline variant uses a
 * hairline ink border on paper. 6px radius per DESIGN §2.4.
 */
export function EmailButton({ href, variant = 'primary', children }: EmailButtonProps) {
  const primary: React.CSSProperties = {
    backgroundColor: EDITORIAL.ink,
    color: EDITORIAL.paper,
    border: `1px solid ${EDITORIAL.ink}`,
  };
  const outline: React.CSSProperties = {
    backgroundColor: EDITORIAL.paper,
    color: EDITORIAL.ink,
    border: `1px solid ${EDITORIAL.ink}`,
  };
  return (
    <Section style={{ textAlign: 'left', margin: `${SPACE.lg} 0 ${SPACE.xl}` }}>
      <Button
        href={href}
        style={{
          ...(variant === 'primary' ? primary : outline),
          font: `500 14px/1 ${FONT_SANS}`,
          letterSpacing: '-0.005em',
          padding: '14px 22px',
          borderRadius: 6,
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
        color: EDITORIAL.accent,
        textDecoration: 'underline',
        fontWeight: 500,
      }}>
      {children}
    </Link>
  );
}
