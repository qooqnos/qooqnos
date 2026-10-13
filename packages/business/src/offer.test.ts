import { describe, it, expect } from "vitest";
import {
  createBusinessOffer,
  isBusinessOfferPurchasable,
  BusinessOfferStatus,
} from "./offer";

describe("BusinessOffer Model (Unified Commercial Entity)", () => {
  it("integrates Product, CustomerGroup, Pricing, and Availability into a single Offer entity", () => {
    const offer = createBusinessOffer({
      id: "off-partner-1",
      businessId: "biz-tehran-tech",
      productId: "prod-tshirt-1",
      customerGroup: "partner",
      isAvailable: true,
      priceAmountMinor: 2150000,
      currency: "IRR",
      status: BusinessOfferStatus.ACTIVE,
    });

    expect(offer.id).toBe("off-partner-1");
    expect(offer.businessId).toBe("biz-tehran-tech");
    expect(offer.productId).toBe("prod-tshirt-1");

    // Unified audience
    expect(offer.audience.type).toBe("group");
    expect(offer.audience.group).toBe("partner");

    // Unified availability
    expect(offer.availability.isAvailable).toBe(true);
    expect(offer.availability.status).toBe("available");

    // Unified pricing
    expect(offer.pricing.amountMinor).toBe(2150000);
    expect(offer.pricing.currency).toBe("IRR");

    // Unified status
    expect(offer.status).toBe(BusinessOfferStatus.ACTIVE);

    // Purchasable evaluation
    expect(isBusinessOfferPurchasable(offer)).toBe(true);
  });

  it("marks product unpurchasable when availability is false", () => {
    const offer = createBusinessOffer({
      id: "off-agent-disabled",
      businessId: "biz-tehran-tech",
      productId: "prod-tshirt-1",
      customerGroup: "agent",
      isAvailable: false, // Agent cannot buy this product
      priceAmountMinor: 0,
      currency: "IRR",
    });

    expect(offer.availability.isAvailable).toBe(false);
    expect(offer.availability.status).toBe("unavailable");
    expect(offer.availability.message).toBe("این محصول در حال حاضر برای شما قابل خرید نیست.");
    expect(isBusinessOfferPurchasable(offer)).toBe(false);
  });

  it("supports customer-specific offer override", () => {
    const customerOffer = createBusinessOffer({
      id: "off-vip-customer-ali",
      businessId: "biz-tehran-tech",
      productId: "prod-tshirt-1",
      customerId: "cust-store-x",
      isAvailable: true,
      priceAmountMinor: 2000000, // Special price for Store X
      currency: "IRR",
    });

    expect(customerOffer.audience.type).toBe("customer");
    expect(customerOffer.audience.customerId).toBe("cust-store-x");
    expect(customerOffer.pricing.amountMinor).toBe(2000000);
    expect(isBusinessOfferPurchasable(customerOffer)).toBe(true);
  });

  it("supports variant-level offer overrides with temporal validity", () => {
    const variantOffer = createBusinessOffer({
      id: "off-tshirt-xl-white",
      businessId: "biz-tehran-tech",
      productId: "prod-tshirt-1",
      variantId: "var-xl-white",
      customerGroup: "consumer",
      isAvailable: true,
      priceAmountMinor: 2100000,
      currency: "IRR",
      validFrom: "2026-06-01T00:00:00Z",
      validTo: "2026-06-30T23:59:59Z",
    });

    expect(variantOffer.variantId).toBe("var-xl-white");
    expect(variantOffer.conditions?.validFrom).toBe("2026-06-01T00:00:00Z");
    expect(variantOffer.conditions?.validTo).toBe("2026-06-30T23:59:59Z");

    // Within validity window
    expect(isBusinessOfferPurchasable(variantOffer, "2026-06-15T12:00:00Z")).toBe(true);

    // After expiration window
    expect(isBusinessOfferPurchasable(variantOffer, "2026-07-01T00:00:00Z")).toBe(false);

    // Before start window
    expect(isBusinessOfferPurchasable(variantOffer, "2026-05-31T23:59:59Z")).toBe(false);
  });
});
