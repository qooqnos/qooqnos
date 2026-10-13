import { describe, it, expect } from "vitest";
import {
  calculateTieredAndRolePrice,
  canAccessSellerFeatures,
  canAccessCorporateFeatures,
  validateNationalCode,
  validateCorporateUpgradeInput,
  type TimedDiscount,
  type TieredPriceBracket,
} from "./account-tiers";

describe("Phoenix 3-Tier Account & Pricing Engine (packages/commerce)", () => {
  const basePrice = 100000;

  it("calculates base price when no special rules exist", () => {
    const result = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 1,
    });
    expect(result.unitPriceMinor).toBe(100000);
    expect(result.lineTotalMinor).toBe(100000);
    expect(result.pricingRuleApplied).toBe("base");
    expect(result.discountMinorPerUnit).toBe(0);
  });

  it("applies role base pricing when buyer has a role", () => {
    const rolePrices = {
      vip: 90000,
      tier_1_agent: 80000,
      tier_2_agent: 70000,
      tier_3_agent: 60000,
    };

    const vipResult = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 2,
      buyerRole: "vip",
      rolePrices,
    });
    expect(vipResult.unitPriceMinor).toBe(90000);
    expect(vipResult.lineTotalMinor).toBe(180000);
    expect(vipResult.pricingRuleApplied).toBe("role_base");

    const agentResult = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 3,
      buyerRole: "tier_2_agent",
      rolePrices,
    });
    expect(agentResult.unitPriceMinor).toBe(70000);
    expect(agentResult.lineTotalMinor).toBe(210000);
    expect(agentResult.pricingRuleApplied).toBe("role_base");

    // Fallback to base price if role has no custom price
    const consumerResult = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 1,
      buyerRole: "consumer",
      rolePrices,
    });
    expect(consumerResult.unitPriceMinor).toBe(100000);
    expect(consumerResult.pricingRuleApplied).toBe("base");
  });

  it("applies general quantity-tiered volume pricing", () => {
    const tieredPrices: TieredPriceBracket[] = [
      { minQty: 1, maxQty: 4, priceAmountMinor: 100000 },
      { minQty: 5, maxQty: 19, priceAmountMinor: 85000 },
      { minQty: 20, maxQty: null, priceAmountMinor: 75000 },
    ];

    const qty3 = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 3,
      tieredPrices,
    });
    expect(qty3.unitPriceMinor).toBe(100000);
    expect(qty3.lineTotalMinor).toBe(300000);

    const qty10 = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 10,
      tieredPrices,
    });
    expect(qty10.unitPriceMinor).toBe(85000);
    expect(qty10.lineTotalMinor).toBe(850000);
    expect(qty10.pricingRuleApplied).toBe("quantity_tier");

    const qty50 = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 50,
      tieredPrices,
    });
    expect(qty50.unitPriceMinor).toBe(75000);
    expect(qty50.lineTotalMinor).toBe(3750000);
    expect(qty50.pricingRuleApplied).toBe("quantity_tier");
  });

  it("prioritizes role-specific quantity tiers over general quantity tiers and role base", () => {
    const tieredPrices: TieredPriceBracket[] = [
      { minQty: 10, maxQty: 50, priceAmountMinor: 80000 }, // general
      { minQty: 10, maxQty: 50, priceAmountMinor: 65000, buyerRole: "tier_1_agent" }, // role specific
    ];
    const rolePrices = {
      tier_1_agent: 88000,
    };

    const result = calculateTieredAndRolePrice({
      basePriceMinor: basePrice,
      quantity: 15,
      buyerRole: "tier_1_agent",
      rolePrices,
      tieredPrices,
    });
    expect(result.unitPriceMinor).toBe(65000);
    expect(result.pricingRuleApplied).toBe("role_tier");
  });

  it("applies timed discount properly and obeys active date range and usage limits", () => {
    const now = "2026-10-12T12:00:00Z";
    const discountActivePct: TimedDiscount = {
      id: "disc-1",
      sellerId: "seller-1",
      productIds: ["prod-1"],
      discountType: "percentage",
      value: 20, // 20% off
      startDate: "2026-10-01T00:00:00Z",
      endDate: "2026-10-20T00:00:00Z",
      usedCount: 5,
      maxUses: 100,
    };

    const res = calculateTieredAndRolePrice({
      basePriceMinor: 100000,
      quantity: 2,
      productId: "prod-1",
      discounts: [discountActivePct],
      now,
    });
    expect(res.unitPriceMinor).toBe(80000); // 100000 - 20000
    expect(res.discountMinorPerUnit).toBe(20000);
    expect(res.lineTotalMinor).toBe(160000);
    expect(res.appliedDiscountId).toBe("disc-1");

    // Outside date range test
    const expiredDiscount: TimedDiscount = {
      ...discountActivePct,
      endDate: "2026-10-10T00:00:00Z",
    };
    const resExpired = calculateTieredAndRolePrice({
      basePriceMinor: 100000,
      quantity: 1,
      productId: "prod-1",
      discounts: [expiredDiscount],
      now,
    });
    expect(resExpired.unitPriceMinor).toBe(100000);
    expect(resExpired.discountMinorPerUnit).toBe(0);

    // Max uses exhausted test
    const exhaustedDiscount: TimedDiscount = {
      ...discountActivePct,
      usedCount: 50,
      maxUses: 50,
    };
    const resExhausted = calculateTieredAndRolePrice({
      basePriceMinor: 100000,
      quantity: 1,
      productId: "prod-1",
      discounts: [exhaustedDiscount],
      now,
    });
    expect(resExhausted.unitPriceMinor).toBe(100000);
  });

  it("enforces access control checks for seller and corporate tiers", () => {
    // Level 1: Base
    expect(canAccessSellerFeatures("base")).toBe(false);
    expect(canAccessCorporateFeatures("base", "none")).toBe(false);

    // Level 2: Seller
    expect(canAccessSellerFeatures("seller")).toBe(true);
    expect(canAccessCorporateFeatures("seller", "none")).toBe(false);

    // Level 3: Corporate Seller
    expect(canAccessSellerFeatures("corporate_seller")).toBe(true);
    expect(canAccessCorporateFeatures("corporate_seller", "pending_review")).toBe(false);
    expect(canAccessCorporateFeatures("corporate_seller", "rejected")).toBe(false);
    expect(canAccessCorporateFeatures("corporate_seller", "approved")).toBe(true);
  });

  it("validates national codes and corporate upgrade inputs", () => {
    // Valid national code algorithm test
    expect(validateNationalCode("0080000001")).toBe(false); // invalid check
    expect(validateNationalCode("1111111111")).toBe(false); // repeated digits
    expect(validateNationalCode("123")).toBe(false);

    // Corporate validation
    const invalidUpgrade = validateCorporateUpgradeInput({});
    expect(invalidUpgrade.valid).toBe(false);
    expect(invalidUpgrade.errors.length).toBeGreaterThan(0);

    const validUpgrade = validateCorporateUpgradeInput({
      companyName: "شرکت فناوری اطلاعات ققنوس",
      registrationNumber: "543210",
    });
    expect(validUpgrade.valid).toBe(true);
    expect(validUpgrade.errors.length).toBe(0);
  });
});
