// ============================================================================
// PHOENIX GLOBAL LOCALE SERVICE (Single Source of Truth)
// ============================================================================

import {
  defaultI18n,
  getDirection,
  getLocaleFromPreference,
  persistLocale,
  readPersistedLocale,
  type SupportedLanguage,
} from "./i18n-runtime.js";
import {
  getCalendarType,
  setActiveCalendarLocale,
} from "./calendar-service.js";

export type LocaleListener = (locale: SupportedLanguage) => void;

class LocaleService {
  private currentLocale: SupportedLanguage = "fa";
  private initialized = false;
  private listeners: Set<LocaleListener> = new Set();

  /**
   * Returns the current application-wide locale.
   */
  getLocale(): SupportedLanguage {
    if (!this.initialized) {
      this.initLocale();
    }
    return this.currentLocale;
  }

  /**
   * Returns text direction ("rtl" | "ltr") for current locale.
   */
  getDirection(): "rtl" | "ltr" {
    return getDirection(this.getLocale());
  }

  /**
   * Strict initialization lifecycle adhering to Phoenix specification:
   * 1. Application Start
   * 2. Determine Locale (explicit user preference in localStorage if present; else strictly "fa")
   * 3. Load Translation Dictionary
   * 4. Set Direction (rtl for fa/ar, ltr for en)
   * 5. Set Calendar (jalali for fa, hijri for ar, gregorian for en)
   * 6. Set Number Formatting & Typography attributes
   * 7. Set Date Picker Locale
   * 8. Ready for Application Render
   */
  initLocale(): SupportedLanguage {
    let chosen: SupportedLanguage = "fa";

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const persisted = readPersistedLocale(window.localStorage);
        if (persisted === "fa" || persisted === "en" || persisted === "ar") {
          chosen = persisted;
        } else {
          // If no previous explicit choice exists, Phoenix MUST launch with Persian ("fa").
          chosen = "fa";
        }
      }
    } catch {
      chosen = "fa";
    }

    this.currentLocale = chosen;
    this.applyLocaleAttributes(chosen);
    this.initialized = true;
    return chosen;
  }

  /**
   * Sets the global application locale across the entire system.
   */
  setLocale(locale: SupportedLanguage): void {
    const valid = getLocaleFromPreference(locale, "fa");
    this.currentLocale = valid;

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        persistLocale(valid, window.localStorage);
      }
    } catch {
      // storage unavailable
    }

    this.applyLocaleAttributes(valid);

    // Notify all global listeners so every component, page, header, picker updates synchronously
    for (const listener of this.listeners) {
      try {
        listener(valid);
      } catch (err) {
        console.error("Error in locale change listener:", err);
      }
    }
  }

  /**
   * Subscribe to global locale changes. Returns unsubscribe function.
   */
  subscribe(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Applies all DOM, HTML typography, direction, calendar, and dictionary state.
   */
  private applyLocaleAttributes(locale: SupportedLanguage): void {
    defaultI18n.setLanguage(locale);
    setActiveCalendarLocale(locale);

    if (typeof document !== "undefined" && document.documentElement) {
      const dir = getDirection(locale);
      const calendar = getCalendarType(locale);

      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
      document.documentElement.dataset.locale = locale;
      document.documentElement.dataset.calendar = calendar;
      document.documentElement.dataset.dir = dir;
    }
  }
}

export const globalLocaleService = new LocaleService();
