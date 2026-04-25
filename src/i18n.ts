import { i18n } from "@lingui/core";

export const locales = {
  en: "English",
  pl: "Polski",
} as const;

export type LocaleKey = keyof typeof locales;
export const defaultLocale: LocaleKey = "en";
const STORAGE_KEY = "personal-beat-locale";

export function isLocale(value: string | null | undefined): value is LocaleKey {
  return value !== null && value !== undefined && value in locales;
}

export function getStoredLocale(): LocaleKey {
  if (typeof window === "undefined") return defaultLocale;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : defaultLocale;
}

export function persistLocale(locale: LocaleKey) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}

export async function dynamicActivate(locale: LocaleKey) {
  const { messages } = await import(`./locales/${locale}/messages.po`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}
