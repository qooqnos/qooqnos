import { describe, expect, it } from "vitest";
import { resolveLocalization, type LocalizationRegistryReader } from "./physical-registry";

describe("resolveLocalization", () => {
  it("composes the canonical market, locale and legal context", async () => {
    const registry: LocalizationRegistryReader = {
      async resolve() {
        return {
          market: {
            countryCode: "IR",
            localeCode: "fa",
            legalProfileId: "ir-v1",
            timezone: "Asia/Tehran",
            currencyCode: "IRR",
            calendarCode: "jalali",
          },
          country: {
            code: "IR",
            defaultLocaleCode: "fa",
            defaultCurrencyCode: "IRR",
            defaultTimezone: "Asia/Tehran",
          },
          locale: {
            code: "fa",
            languageCode: "fa",
            direction: "rtl",
            defaultCalendar: "jalali",
            fallbackLocaleCode: "en",
          },
          legalProfile: {
            id: "ir-v1",
            jurisdictionCode: "IR",
            version: "1",
            effectiveAt: "2026-01-01T00:00:00.000Z",
          },
          domainConfig: {
            domainKey: "catalog",
            version: "1",
            localeCode: "fa",
            configJson: '{"display":"localized"}',
          },
        };
      },
    };

    const result = await resolveLocalization(registry, "ir", "catalog");

    expect(result?.localeContext).toEqual({
      locale: "fa",
      direction: "rtl",
      timezone: "Asia/Tehran",
      calendar: "jalali",
      currency: "IRR",
    });
    expect(result?.marketContext.countryCode).toBe("IR");
    expect(result?.policyContext?.policyVersion).toBe("1");
    expect(result?.domainConfig).toEqual({ display: "localized" });
  });

  it("returns null when no active market is registered", async () => {
    const registry: LocalizationRegistryReader = {
      async resolve() {
        return null;
      },
    };

    await expect(resolveLocalization(registry, "unknown")).resolves.toBeNull();
  });
});
