// ============================================================================
// INTERNATIONALIZATION (i18n) SUPPORT
// ============================================================================

export type SupportedLanguage = "en" | "fa" | "ar";

export interface TranslationKeys {
  readonly "common.welcome": string;
  readonly "common.goodbye": string;
  readonly "common.error": string;
  readonly "common.success": string;
  readonly "auth.login": string;
  readonly "auth.logout": string;
  readonly "auth.unauthorized": string;
  readonly "validation.email.invalid": string;
  readonly "validation.required": string;
  readonly "api.error.notFound": string;
  readonly "api.error.serverError": string;
}

export const translations: Record<SupportedLanguage, TranslationKeys> = {
  en: {
    "common.welcome": "Welcome to Phoenix",
    "common.goodbye": "Goodbye",
    "common.error": "An error occurred",
    "common.success": "Success",
    "auth.login": "Login",
    "auth.logout": "Logout",
    "auth.unauthorized": "Unauthorized access",
    "validation.email.invalid": "Invalid email address",
    "validation.required": "This field is required",
    "api.error.notFound": "Resource not found",
    "api.error.serverError": "Internal server error",
  },
  fa: {
    "common.welcome": "خوش آمدید به فینیکس",
    "common.goodbye": "خداحافظ",
    "common.error": "یک خطا رخ داد",
    "common.success": "موفقیت",
    "auth.login": "ورود",
    "auth.logout": "خروج",
    "auth.unauthorized": "دسترسی غیرمجاز",
    "validation.email.invalid": "آدرس ایمیل نامعتبر است",
    "validation.required": "این فیلد ضروری است",
    "api.error.notFound": "منبع یافت نشد",
    "api.error.serverError": "خطای داخلی سرور",
  },
  ar: {
    "common.welcome": "أهلا بك في فينيكس",
    "common.goodbye": "وداعا",
    "common.error": "حدث خطأ",
    "common.success": "نجاح",
    "auth.login": "تسجيل الدخول",
    "auth.logout": "تسجيل الخروج",
    "auth.unauthorized": "وصول غير مصرح",
    "validation.email.invalid": "عنوان بريد إلكتروني غير صحيح",
    "validation.required": "هذا الحقل مطلوب",
    "api.error.notFound": "لم يتم العثور على المورد",
    "api.error.serverError": "خطأ في الخادم الداخلي",
  },
};

export class I18nManager {
  constructor(private currentLanguage: SupportedLanguage = "en") {}

  setLanguage(language: SupportedLanguage): void {
    if (!(language in translations)) {
      console.warn(`Language ${language} not supported, falling back to en`);
      this.currentLanguage = "en";
    } else {
      this.currentLanguage = language;
    }
  }

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  translate<K extends keyof TranslationKeys>(
    key: K,
    variables?: Record<string, string>
  ): string {
    let text = translations[this.currentLanguage][key];

    if (variables) {
      for (const [varKey, varValue] of Object.entries(variables)) {
        text = text.replace(`{{${varKey}}}`, varValue);
      }
    }

    return text;
  }

  t<K extends keyof TranslationKeys>(
    key: K,
    variables?: Record<string, string>
  ): string {
    return this.translate(key, variables);
  }
}

export const defaultI18n = new I18nManager("en");


export type Locale = SupportedLanguage;
export type TranslationDictionary = TranslationKeys;

export interface LocaleDefinition {
  readonly code: Locale;
  readonly direction: "ltr" | "rtl";
  readonly dictionary: TranslationDictionary;
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "fa" || locale === "ar" ? "rtl" : "ltr";
}

export function getLocaleFromPreference(preference: string, fallback: Locale = "en"): Locale {
  const normalized = preference.trim().toLowerCase().split(/[-_]/, 1)[0];
  return normalized === "fa" || normalized === "ar" || normalized === "en"
    ? normalized
    : fallback;
}

export * from "./context";

export * from "./physical-registry";
