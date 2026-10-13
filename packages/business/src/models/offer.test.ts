import { describe, it, expect } from "vitest";
import {
  createOffer,
  isOfferPurchasable,
  OfferStatus,
  type Offer,
} from "./offer";

describe("Offer Model at packages/business/src/models/offer.ts", () => {
  it("encapsulates product, customerGroup, price, availability, and optional conditions as a single source of truth", () => {
    const offer: Offer = createOffer({
      id: "off-partner-tehran",
      businessId: "biz-tehran-tech",
      productId: "prod-tshirt-pro",
      productName: "تیشرت تخصصی ققنوس",
      customerGroup: "partner",
      isAvailable: true,
      priceAmountMinor: 2150000,
      currency: "IRR",
      status: OfferStatus.ACTIVE,
      validFrom: "2026-01-01T00:00:00Z",
      validTo: "2026-12-31T23:59:59Z",
      digitalEntitlementId: "ent-book-access",
    });

    expect(offer.id).toBe("off-partner-tehran");
    expect(offer.businessId).toBe("biz-tehran-tech");

    // 1. product property
    expect(offer.product.id).toBe("prod-tshirt-pro");
    expect(offer.product.name).toBe("تیشرت تخصصی ققنوس");
    expect(offer.productId).toBe("prod-tshirt-pro");

    // 2. customerGroup property
    expect(offer.customerGroup).toBe("partner");
    expect(offer.audience.type).toBe("group");
    expect(offer.audience.group).toBe("partner");

    // 3. price property
    expect(offer.price.amountMinor).toBe(2150000);
    expect(offer.price.currency).toBe("IRR");
    expect(offer.pricing.amountMinor).toBe(2150000);

    // 4. availability property
    expect(offer.availability.isAvailable).toBe(true);
    expect(offer.availability.status).toBe("available");

    // 5. optional conditions property
    expect(offer.conditions?.validFrom).toBe("2026-01-01T00:00:00Z");
    expect(offer.conditions?.validTo).toBe("2026-12-31T23:59:59Z");
    expect(offer.conditions?.digitalEntitlementId).toBe("ent-book-access");

    // Unified purchase eligibility & cost resolution check
    expect(isOfferPurchasable(offer)).toBe(true);
  });

  it("denies purchase eligibility when availability is false and returns friendly message", () => {
    const disabledOffer: Offer = createOffer({
      id: "off-agent-disabled",
      businessId: "biz-tehran-tech",
      productId: "prod-tshirt-pro",
      customerGroup: "agent",
      isAvailable: false,
      priceAmountMinor: 0,
    });

    expect(disabledOffer.availability.isAvailable).toBe(false);
    expect(disabledOffer.availability.status).toBe("unavailable");
    expect(disabledOffer.availability.message).toBe("این محصول در حال حاضر برای شما قابل خرید نیست.");
    expect(isOfferPurchasable(disabledOffer)).toBe(false);
  });

  it("handles customer-specific offer pricing over group", () => {
    const customerOffer: Offer = createOffer({
      id: "off-custom-store-x",
      businessId: "biz-tehran-tech",
      productId: "prod-tshirt-pro",
      customerId: "cust-store-x",
      isAvailable: true,
      priceAmountMinor: 2000000,
    });

    expect(customerOffer.audience.type).toBe("customer");
    expect(customerOffer.audience.customerId).toBe("cust-store-x");
    expect(customerOffer.price.amountMinor).toBe(2000000);
    expect(isOfferPurchasable(customerOffer)).toBe(true);
  });
});
