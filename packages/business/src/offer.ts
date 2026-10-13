import type { EntityId } from "@qooqnos/core";

/**
 * Standard customer group classification
 * Reflects seller-scoped audience segments:
 * - consumer: مصرف‌کننده عمومی
 * - partner: همکار تجاری
 * - agent: نماینده فروش
 * - and extended segments (enterprise, distributor, etc.)
 */
export type BusinessCustomerGroup =
  | "consumer"
  | "partner"
  | "agent"
  | "special_partner"
  | "distributor"
  | "enterprise"
  | "wholesale"
  | "special_agent"
  | (string & {});

/**
 * Targeted Audience for an Offer:
 * Can target a specific customer, a customer group, or the general public.
 */
export type BusinessOfferAudienceType = "customer" | "group" | "general";

export interface BusinessOfferAudience {
  readonly type: BusinessOfferAudienceType;
  /** Specific customer ID (e.g. فروشگاه X) */
  readonly customerId?: EntityId | string | undefined;
  /** Specific customer group (e.g. همکار، نماینده) */
  readonly group?: BusinessCustomerGroup | undefined;
}

/**
 * Availability state:
 * Seamlessly pairs availability toggle with purchasing permission.
 * If available is false or status is "unavailable", the product is not purchasable for this audience.
 */
export type BusinessOfferAvailabilityStatus = "available" | "unavailable" | "restricted";

export interface BusinessOfferAvailability {
  /** Whether this customer group / customer is allowed to purchase this product */
  readonly isAvailable: boolean;
  /** Granular status descriptor */
  readonly status: BusinessOfferAvailabilityStatus;
  /** Optional minimum purchase quantity */
  readonly minQuantity?: number | undefined;
  /** Optional maximum purchase quantity */
  readonly maxQuantity?: number | undefined;
  /** Human-readable explanation if unavailable (e.g. "این محصول در حال حاضر برای شما قابل خرید نیست") */
  readonly message?: string | undefined;
}

/**
 * Pricing structure unified within the Offer:
 * Eliminates separate pricing engines; price is an inherent property of the Offer.
 */
export interface BusinessOfferPricing {
  /** Price in minor units (e.g. Rials) */
  readonly amountMinor: number;
  /** ISO 4217 Currency code (default: IRR) */
  readonly currency: string;
  /** Optional base / comparison price before discount */
  readonly originalAmountMinor?: number | undefined;
  /** Formatted price string helper (e.g. "۲,۱۵۰,۰۰۰ ریال") */
  readonly formattedPrice?: string | undefined;
}

/**
 * Lifecycle status of an Offer
 */
export enum BusinessOfferStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  EXPIRED = "EXPIRED",
  DRAFT = "DRAFT",
}

export type BusinessOfferStatusType =
  | BusinessOfferStatus
  | "ACTIVE"
  | "INACTIVE"
  | "EXPIRED"
  | "DRAFT"
  | "active"
  | "inactive"
  | "expired"
  | "draft";

/**
 * Additional conditions that may apply to the Offer
 */
