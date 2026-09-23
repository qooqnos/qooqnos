import type { Locale } from "./index";

export interface LocaleContext {
  readonly locale: Locale;
  readonly direction: "ltr" | "rtl";
  readonly timezone: string;
  readonly calendar: "gregorian" | "jalali";
  readonly currency: string;
}

export interface MarketContext {
  readonly countryCode: string;
  readonly marketCode: string;
  readonly locale: Locale;
  readonly timezone: string;
  readonly currency: string;
  readonly legalProfile: string;
}

export interface PolicyContext {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly jurisdiction: string;
  readonly effectiveAt: string;
}

export interface MoneyFormatter {
  format(amountMinor: number, currencyCode: string, locale: Locale): string;
}

export interface CalendarAdapter {
  format(instant: string, locale: Locale, timezone: string): string;
}

export interface TranslationService {
  translate(
    key: string,
    locale: Locale,
    variables?: Readonly<Record<string, string>>,
  ): string;
}

export function createLocaleContext(options: {
  readonly locale: Locale;
  readonly timezone: string;
  readonly calendar?: LocaleContext["calendar"];
  readonly currency: string;
}): LocaleContext {
  return {
    locale: options.locale,
    direction: options.locale === "fa" || options.locale === "ar" ? "rtl" : "ltr",
    timezone: options.timezone,
    calendar: options.calendar ?? "gregorian",
    currency: options.currency,
  };
}
