// ============================================================================
// INTERNATIONALIZATION (i18n) SUPPORT
// ============================================================================

import arLocale from "./locales/ar.json";
import enLocale from "./locales/en.json";
import faLocale from "./locales/fa.json";

export type SupportedLanguage = "en" | "fa" | "ar";
export type Locale = SupportedLanguage;

interface LocaleObject {
  readonly [key: string]: string | LocaleObject;
}
type LocaleTree = LocaleObject;

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

    if (typeof value === "string") {
      result[key] = value;
      continue;
    }

    Object.assign(result, flattenDictionary(value, key));
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

export type CanonicalTermKey = string;
export const canonicalTerms: Record<SupportedLanguage, Readonly<Record<string, string>>> = {
  fa: Object.fromEntries(Object.entries(translations.fa).filter(([key]) => key.startsWith("canonical."))),
  en: Object.fromEntries(Object.entries(translations.en).filter(([key]) => key.startsWith("canonical."))),
  ar: Object.fromEntries(Object.entries(translations.ar).filter(([key]) => key.startsWith("canonical."))),
};

export function translateCanonicalTerm(
  key: CanonicalTermKey,
  locale: Locale,
): string {
  return canonicalTerms[locale][key] ?? canonicalTerms.fa[key] ?? key;
}

const textKeyIndex = new Map<string, string>();
const indexLanguage = (language: SupportedLanguage, canonicalOnly: boolean): void => {
  for (const [key, text] of Object.entries(translations[language])) {
    if (canonicalOnly !== key.startsWith("canonical.")) continue;
    const normalized = text.trim();
    if (!normalized || textKeyIndex.has(normalized)) continue;
    textKeyIndex.set(normalized, key);
  }
};

// Canonical domain terms always win over legacy/UI convenience labels when a text is ambiguous.
for (const language of ["fa", "en", "ar"] as const) indexLanguage(language, true);
for (const language of ["fa", "en", "ar"] as const) indexLanguage(language, false);

const translationSources = [...textKeyIndex.entries()]
  .filter(([source]) => source.length >= 3)
  .sort((a, b) => b[0].length - a[0].length);

export function translateUiText(
  value: string,
  locale: Locale,
): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  const directKey = textKeyIndex.get(trimmed);
  if (directKey) {
    const translated = translations[locale][directKey] ?? translations.fa[directKey];
    if (translated) {
      const leading = value.match(/^\s*/u)?.[0] ?? "";
      const trailing = value.match(/\s*$/u)?.[0] ?? "";
      return leading + translated + trailing;
    }
  }

  if (!candidate) return value;

  const [source, key] = candidate;
  const translated = translations[locale][key] ?? translations.fa[key];
  return translated ? value.split(source).join(translated) : value;
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
export * from "./preference";
