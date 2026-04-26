// Personal Beats design-system tokens translated for email clients.
// Inlined hex values only — no CSS vars (Outlook/Gmail ignore them).

export const FONT_SANS =
  "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
export const FONT_SERIF =
  "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";

// Editorial palette — resolved from App.css oklch tokens. Mirrors the
// IssueDetailPage look: warm paper, dark ink, vermilion accent.
export const EDITORIAL = {
  paper: "#faf8f4",
  paper2: "#f3f0eb",
  paper3: "#ebe8e1",
  frameBg: "#edebe7",
  ink: "#2c2724",
  ink2: "#4f4944",
  ink3: "#79746e",
  ink4: "#a39f99",
  rule: "#dcd8d2",
  ruleStrong: "#c2bdb5",
  accent: "#c83a2c",
  accentInk: "#b1361f",
  accentSoft: "#f7e9e4",
} as const;

export const COLOR = {
  brand: '#c83a2c',
  brandHover: '#b1361f',
  brandDeep: '#b1361f',

  fg: '#262626',
  fgMuted: '#6B7280',
  fgSubtle: '#9CA3AF',

  bg: '#FFFFFF',
  bgPage: '#F5F5F4',
  bgSubtle: '#F9FAFB',
  bgMuted: '#F0F1F3',

  accent50: '#f7e9e4',
  accent100: '#f7e9e4',
  accent200: '#f7e9e4',
  accent700: '#b1361f',
  accent800: '#b1361f',

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
