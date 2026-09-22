import type { Locale, LocaleDefinition, TranslationDictionary } from "./index";
import { getDirection, translations } from "./index";

const DICTIONARIES: Record<Locale, TranslationDictionary> = translations;

export function getLocaleDefinition(locale: Locale): LocaleDefinition {
  return {
    code: locale,
    direction: getDirection(locale),
    dictionary: DICTIONARIES[locale],
  };
}

export function getDictionary(locale: Locale): TranslationDictionary {
  return DICTIONARIES[locale];
}
