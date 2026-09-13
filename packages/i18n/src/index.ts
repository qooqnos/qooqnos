export const SUPPORTED_LOCALES = ["fa", "en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["fa", "ar"]);

export interface TranslationDictionary {
  readonly [key: string]: string | TranslationDictionary;
}

export interface LocaleDefinition {
  readonly code: Locale;
  readonly direction: "ltr" | "rtl";
  readonly dictionary: TranslationDictionary;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "fa" || value === "en" || value === "ar";
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

export function getLocaleFromPreference(preference: string | null | undefined, fallback: Locale = "en"): Locale {
  if (!preference) return fallback;
  const normalized = preference.toLowerCase().split("-")[0];
  return isLocale(normalized) ? normalized : fallback;
}

export function translate(dictionary: TranslationDictionary, key: string, fallback?: string): string {
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, dictionary);
  return typeof value === "string" ? value : fallback ?? key;
}

export function interpolate(value: string, params: Record<string, string | number> = {}): string {
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function createI18n(dictionary: TranslationDictionary) {
  return {
    t(key: string, params?: Record<string, string | number>, fallback?: string): string {
      return interpolate(translate(dictionary, key, fallback), params);
    },
  };
}
