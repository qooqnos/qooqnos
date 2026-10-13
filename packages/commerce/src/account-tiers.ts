/**
 * Phoenix 3-Tier Account Architecture & Advanced Pricing Engine
 * 
 * Rules:
 * 1. Single identity per person; higher tiers are additive capabilities.
 * 2. Tier 1 (Base): Profile, addresses, orders, invoices, wishlist, buying.
 * 3. Tier 2 (Seller): Store info, 4 offering types (physical, digital, service, variable),
 *    received orders, timed discounts, store-scoped buyer groups (مشتری عادی / مشتری ویژه).
 * 4. Tier 3 (Corporate Seller): Corporate verification (pending/approved/rejected),
 *    5 store-scoped buyer roles (مصرف‌کننده، مشتری ویژه، نماینده سطح ۱-۳),
 *    advanced pricing (role-based + quantity-tiered volume brackets).
 * 5. Terminology rule: Internal concepts only. Never use 'کاربر', 'حقیقی', or 'حقوقی' as UI labels.
 */

export type AccountTier = "base" | "seller" | "corporate_seller";

export type CorporateVerificationStatus = "none" | "pending_review" | "approved" | "rejected";

export type OfferingType = "physical" | "digital" | "service" | "variable";

/**
 * Store-scoped buyer roles:
 * Level 2 stores use: "regular" | "vip"
 * Level 3 corporate stores can use all 5 roles:
 * "consumer" | "vip" | "tier_1_agent" | "tier_2_agent" | "tier_3_agent"
 */
export type StoreBuyerRole =
  | "regular"
  | "consumer"
  | "vip"
  | "tier_1_agent"
  | "tier_2_agent"
  | "tier_3_agent";

export const STORE_BUYER_ROLES_LEVEL_2: readonly StoreBuyerRole[] = ["regular", "vip"];

export const STORE_BUYER_ROLES_LEVEL_3: readonly StoreBuyerRole[] = [
  "consumer",
  "vip",
  "tier_1_agent",
  "tier_2_agent",
  "tier_3_agent",
];

export const BUYER_ROLE_LABELS_FA: Readonly<Record<StoreBuyerRole, string>> = {
  regular: "مشتری عادی",
  consumer: "مصرف‌کننده",
  vip: "مشتری ویژه",
  tier_1_agent: "نماینده سطح ۱",
  tier_2_agent: "نماینده سطح ۲",
  tier_3_agent: "نماینده سطح ۳",
};

export interface VariableAttributeOption {
  readonly name: string;
  readonly options: readonly string[];
}

export interface TieredPriceBracket {
  readonly minQty: number;
  readonly maxQty?: number | null | undefined;
  readonly priceAmountMinor: number;
  readonly buyerRole?: StoreBuyerRole | null | undefined;
}

export interface TimedDiscount {
  readonly id: string;
  readonly sellerId: string;
  readonly productIds: readonly string[];
  readonly discountType: "percentage" | "fixed";
  readonly value: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly maxUses?: number | null | undefined;
  readonly usedCount: number;
  readonly minOrderAmount?: number | null | undefined;
}

export interface CustomerAddressItem {
  readonly id: string;
  readonly title: string;
  readonly streetLine1: string;
  readonly postalCode?: string | null | undefined;
  readonly city?: string | null | undefined;
  readonly province?: string | null | undefined;
  readonly isDefault?: boolean | undefined;
}

export interface CorporateProfile {
  readonly companyName: string;
  readonly registrationNumber: string;
  readonly economicCode?: string | null | undefined;
  readonly nationalId?: string | null | undefined;
  readonly documents?: readonly { type: string; url: string; name: string }[] | undefined;
  readonly rejectionReason?: string | null | undefined;
}

export interface PricingCalculationInput {
  readonly basePriceMinor: number;
  readonly quantity: number;
  readonly buyerRole?: StoreBuyerRole | string | null | undefined;
  readonly rolePrices?: Readonly<Record<string, number>> | null | undefined;
  readonly tieredPrices?: readonly TieredPriceBracket[] | null | undefined;
  readonly discounts?: readonly TimedDiscount[] | null | undefined;
  readonly productId?: string | undefined;
  readonly now?: string | undefined;
}

export interface PricingCalculationResult {
  readonly unitPriceMinor: number;
  readonly originalUnitPriceMinor: number;
  readonly discountMinorPerUnit: number;
  readonly appliedDiscountId?: string | null | undefined;
  readonly pricingRuleApplied: "role_tier" | "role_base" | "quantity_tier" | "timed_discount" | "base";
  readonly lineTotalMinor: number;
}

/**
 * Advanced Pricing Engine:
 * Combines Role-based pricing, Quantity-tiered brackets, and Timed discounts
 * with unambiguous precedence:
 * 1. Specific Role Tiered Bracket (if quantity falls in range and role matches)
 * 2. Role Base Price (if buyerRole has dedicated price)
 * 3. General Quantity Tiered Bracket (volume pricing for all buyers)
 * 4. Product Base Price
 * 5. Timed Discounts (percentage or fixed, active in date range & usage limits)
 *    applied cleanly to the selected effective price.
 */
