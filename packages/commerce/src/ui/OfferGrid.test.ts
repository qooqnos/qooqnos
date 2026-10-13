import { describe, it, expect, vi } from "vitest";
import {
  STANDARD_CUSTOMER_GROUPS,
  buildInitialOfferGridItems,
  renderOfferGridHtml,
  type OfferGridState,
  type OfferGridProps,
} from "./OfferGrid";
import { OfferStatus, type Offer } from "../types/offer";
import { brandId } from "@qooqnos/core";

describe("OfferGrid UI Component (Admin Dashboard)", () => {
  const sellerId = brandId<"EntityId">("seller-shop-1");
  const productId = brandId<"EntityId">("product-book-1");

  it("builds initial offer items covering all standard customer groups", () => {
    const existingOffers: Offer[] = [
      {
        id: brandId<"EntityId">("off-partner"),
        sellerId,
        productId,
        customerGroup: "partner",
        audience: { type: "group", group: "partner" },
        availabilityStatus: "available",
        available: true,
        priceAmountMinor: 1500000,
        currency: "IRR",
        status: OfferStatus.ACTIVE,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const items = buildInitialOfferGridItems(existingOffers, "IRR", 2000000);
    expect(items.length).toBe(STANDARD_CUSTOMER_GROUPS.length);

    // Partner group was pre-existing with 1,500,000
    const partnerItem = items.find((i) => i.customerGroup === "partner");
    expect(partnerItem).toBeDefined();
    expect(partnerItem?.priceAmountMinor).toBe(1500000);
    expect(partnerItem?.isAvailable).toBe(true);

    // Consumer group has base fallback 2,000,000
    const consumerItem = items.find((i) => i.customerGroup === "consumer");
    expect(consumerItem).toBeDefined();
    expect(consumerItem?.priceAmountMinor).toBe(2000000);
    expect(consumerItem?.isAvailable).toBe(true);
  });

  it("renders the Offer grid HTML with toggle inputs and price fields", () => {
    const state: OfferGridState = {
      sellerId,
      productId,
      currency: "IRR",
      items: [
        {
          customerGroup: "consumer",
          labelFa: "مصرف‌کننده عادی",
          labelEn: "General Consumer",
          isAvailable: true,
          availabilityStatus: "available",
          priceAmountMinor: 1000000,
          currency: "IRR",
          status: OfferStatus.ACTIVE,
        },
        {
          customerGroup: "partner",
          labelFa: "همکار تجاری",
          labelEn: "Business Partner",
          isAvailable: false,
          availabilityStatus: "unavailable",
          priceAmountMinor: 800000,
          currency: "IRR",
          status: OfferStatus.ACTIVE,
        },
      ],
    };

    const props: OfferGridProps = {
      state,
      onToggleAvailability: vi.fn(),
      onPriceChange: vi.fn(),
      onSaveAll: vi.fn(),
    };

    const html = renderOfferGridHtml(props);

    // Verify grid headers and rows exist
    expect(html).toContain("ماتریس قیمت‌گذاری و دسترسی گروه‌های مشتریان");
    expect(html).toContain("مصرف‌کننده عادی");
    expect(html).toContain("همکار تجاری");
    expect(html).toContain("offer-avail-toggle");
    expect(html).toContain("offer-price-input");
    expect(html).toContain("offer-grid-save-btn");
  });
});
