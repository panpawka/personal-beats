// Personal Beats design-system tokens translated for email clients.
// Inlined hex values only — no CSS vars (Outlook/Gmail ignore them).

export const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

export const COLOR = {
  brand: '#FBBF07',
  brandHover: '#E5AC06',
  brandDeep: '#B45309',

  fg: '#262626',
  fgMuted: '#6B7280',
  fgSubtle: '#9CA3AF',

  bg: '#FFFFFF',
  bgPage: '#F5F5F4',
  bgSubtle: '#F9FAFB',
  bgMuted: '#F0F1F3',

  accent50: '#FFFBEB',
  accent100: '#FEF3C7',
  accent200: '#FDE68A',
  accent700: '#B45309',
  accent800: '#92400E',

  border: '#E5E7EB',
  borderHairline: '#F0F1F3',

  success: '#16A34A',
  successBg: '#DCFCE7',
  successText: '#15803D',

  warning: '#CA8A04',
  warningBg: '#FEF3C7',
  warningText: '#92400E',

  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  dangerText: '#B91C1C',

  info: '#2563EB',
} as const;

export const SPACE = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
} as const;
