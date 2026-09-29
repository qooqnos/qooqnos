// ============================================================================
// INTERNATIONALIZATION (i18n) SUPPORT
// ============================================================================

import arLocale from "../locales/ar.json";
import enLocale from "../locales/en.json";
import faLocale from "../locales/fa.json";

export type SupportedLanguage = "en" | "fa" | "ar";
export type Locale = SupportedLanguage;

type LocaleTree = Readonly<Record<string, Readonly<Record<string, string>>>>;

export const localeDictionaries: Record<SupportedLanguage, LocaleTree> = {
  en: enLocale,
  fa: faLocale,
  ar: arLocale,
};

function flattenDictionary(
  dictionary: LocaleTree,
  prefix = "",
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(dictionary)) {
    const key = prefix ? prefix + "." + name : name;
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      result[key + "." + nestedKey] = nestedValue;
    }
  }
  return result;
}

export const translations: Record<SupportedLanguage, Readonly<Record<string, string>>> = {
  en: flattenDictionary(enLocale),
  fa: flattenDictionary(faLocale),
  ar: flattenDictionary(arLocale),
};

export type TranslationKey = string;
export type TranslationDictionary = Readonly<Record<string, string>>;

export class I18nManager {
  constructor(private currentLanguage: SupportedLanguage = "fa") {}

  setLanguage(language: SupportedLanguage): void {
    if (!(language in translations)) {
      this.currentLanguage = "fa";
      return;
    }
    this.currentLanguage = language;
  }

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  translate(
    key: TranslationKey,
    variables?: Readonly<Record<string, string>>,
  ): string {
    let text = translations[this.currentLanguage][key]
      ?? translations.fa[key]
      ?? key;

    for (const [varKey, varValue] of Object.entries(variables ?? {})) {
      text = text.replaceAll(`{{${varKey}}}`, varValue);
    }

    return text;
  }

  t(
    key: TranslationKey,
    variables?: Readonly<Record<string, string>>,
  ): string {
    return this.translate(key, variables);
  }
}

export const defaultI18n = new I18nManager("fa");

const uiSourceIndex: ReadonlyMap<string, string> = new Map(
  Object.entries(localeDictionaries.fa.ui ?? {}).map(([key, value]) => [value, "ui." + key]),
);

export function translateUiText(
  value: string,
  locale: Locale,
): string {
  const key = uiSourceIndex.get(value.trim());
  if (!key) return value;
  const translated = translations[locale][key] ?? translations.fa[key];
  if (!translated) return value;
  const leading = value.match(/^\s*/u)?.[0] ?? "";
  const trailing = value.match(/\s*$/u)?.[0] ?? "";
  return leading + translated + trailing;
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "fa" || locale === "ar" ? "rtl" : "ltr";
}

export function getLocaleFromPreference(
  preference: string,
  fallback: Locale = "fa",
): Locale {
  const normalized = preference.trim().toLowerCase().split(/[-_]/u, 1)[0];
  return normalized === "fa" || normalized === "ar" || normalized === "en"
    ? normalized
    : fallback;
}

export interface LocaleDefinition {
  readonly code: Locale;
  readonly direction: "ltr" | "rtl";
  readonly dictionary: TranslationDictionary;
}

export * from "./context";
export * from "./physical-registry";