export interface BusinessOfferConditions {
  /** Start time of temporal validity (ISO 8601) */
  readonly validFrom?: string | undefined;
  /** End time of temporal validity (ISO 8601) */
  readonly validTo?: string | undefined;
  /** Entitlement template ID for digital products */
  readonly digitalEntitlementId?: string | undefined;
  /** Custom rules or requirements */
  readonly customConditions?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Unified Offer Entity:
 * Integrates Product, Variant, CustomerGroup, Pricing, and Availability
 * as a single commercial decision unit.
 *
 * "Offer = Audience + Availability + Price + Conditions"
 */
export interface BusinessOffer {
  readonly id: EntityId | string;
  readonly organizationId?: EntityId | string | undefined;
  readonly workspaceId?: EntityId | string | undefined;
  /** The seller / business scope owning this offer */
  readonly businessId: EntityId | string;
  /** Targeted product canonical ID */
  readonly productId: EntityId | string;
  /** Optional product variant canonical ID (if variant override) */
  readonly variantId?: EntityId | string | undefined;
  /** Targeted audience (customer, group, or general) */
  readonly audience: BusinessOfferAudience;
  /** Unified availability: whether the audience is allowed to purchase */
  readonly availability: BusinessOfferAvailability;
  /** Unified pricing: price amount and currency for this audience */
  readonly pricing: BusinessOfferPricing;
  /** Optional commercial conditions (dates, digital entitlement, quantities) */
  readonly conditions?: BusinessOfferConditions | undefined;
  /** Lifecycle status */
  readonly status: BusinessOfferStatusType;
  /** Created timestamp (ISO 8601) */
  readonly createdAt: string;
  /** Updated timestamp (ISO 8601) */
  readonly updatedAt: string;
}

/**
 * Helper to create a unified BusinessOffer entity
 */
export function createBusinessOffer(params: {
  readonly id: EntityId | string;
  readonly businessId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly customerGroup?: BusinessCustomerGroup | undefined;
  readonly customerId?: EntityId | string | undefined;
  readonly isAvailable: boolean;
  readonly priceAmountMinor: number;
  readonly currency?: string | undefined;
  readonly status?: BusinessOfferStatusType | undefined;
  readonly validFrom?: string | undefined;
  readonly validTo?: string | undefined;
  readonly digitalEntitlementId?: string | undefined;
  readonly minQuantity?: number | undefined;
  readonly maxQuantity?: number | undefined;
  readonly now?: string | undefined;
}): BusinessOffer {
  const timestamp = params.now ?? new Date().toISOString();

  let audience: BusinessOfferAudience;
  if (params.customerId) {
    audience = { type: "customer", customerId: params.customerId };
  } else if (params.customerGroup && params.customerGroup !== "consumer") {
    audience = { type: "group", group: params.customerGroup };
  } else {
    audience = { type: "general", group: "consumer" };
  }

  const availability: BusinessOfferAvailability = {
    isAvailable: params.isAvailable,
    status: params.isAvailable ? "available" : "unavailable",
    ...(params.minQuantity !== undefined ? { minQuantity: params.minQuantity } : {}),
    ...(params.maxQuantity !== undefined ? { maxQuantity: params.maxQuantity } : {}),
    ...(!params.isAvailable
      ? { message: "این محصول در حال حاضر برای شما قابل خرید نیست." }
      : {}),
  };

  const pricing: BusinessOfferPricing = {
    amountMinor: Math.floor(Math.max(0, params.priceAmountMinor)),
    currency: params.currency?.toUpperCase() || "IRR",
  };

  const conditions: BusinessOfferConditions = {
    ...(params.validFrom ? { validFrom: params.validFrom } : {}),
    ...(params.validTo ? { validTo: params.validTo } : {}),
    ...(params.digitalEntitlementId ? { digitalEntitlementId: params.digitalEntitlementId } : {}),
  };

  return {
    id: params.id,
    businessId: params.businessId,
    productId: params.productId,
    ...(params.variantId ? { variantId: params.variantId } : {}),
    audience,
    availability,
    pricing,
    conditions,
    status: params.status ?? BusinessOfferStatus.ACTIVE,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Evaluates whether a BusinessOffer is currently valid and active for purchasing
 */
export function isBusinessOfferPurchasable(offer: BusinessOffer, asOf?: string): boolean {
  // 1. Must be active status
  const normalizedStatus = String(offer.status).toUpperCase();
  if (normalizedStatus !== BusinessOfferStatus.ACTIVE && normalizedStatus !== "ACTIVE") {
    return false;
  }

  // 2. Availability must be true
  if (!offer.availability.isAvailable || offer.availability.status !== "available") {
    return false;
  }

  // 3. Temporal validity check
  const checkTime = asOf ? Date.parse(asOf) : Date.now();
  if (offer.conditions?.validFrom) {
    const fromTime = Date.parse(offer.conditions.validFrom);
    if (!Number.isNaN(fromTime) && checkTime < fromTime) {
      return false;
    }
  }

  if (offer.conditions?.validTo) {
    const toTime = Date.parse(offer.conditions.validTo);
    if (!Number.isNaN(toTime) && checkTime >= toTime) {
      return false;
    }
  }

  return true;
}
