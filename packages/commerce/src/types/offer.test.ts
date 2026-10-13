import { describe, it, expect } from "vitest";
import { brandId } from "@qooqnos/core";
import { type Offer, validateOffer } from "./offer";

describe("Offer validation logic (validateOffer)", () => {
  const sampleOffer: Offer = {
    id: brandId<"EntityId">("off-1"),
    sellerId: brandId<"EntityId">("seller-1"),
    productId: brandId<"EntityId">("prod-1"),
    audience: { type: "general" },
    availabilityStatus: "available",
    available: true,
    priceAmountMinor: 100000,
    currency: "IRR",
    validFrom: "2026-01-01T00:00:00Z",
    validTo: "2026-12-31T23:59:59Z",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("validates an active offer within date range", () => {
    const res = validateOffer(sampleOffer, "2026-06-01T00:00:00Z");
    expect(res.isValid).toBe(true);
    expect(res.isPeriodActive).toBe(true);
    expect(res.isStatusActive).toBe(true);
    expect(res.isAvailable).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("fails validation when status is not ACTIVE (e.g. DRAFT or EXPIRED)", () => {
    const draftOffer: Offer = { ...sampleOffer, status: "DRAFT" };
    const resDraft = validateOffer(draftOffer, "2026-06-01T00:00:00Z");
    expect(resDraft.isValid).toBe(false);
    expect(resDraft.isStatusActive).toBe(false);

    const expiredOffer: Offer = { ...sampleOffer, status: "EXPIRED" };
    const resExpired = validateOffer(expiredOffer, "2026-06-01T00:00:00Z");
    expect(resExpired.isValid).toBe(false);
    expect(resExpired.isStatusActive).toBe(false);
  });

  it("fails validation when current time is outside validFrom and validTo", () => {
    // Before validFrom
    const resEarly = validateOffer(sampleOffer, "2025-12-31T23:59:59Z");
    expect(resEarly.isValid).toBe(false);
    expect(resEarly.isPeriodActive).toBe(false);

    // After validTo
    const resLate = validateOffer(sampleOffer, "2027-01-01T00:00:00Z");
    expect(resLate.isValid).toBe(false);
    expect(resLate.isPeriodActive).toBe(false);
  });

  it("fails validation when validTo is logically before validFrom", () => {
    const invalidRangeOffer: Offer = {
      ...sampleOffer,
      validFrom: "2026-12-31T00:00:00Z",
      validTo: "2026-01-01T00:00:00Z",
    };
    const res = validateOffer(invalidRangeOffer, "2026-06-01T00:00:00Z");
    expect(res.isValid).toBe(false);
    expect(res.isPeriodActive).toBe(false);
  });

  it("fails validation when marked unavailable", () => {
    const unavailableOffer: Offer = {
      ...sampleOffer,
      available: false,
      availabilityStatus: "unavailable",
    };
    const res = validateOffer(unavailableOffer, "2026-06-01T00:00:00Z");
    expect(res.isValid).toBe(false);
    expect(res.isAvailable).toBe(false);
  });
});
