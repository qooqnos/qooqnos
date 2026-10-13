import type { Locale } from "./index";
import { getLocaleFromPreference } from "./index";

export const DEFAULT_LOCALE: Locale = "fa";
export const LOCALE_STORAGE_KEY = "qooqnos.locale";

export interface LocalePreference {
  readonly locale: Locale;
  readonly source: "user" | "browser" | "default";
}

export function resolveLocale(options: {
  userPreference?: string | null;
  browserPreference?: string | null;
  fallback?: Locale;
} = {}): LocalePreference {
  const fallback = options.fallback ?? DEFAULT_LOCALE;
  if (options.userPreference) {
    return { locale: getLocaleFromPreference(options.userPreference, fallback), source: "user" };
  }
  // Phoenix default language is strictly Persian (fa). Initial load must never open with
  // another language without prior explicit user choice.
  return { locale: fallback, source: "default" };
}

export function persistLocale(locale: Locale, storage?: Pick<Storage, "setItem"> | null): void {
  storage?.setItem(LOCALE_STORAGE_KEY, locale);
}

export function readPersistedLocale(storage?: Pick<Storage, "getItem"> | null): Locale | null {
  const value = storage?.getItem(LOCALE_STORAGE_KEY);
  return value ? getLocaleFromPreference(value, DEFAULT_LOCALE) : null;
}