export function calculateTieredAndRolePrice(input: PricingCalculationInput): PricingCalculationResult {
  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const basePrice = Math.max(0, input.basePriceMinor);
  const nowIso = input.now ?? new Date().toISOString();
  const buyerRole = (input.buyerRole ? String(input.buyerRole).trim() : null) as StoreBuyerRole | null;

  let effectiveUnitPrice = basePrice;
  let ruleApplied: PricingCalculationResult["pricingRuleApplied"] = "base";

  // 1. Role-specific tiered quantity bracket
  if (buyerRole && input.tieredPrices && input.tieredPrices.length > 0) {
    const roleTier = input.tieredPrices.find((bracket) => {
      if (bracket.buyerRole !== buyerRole) return false;
      const min = bracket.minQty;
      const max = bracket.maxQty ?? Infinity;
      return quantity >= min && quantity <= max;
    });
    if (roleTier) {
      effectiveUnitPrice = roleTier.priceAmountMinor;
      ruleApplied = "role_tier";
    }
  }

  // 2. Role base price
  if (ruleApplied === "base" && buyerRole && input.rolePrices) {
    if (buyerRole in input.rolePrices && typeof input.rolePrices[buyerRole] === "number") {
      effectiveUnitPrice = input.rolePrices[buyerRole]!;
      ruleApplied = "role_base";
    }
  }

  // 3. General quantity tiered bracket (all roles)
  if (ruleApplied === "base" && input.tieredPrices && input.tieredPrices.length > 0) {
    const generalTier = input.tieredPrices.find((bracket) => {
      if (bracket.buyerRole && bracket.buyerRole !== null) return false;
      const min = bracket.minQty;
      const max = bracket.maxQty ?? Infinity;
      return quantity >= min && quantity <= max;
    });
    if (generalTier) {
      effectiveUnitPrice = generalTier.priceAmountMinor;
      ruleApplied = "quantity_tier";
    }
  }

  const originalUnitPrice = effectiveUnitPrice;
  let finalUnitPrice = effectiveUnitPrice;
  let appliedDiscountId: string | null = null;
  let discountPerUnit = 0;

  // 4. Timed discounts evaluation
  if (input.discounts && input.discounts.length > 0) {
    for (const discount of input.discounts) {
      // Product association check
      if (
        discount.productIds.length > 0 &&
        input.productId &&
        !discount.productIds.includes(input.productId)
      ) {
        continue;
      }

      // Temporal validity check
      if (discount.startDate && nowIso < discount.startDate) continue;
      if (discount.endDate && nowIso > discount.endDate) continue;

      // Usage limits check
      if (
        typeof discount.maxUses === "number" &&
        discount.maxUses > 0 &&
        discount.usedCount >= discount.maxUses
      ) {
        continue;
      }

      // Min order amount check
      if (
        typeof discount.minOrderAmount === "number" &&
        effectiveUnitPrice * quantity < discount.minOrderAmount
      ) {
        continue;
      }

      // Calculate discount amount
      let candidateDiscount = 0;
      if (discount.discountType === "percentage") {
        const pct = Math.min(100, Math.max(0, discount.value));
        candidateDiscount = Math.round((effectiveUnitPrice * pct) / 100);
      } else {
        candidateDiscount = Math.min(effectiveUnitPrice, Math.max(0, discount.value));
      }

      if (candidateDiscount > discountPerUnit) {
        discountPerUnit = candidateDiscount;
        appliedDiscountId = discount.id;
      }
    }

    if (discountPerUnit > 0) {
      finalUnitPrice = Math.max(0, effectiveUnitPrice - discountPerUnit);
      if (ruleApplied === "base") {
        ruleApplied = "timed_discount";
      }
    }
  }

  return {
    unitPriceMinor: finalUnitPrice,
    originalUnitPriceMinor: originalUnitPrice,
    discountMinorPerUnit: discountPerUnit,
    appliedDiscountId,
    pricingRuleApplied: ruleApplied,
    lineTotalMinor: finalUnitPrice * quantity,
  };
}

/**
 * Access Control Helpers
 */
export function canAccessSellerFeatures(tier: AccountTier): boolean {
  return tier === "seller" || tier === "corporate_seller";
}

export function canAccessCorporateFeatures(
  tier: AccountTier,
  verificationStatus: CorporateVerificationStatus,
): boolean {
  return tier === "corporate_seller" && verificationStatus === "approved";
}

export function validateNationalCode(code: string): boolean {
  const clean = code.trim().replace(/\D/g, "");
  if (clean.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(clean[i]) * (10 - i);
  }
  const rem = sum % 11;
  const checkDigit = Number(clean[9]);
  return rem < 2 ? checkDigit === rem : checkDigit === 11 - rem;
}

export function validateCorporateUpgradeInput(input: Partial<CorporateProfile> | null | undefined): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!input) return { valid: false, errors: ["اطلاعات شرکتی الزامی است."] };

  if (!input.companyName || input.companyName.trim().length < 3) {
    errors.push("نام شرکت/کسب‌وکار باید حداقل ۳ نویسه باشد.");
  }
  if (!input.registrationNumber || input.registrationNumber.trim().length < 4) {
    errors.push("شماره ثبت الزامی است.");
  }

  return { valid: errors.length === 0, errors };
}
