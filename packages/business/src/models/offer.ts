import type { EntityId } from "@qooqnos/core";

/**
 * Standard customer group classification
 * Reflects seller-scoped audience segments:
 * - consumer: مصرف‌کننده عمومی
 * - partner: همکار تجاری
 * - agent: نماینده فروش
 * - and extended segments (special_partner, enterprise, distributor, etc.)
 */
export type CustomerGroup =
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
 * Product reference in the Offer
 */
export interface OfferProductRef {
  /** Canonical ID of the product */
  readonly id: EntityId | string;
  /** Optional variant ID if this offer targets or overrides a specific variant */
  readonly variantId?: EntityId | string | undefined;
  /** Optional SKU or product title reference */
  readonly name?: string | undefined;
  readonly sku?: string | undefined;
}

/**
 * Audience targeting type:
 * Can target a specific individual customer, a customer group, or the general public.
 */
export type OfferAudienceType = "customer" | "group" | "general";

export interface OfferAudience {
  readonly type: OfferAudienceType;
  /** Specific customer ID when type === "customer" (e.g. فروشگاه X) */
  readonly customerId?: EntityId | string | undefined;
  /** Specific customer group when type === "group" (e.g. همکار، نماینده) */
  readonly group?: CustomerGroup | undefined;
}

/**
 * Availability state descriptor:
 * Seamlessly pairs availability toggle with purchasing permission.
 * If available is false or status is "unavailable", the product is not purchasable for this audience.
 */
export type OfferAvailabilityStatus = "available" | "unavailable" | "restricted";

export interface OfferAvailability {
  /** Whether this customer group / customer is allowed to purchase this product (عرضه: ✓ / —) */
  readonly isAvailable: boolean;
  /** Granular status descriptor */
  readonly status: OfferAvailabilityStatus;
  /** Optional minimum purchase quantity */
  readonly minQuantity?: number | undefined;
  /** Optional maximum purchase quantity */
  readonly maxQuantity?: number | undefined;
  /** Standard customer-facing message when unavailable */
  readonly message?: string | undefined;
}

/**
 * Pricing structure unified within the Offer:
 * Eliminates separate pricing engines; price is an inherent property of the Offer.
 */
export interface OfferPricing {
  /** Price in minor units (e.g. Rials) */
  readonly amountMinor: number;
  /** ISO 4217 Currency code (default: IRR) */
  readonly currency: string;
  /** Optional base / comparison price before discount */
  readonly originalAmountMinor?: number | undefined;
  /** Formatted price string helper */
  readonly formattedPrice?: string | undefined;
}

/**
 * Lifecycle status of an Offer
 */
export enum OfferStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  EXPIRED = "EXPIRED",
  DRAFT = "DRAFT",
}

export type OfferStatusType =
  | OfferStatus
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
export interface OfferConditions {
  /** Start time of temporal validity (ISO 8601) */
  readonly validFrom?: string | undefined;
  /** End time of temporal validity (ISO 8601) */
  readonly validTo?: string | undefined;
  /** Entitlement template ID for digital products (granted upon purchase) */
  readonly digitalEntitlementId?: string | undefined;
  /** Custom business conditions / attributes */
  readonly customConditions?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Unified Commercial Entity: Offer
 *
 * Acting as the Single Source of Truth for both access and pricing resolution
 * as specified in the architecture document:
 *
 * "Offer = Audience + Availability + Price + Conditions"
 */
export interface Offer {
  readonly id: EntityId | string;
  readonly organizationId?: EntityId | string | undefined;
  readonly workspaceId?: EntityId | string | undefined;
  /** The seller / business scope owning this offer */
  readonly businessId: EntityId | string;

  /**
   * Product property:
   * Unified representation of targeted product (and optional variant)
   */
  readonly product: OfferProductRef;

  /** Targeted product canonical ID (shortcut) */
  readonly productId: EntityId | string;
  /** Optional product variant canonical ID (shortcut) */
  readonly variantId?: EntityId | string | undefined;

  /**
   * CustomerGroup property:
   * Customer group audience targeting
   */
  readonly customerGroup?: CustomerGroup | undefined;

