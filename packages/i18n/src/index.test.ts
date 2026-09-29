import { describe, expect, it } from "vitest";
import {
  defaultI18n,
  getDirection,
  getLocaleFromPreference,
  translateUiText,
  translations,
} from "./index";

describe("@qooqnos/i18n", () => {
  it("loads all supported locale dictionaries", () => {
    expect(translations.fa["ui.tellNeed"]).toBe("نیازت را بگو");
    expect(translations.en["ui.tellNeed"]).toBe("Tell Phoenix what you need");
    expect(translations.ar["ui.tellNeed"]).toBe("أخبر ققنوس بما تحتاج");
  });

  it("translates shared UI text from the canonical dictionary", () => {
    expect(translateUiText("نیازت را بگو", "en")).toBe("Tell Phoenix what you need");
    expect(translateUiText("نیازت را بگو", "ar")).toBe("أخبر ققنوس بما تحتاج");
    expect(translateUiText("Tell Phoenix what you need", "fa")).toBe("نیازت را بگو");
    expect(translateUiText("أخبر ققنوس بما تحتاج", "en")).toBe("Tell Phoenix what you need");
    expect(translateUiText("متن ناشناخته", "en")).toBe("متن ناشناخته");
    expect(translateUiText("کسب‌وکار عمومی", "en")).toBe("General business");
    expect(translateUiText("Your workspace", "fa")).toBe("فضای کاری شما");
    expect(translateUiText("Business Workspace", "fa")).toBe("فضای کاری کسب‌وکار");
    expect(translateUiText("کسب‌وکار تو باید برای مشتری هم به همان اندازه واضح باشد.", "en")).toBe("Your business should be just as clear to customers.");
    expect(translateUiText("از Product Studio یا Catalog شروع کن.", "en")).toBe("Start from Product Studio or Catalog.");
    expect(translateUiText("در حال بررسی نقش:", "en")).toBe("Checking role:");
    expect(translateUiText("ماژول‌های این Workspace بر اساس نوع کسب‌وکار ترکیب می‌شوند؛ مجوزها همچنان توسط backend تعیین می‌شوند.", "en")).toBe("Workspace modules are composed from the business type; permissions remain determined by the backend.");
    expect(translateUiText("فضای کاری من", "en")).toBe("My workspace");
    expect(translateUiText("پروفایل عمومی از داده‌های canonical Business ساخته می‌شود.", "en")).toBe("The public profile is built from canonical Business data.");
  });

  it("resolves duplicate Persian labels to the semantic page namespace when available", () => {
    expect(translateUiText("کسب‌وکار عمومی", "en")).toBe("General business");
    expect(translateUiText("ساخت کسب‌وکار", "en")).toBe("Create business");
    expect(translateUiText("اقدام‌های سریع", "en")).toBe("Quick actions");
    expect(translateUiText("مکان‌ها", "en")).toBe("Locations");
  });

  it("uses the canonical domain vocabulary as the terminology source", () => {
    expect(translations.fa["canonical.business.business"]).toBe("کسب‌وکار");
    expect(translations.fa["canonical.catalog.offering"]).toBe("عرضه");
    expect(translations.fa["canonical.booking.booking"]).toBe("رزرو");
    expect(translations.fa["canonical.booking.appointment"]).toBe("نوبت");
    expect(translations.fa["canonical.identity.permission"]).toBe("مجوز");
    expect(translations.fa["canonical.identity.entitlement"]).toBe("حق دسترسی");

    expect(translateUiText("Business", "fa")).toBe("کسب‌وکار");
    expect(translateUiText("Offering", "fa")).toBe("عرضه");
    expect(translateUiText("Appointment", "fa")).toBe("نوبت");
    expect(translateUiText("کسب‌وکار", "en")).toBe("Business");
    expect(translateUiText("عرضه", "en")).toBe("Offering");
    expect(translateUiText("نوبت", "en")).toBe("Appointment");
    expect(translateUiText("شناسه کسب‌وکار", "en")).toBe("شناسه Business");
    expect(translateUiText("توضیح محصول", "en")).toBe("توضیح Product");
    expect(translateUiText("Business and Product", "fa")).toBe("Business and Product");
  });

  it("translates the Business Workspace dictionary as a complete UI surface", () => {
    expect(translations.en["businessPage.createBusiness"]).toBe("Create business");
    expect(translations.en["businessPage.businessName"]).toBe("Business name");
    expect(translations.en["businessPage.locations"]).toBe("Locations");
    expect(translateUiText("ساخت کسب‌وکار", "en")).toBe("Create business");
    expect(translateUiText("اقدام‌های سریع", "en")).toBe("Quick actions");
    expect(translateUiText("نام کسب‌وکار", "en")).toBe("Business name");
    expect(translateUiText("مکان‌ها", "en")).toBe("Locations");
  });

  it("keeps canonical concepts distinct instead of collapsing synonyms", () => {
    expect(translations.en["canonical.identity.user"]).not.toBe(translations.en["canonical.customer.customer"]);
    expect(translations.en["canonical.business.business"]).not.toBe(translations.en["canonical.catalog.offering"]);
    expect(translations.en["canonical.catalog.service"]).not.toBe(translations.en["canonical.catalog.offering"]);
    expect(translations.en["canonical.booking.booking"]).not.toBe(translations.en["canonical.booking.appointment"]);
    expect(translations.en["canonical.identity.permission"]).not.toBe(translations.en["canonical.identity.entitlement"]);
    expect(translations.en["canonical.matching.recommendation"]).not.toBe(translations.en["canonical.matching.match"]);
  });

  it("keeps direction and locale preference rules centralized", () => {
    expect(getDirection("fa")).toBe("rtl");
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
    expect(getLocaleFromPreference("fa-IR")).toBe("fa");
    expect(getLocaleFromPreference("ar-SA")).toBe("ar");
    expect(getLocaleFromPreference("fr-FR")).toBe("fa");
  });

  it("switches the shared manager without a second translation source", () => {
    defaultI18n.setLanguage("en");
    expect(defaultI18n.t("ui.tellNeed")).toBe("Tell Phoenix what you need");
    defaultI18n.setLanguage("fa");
    expect(defaultI18n.t("ui.tellNeed")).toBe("نیازت را بگو");
  });
});
