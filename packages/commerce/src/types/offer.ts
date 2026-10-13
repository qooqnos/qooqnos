import type { EntityId } from "@qooqnos/core";

/**
 * Standard customer group classification
 */
export type CustomerGroup =
  | "consumer" // مصرف‌کننده
  | "partner" // همکار
  | "agent" // نماینده
  | "special_partner" // همکار ویژه
  | "distributor" // پخش‌کننده
  | "enterprise" // سازمانی
  | "wholesale" // عمده‌خریدار
  | "special_agent" // نماینده ویژه
  | (string & {});

/**
 * Audience targeting types
 */
export type OfferAudienceType = "customer" | "group" | "general";

/**
 * Offer Audience structure
 */
export interface OfferAudience {
  readonly type: OfferAudienceType;
  /** Customer ID when type === "customer" */
  readonly customerId?: EntityId | undefined;
  /** Customer group when type === "group" */
  readonly group?: CustomerGroup | undefined;
}

/**
 * Availability status indicators
 */
export type OfferAvailabilityStatus = "available" | "unavailable" | "restricted";

/**
 * Offer lifecycle status enum
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
  | "draft"
  | "archived";

/**
 * Conditional restrictions for commercial offers
 */
export interface OfferConditions {
  readonly minQuantity?: number | undefined;
  readonly maxQuantity?: number | undefined;
  readonly effectiveFrom?: string | undefined;
  readonly effectiveTo?: string | undefined;
  readonly digitalEntitlementId?: string | undefined;
  readonly paymentMethodsAllowed?: readonly string[] | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly customMetadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Unified Commercial Offer Model
 * Consolidates:
 * - ID
 * - product/variant association
 * - customer group & audience
 * - availability status
 * - price (minor units & currency)
 * - validFrom and validTo active date range
 * - OfferStatus enum (ACTIVE, INACTIVE, EXPIRED, DRAFT)
 * - conditions & timestamps
 */
export interface Offer {
  readonly id: EntityId;
  readonly organizationId?: EntityId | undefined;
  readonly workspaceId?: EntityId | undefined;
  
  // Merchant / Seller
  readonly sellerId: EntityId;

  // Product / Variant Association
  readonly productId: EntityId;
  readonly variantId?: EntityId | undefined;

  // Customer Group & Audience Targeting
  readonly customerGroup?: CustomerGroup | undefined;
  readonly audience: OfferAudience;

  // Availability Status
  readonly availabilityStatus: OfferAvailabilityStatus;
  readonly available: boolean;

  // Price
  readonly priceAmountMinor: number;
  readonly currency: string;

  // Active Period Date Range
  readonly validFrom?: string | undefined;
  readonly validTo?: string | undefined;

  // Conditions & Constraints
  readonly conditions?: OfferConditions | undefined;

  // Offer Status Enum
  readonly status: OfferStatus | OfferStatusType;

  // Audit Timestamps
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfferValidationResult {
  readonly isValid: boolean;
  readonly isPeriodActive: boolean;
  readonly isStatusActive: boolean;
  readonly isAvailable: boolean;
  readonly errors: readonly string[];
}

/**
 * Validation logic helper for an Offer:
 * - Checks status is ACTIVE
 * - Checks available is true
 * - Validates date range: validFrom <= asOf < validTo
 * - Validates logical range: validTo > validFrom
 */
export function validateOffer(offer: Offer, asOfIso: string = new Date().toISOString()): OfferValidationResult {
  const errors: string[] = [];
  const normalizedStatus = String(offer.status).toUpperCase();
  const isStatusActive = normalizedStatus === OfferStatus.ACTIVE;

  if (!isStatusActive) {
    errors.push("Offer status is " + offer.status + ", expected ACTIVE");
  }

  const isAvailable = offer.available && offer.availabilityStatus !== "unavailable";
  if (!isAvailable) {
    errors.push("Offer is marked unavailable");
  }

  let isPeriodActive = true;
  const from = offer.validFrom ?? offer.conditions?.effectiveFrom;
  const to = offer.validTo ?? offer.conditions?.effectiveTo;

  if (from && to && from >= to) {
    errors.push("Invalid date range: validTo must be strictly after validFrom");
    isPeriodActive = false;
  }

  if (from && from > asOfIso) {
    errors.push("Offer active period has not started yet (validFrom: " + from + ", current: " + asOfIso + ")");
    isPeriodActive = false;
  }

  if (to && to <= asOfIso) {
    errors.push("Offer active period has expired (validTo: " + to + ", current: " + asOfIso + ")");
    isPeriodActive = false;
  }

  return {
    isValid: errors.length === 0,
    isPeriodActive,
    isStatusActive,
    isAvailable,
    errors,
  };
}
