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
    expect(translateUiText("شروع کن و هرچه برای تصمیم مهم است بنویس", "en")).toBe("شروع کن و هرچه برای تصمیم مهم است بنویس");
    expect(translateUiText("متن ناشناخته", "en")).toBe("متن ناشناخته");
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
