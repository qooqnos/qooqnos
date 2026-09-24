import type { LocaleContext, MarketContext, PolicyContext } from "./context";

export interface LocalizationRegistryReader {
  resolve(
    marketCode: string,
    domainKey?: string,
  ): Promise<{
    readonly market: {
      readonly countryCode: string;
      readonly localeCode: string;
      readonly legalProfileId: string | null;
      readonly timezone: string;
      readonly currencyCode: string;
      readonly calendarCode: "gregorian" | "jalali";
    };
    readonly country: {
      readonly code: string;
      readonly defaultLocaleCode: string;
      readonly defaultCurrencyCode: string;
      readonly defaultTimezone: string;
    };
    readonly locale: {
      readonly code: string;
      readonly languageCode: string;
      readonly direction: "ltr" | "rtl";
      readonly defaultCalendar: "gregorian" | "jalali";
      readonly fallbackLocaleCode: string | null;
    };
    readonly legalProfile: {
      readonly id: string;
      readonly jurisdictionCode: string;
      readonly version: string;
      readonly effectiveAt: string;
    } | null;
    readonly domainConfig: {
      readonly domainKey: string;
      readonly version: string;
      readonly localeCode: string | null;
      readonly configJson: string;
    } | null;
  } | null>;
}

export interface ResolvedLocalization {
  readonly localeContext: LocaleContext;
  readonly marketContext: MarketContext;
  readonly policyContext: PolicyContext | null;
  readonly domainConfig: Readonly<Record<string, unknown>> | null;
}

export async function resolveLocalization(
  registry: LocalizationRegistryReader,
  marketCode: string,
  domainKey?: string,
): Promise<ResolvedLocalization | null> {
  const resolved = await registry.resolve(marketCode, domainKey);
  if (!resolved) return null;

  const parsedConfig = resolved.domainConfig
    ? parseConfig(resolved.domainConfig.configJson)
    : null;

  return {
    localeContext: {
      locale: resolved.locale.code as LocaleContext["locale"],
      direction: resolved.locale.direction,
      timezone: resolved.market.timezone,
      calendar: resolved.market.calendarCode,
      currency: resolved.market.currencyCode,
    },
    marketContext: {
      countryCode: resolved.market.countryCode,
      marketCode,
      locale: resolved.locale.code as MarketContext["locale"],
      timezone: resolved.market.timezone,
      currency: resolved.market.currencyCode,
      legalProfile: resolved.legalProfile?.id ?? "none",
    },
    policyContext: resolved.legalProfile
      ? {
        policyId: resolved.legalProfile.id,
        policyVersion: resolved.legalProfile.version,
        jurisdiction: resolved.legalProfile.jurisdictionCode,
        effectiveAt: resolved.legalProfile.effectiveAt,
      }
      : null,
    domainConfig: parsedConfig,
  };
}

function parseConfig(value: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Localization domain config must be a JSON object");
    }
    return parsed as Readonly<Record<string, unknown>>;
  } catch (error) {
    throw new Error(
      "Localization domain config is invalid JSON",
      { cause: error },
    );
  }
}
