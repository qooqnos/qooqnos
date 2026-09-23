import { describe, expect, it } from "vitest";
import { createLocaleContext } from "./context";

describe("createLocaleContext", () => {
  it("derives RTL direction for Persian", () => {
    expect(createLocaleContext({
      locale: "fa",
      timezone: "Asia/Tehran",
      currency: "IRR",
    })).toEqual({
      locale: "fa",
      direction: "rtl",
      timezone: "Asia/Tehran",
      calendar: "gregorian",
      currency: "IRR",
    });
  });

  it("keeps locale, timezone and currency independent", () => {
    const context = createLocaleContext({
      locale: "en",
      timezone: "Asia/Baku",
      calendar: "gregorian",
      currency: "AZN",
    });
    expect(context.locale).toBe("en");
    expect(context.timezone).toBe("Asia/Baku");
    expect(context.currency).toBe("AZN");
    expect(context.direction).toBe("ltr");
  });
});
