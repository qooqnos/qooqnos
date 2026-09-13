import type { Locale, LocaleDefinition, TranslationDictionary } from "./index";
import { getDirection } from "./index";
import fa from "../locales/fa.json";
import en from "../locales/en.json";
import ar from "../locales/ar.json";

const DICTIONARIES: Record<Locale, TranslationDictionary> = { fa, en, ar };

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
