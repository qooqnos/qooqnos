import { describe, expect, it } from "vitest";
import { translateCanonicalTerm, translateUiText } from "./i18n-runtime";

describe("browser i18n runtime", () => {
  it("ships the current Business Workspace dictionary", () => {
    expect(translateUiText("کسب‌وکار عمومی", "en")).toBe("General business");
    expect(translateUiText("عرضه را آماده کن", "en")).toBe("Prepare supply");
    expect(translateUiText("مشتری و ارتباط", "en")).toBe("Customers and communication");
    expect(translateUiText("ماژول‌های این حوزه", "en")).toBe("Modules in this area");
  });

  it("keeps canonical terminology available in the browser runtime", () => {
    expect(translateCanonicalTerm("canonical.business.business", "en")).toBe("Business");
    expect(translateCanonicalTerm("canonical.catalog.offering", "en")).toBe("Offering");
    expect(translateCanonicalTerm("canonical.booking.booking", "en")).toBe("Booking");
  });
});
