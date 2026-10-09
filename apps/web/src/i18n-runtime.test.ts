import { describe, expect, it } from "vitest";
import { translateCanonicalTerm, translateUiText, translations } from "./i18n-runtime";

describe("browser i18n runtime", () => {
  it("ships the current Business Workspace dictionary", () => {
    expect(translateUiText("کسب‌وکار عمومی", "en")).toBe("General business");
    expect(translateUiText("عرضه را آماده کن", "en")).toBe("Prepare supply");
    expect(translateUiText("مشتری و ارتباط", "en")).toBe("Customers and communication");
    expect(translateUiText("ماژول‌های این حوزه", "en")).toBe("Modules in this area");
  });

  it("keeps all three welcome experiences localized in every supported language", () => {
    const requiredKeys = [
      "ui.welcomeModeIndividualTitle",
      "ui.welcomeModeIndividualDescription",
      "ui.welcomeModeBusinessTitle",
      "ui.welcomeModeBusinessDescription",
      "ui.welcomeModeConsumerTitle",
      "ui.welcomeModeConsumerDescription",
      "ui.consumerTitle",
      "ui.consumerNeedLabel",
      "ui.consumerNeedPlaceholder",
      "ui.consumerSearchAction",
      "ui.consumerQuickTitle",
      "ui.consumerCategoryProducts",
      "ui.consumerCategoryServices",
      "ui.consumerCategoryBook",
      "ui.consumerCategoryCompare",
      "ui.consumerTrustHeading",
      "ui.consumerTrustCopy",
    ];
    for (const key of requiredKeys) {
      expect(translations.fa[key], `missing Persian translation: ${key}`).toBeTruthy();
      expect(translations.en[key], `missing English translation: ${key}`).toBeTruthy();
      expect(translations.ar[key], `missing Arabic translation: ${key}`).toBeTruthy();
    }
    expect(translations.en["ui.welcomeModeConsumerTitle"]).toBe("Buyer");
    expect(translations.ar["ui.welcomeModeConsumerTitle"]).toBe("المشتري");
  });

  it("keeps canonical terminology available in the browser runtime", () => {
    expect(translateCanonicalTerm("canonical.business.business", "en")).toBe("Business");
    expect(translateCanonicalTerm("canonical.catalog.offering", "en")).toBe("Offering");
    expect(translateCanonicalTerm("canonical.booking.booking", "en")).toBe("Booking");
  });
});