  /** Full audience details (supports group, customer, or general) */
  readonly audience: OfferAudience;

  /**
   * Availability property:
   * Unified purchase eligibility and availability indicator (عرضه: ✓ / —)
   */
  readonly availability: OfferAvailability;

  /**
   * Price property:
   * Unified cost resolution structure
   */
  readonly price: OfferPricing;
  /** Pricing alias for backwards compatibility */
  readonly pricing: OfferPricing;

  /**
   * Conditions property (optional):
   * Commercial conditions (dates, digital entitlement, quantities)
   */
  readonly conditions?: OfferConditions | undefined;

  /** Lifecycle status */
  readonly status: OfferStatusType;
  /** Created timestamp (ISO 8601) */
  readonly createdAt: string;
  /** Updated timestamp (ISO 8601) */
  readonly updatedAt: string;
}

/**
 * Factory parameters to construct an Offer instance
 */
export interface CreateOfferParams {
  readonly id: EntityId | string;
  readonly businessId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly productName?: string | undefined;
  readonly customerGroup?: CustomerGroup | undefined;
  readonly customerId?: EntityId | string | undefined;
  readonly isAvailable: boolean;
  readonly priceAmountMinor: number;
  readonly currency?: string | undefined;
  readonly status?: OfferStatusType | undefined;
  readonly validFrom?: string | undefined;
  readonly validTo?: string | undefined;
  readonly digitalEntitlementId?: string | undefined;
  readonly minQuantity?: number | undefined;
  readonly maxQuantity?: number | undefined;
  readonly conditions?: OfferConditions | undefined;
  readonly now?: string | undefined;
}

/**
 * Helper to instantiate a valid unified Offer entity
 */
export function createOffer(params: CreateOfferParams): Offer {
  const timestamp = params.now ?? new Date().toISOString();

  let audience: OfferAudience;
  if (params.customerId) {
    audience = { type: "customer", customerId: params.customerId };
  } else if (params.customerGroup && params.customerGroup !== "consumer") {
    audience = { type: "group", group: params.customerGroup };
  } else {
    audience = { type: "general", group: params.customerGroup ?? "consumer" };
  }

  const availability: OfferAvailability = {
    isAvailable: params.isAvailable,
    status: params.isAvailable ? "available" : "unavailable",
    ...(params.minQuantity !== undefined ? { minQuantity: params.minQuantity } : {}),
    ...(params.maxQuantity !== undefined ? { maxQuantity: params.maxQuantity } : {}),
    ...(!params.isAvailable
      ? { message: "این محصول در حال حاضر برای شما قابل خرید نیست." }
      : {}),
  };

  const price: OfferPricing = {
    amountMinor: Math.floor(Math.max(0, params.priceAmountMinor)),
    currency: params.currency?.toUpperCase() || "IRR",
  };

  const conditions: OfferConditions = params.conditions ?? {
    ...(params.validFrom ? { validFrom: params.validFrom } : {}),
    ...(params.validTo ? { validTo: params.validTo } : {}),
    ...(params.digitalEntitlementId ? { digitalEntitlementId: params.digitalEntitlementId } : {}),
  };

  const product: OfferProductRef = {
    id: params.productId,
    ...(params.variantId ? { variantId: params.variantId } : {}),
    ...(params.productName ? { name: params.productName } : {}),
  };

  return {
    id: params.id,
    businessId: params.businessId,
    product,
    productId: params.productId,
    ...(params.variantId ? { variantId: params.variantId } : {}),
    customerGroup: params.customerGroup ?? (audience.type === "group" ? audience.group : undefined),
    audience,
    availability,
    price,
    pricing: price,
    conditions,
    status: params.status ?? OfferStatus.ACTIVE,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Unified Purchase Eligibility & Cost Resolver Helper:
 * Evaluates whether an Offer is currently valid and purchasable for the given audience context.
 */
export function isOfferPurchasable(offer: Offer, asOf?: string): boolean {
  // 1. Must be in ACTIVE status
  const normalizedStatus = String(offer.status).toUpperCase();
  if (normalizedStatus !== OfferStatus.ACTIVE && normalizedStatus !== "ACTIVE") {
    return false;
  }

  // 2. Availability must be enabled
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
