// Personal Beats design-system tokens, translated for email clients.
// Editorial palette mirrors src/App.css `:root` light theme — oklch resolved
// to hex because Outlook/Gmail strip CSS variables. Keep in sync with the
// in-app theme; if you change one, change both.

export const FONT_SANS =
  "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
export const FONT_SERIF =
  "'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif";

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

export const SPACE = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
} as const;
