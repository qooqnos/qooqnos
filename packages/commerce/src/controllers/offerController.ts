import { AppError, brandId, type EntityId, type RequestContext } from "@qooqnos/core";
import type { CommerceRepository, CommerceOfferRow } from "../repository";
import {
  CustomerGroup,
  Offer,
  OfferAudience,
  OfferAudienceType,
  OfferAvailabilityStatus,
  OfferStatus,
} from "../types/offer";

export interface CreateOfferPayload {
  readonly sellerId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly customerGroup?: CustomerGroup | undefined;
  readonly customerId?: EntityId | string | undefined;
  readonly audienceType?: OfferAudienceType | undefined;
  readonly priceAmountMinor: number;
  readonly currency?: string | undefined;
  readonly available?: boolean | undefined;
  readonly availabilityStatus?: OfferAvailabilityStatus | undefined;
  readonly validFrom?: string | undefined;
  readonly validTo?: string | undefined;
  readonly minQuantity?: number | undefined;
  readonly maxQuantity?: number | undefined;
  readonly digitalEntitlementId?: string | undefined;
  readonly status?: OfferStatus | string | undefined;
}

export interface UpdateOfferPayload {
  readonly priceAmountMinor?: number | undefined;
  readonly currency?: string | undefined;
  readonly available?: boolean | undefined;
  readonly availabilityStatus?: OfferAvailabilityStatus | undefined;
  readonly validFrom?: string | undefined;
  readonly validTo?: string | undefined;
  readonly minQuantity?: number | undefined;
  readonly maxQuantity?: number | undefined;
  readonly status?: OfferStatus | string | undefined;
}

export interface DisableOfferPayload {
  readonly reason?: string | undefined;
  readonly setInactiveStatus?: boolean | undefined; // When true, also sets status to INACTIVE, otherwise available=false
}

export interface OfferControllerDependencies {
  readonly repository: CommerceRepository;
  readonly idGenerator?: (() => EntityId) | undefined;
  readonly now?: (() => string) | undefined;
}

const VALID_STATUSES: readonly string[] = [
  OfferStatus.ACTIVE,
  OfferStatus.INACTIVE,
  OfferStatus.EXPIRED,
  OfferStatus.DRAFT,
];

function validateOfferStatus(status: unknown, requestId: RequestContext["requestId"]): OfferStatus {
  if (typeof status !== "string") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Offer status must be a string.",
      requestId,
    });
  }

  const normalized = status.trim().toUpperCase();
  if (!VALID_STATUSES.includes(normalized)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: `Invalid offer status: "${status}". Allowed statuses are: ${VALID_STATUSES.join(", ")}.`,
      requestId,
    });
  }

  return normalized as OfferStatus;
}

function mapRowToOffer(row: CommerceOfferRow): Offer {
  let audience: OfferAudience;
  if (row.audience_type === "customer" && row.customer_id) {
    audience = { type: "customer", customerId: row.customer_id as EntityId };
  } else if (row.audience_type === "group" && row.customer_group) {
    audience = { type: "group", group: row.customer_group as CustomerGroup };
  } else {
    audience = { type: "general" };
  }

  return {
    id: brandId<"EntityId">(String(row.id)),
    organizationId: row.organization_id ? brandId<"EntityId">(String(row.organization_id)) : undefined,
    workspaceId: row.workspace_id ? brandId<"EntityId">(String(row.workspace_id)) : undefined,
    sellerId: brandId<"EntityId">(String(row.seller_id)),
    productId: brandId<"EntityId">(String(row.product_id)),
    variantId: row.variant_id ? brandId<"EntityId">(String(row.variant_id)) : undefined,
    customerGroup: (row.customer_group as CustomerGroup) || undefined,
    audience,
    availabilityStatus: row.available ? "available" : "unavailable",
    available: Boolean(row.available),
    priceAmountMinor: Number(row.price_amount_minor),
    currency: String(row.currency || "IRR"),
    validFrom: row.valid_from ?? row.effective_from ?? undefined,
    validTo: row.valid_to ?? row.effective_to ?? undefined,
    status: (row.status as OfferStatus) || OfferStatus.ACTIVE,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Controller exposing Offer lifecycle operations:
 * - createOffer
 * - updateOffer
 * - disableOffer
 * - getOffer
 */
export class OfferController {
  constructor(private readonly deps: OfferControllerDependencies) {}

  private now(): string {
    return this.deps.now ? this.deps.now() : new Date().toISOString();
  }

  private generateId(): EntityId {
    return this.deps.idGenerator
      ? this.deps.idGenerator()
      : brandId<"EntityId">("off-" + Math.random().toString(36).substring(2, 11));
  }

  /**
   * Creates a new Offer record with validated status, dates, and audience targeting.
   */
  async createOffer(context: RequestContext, payload: CreateOfferPayload): Promise<Offer> {
    const timestamp = this.now();

    if (!payload.sellerId) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "sellerId is required to create an offer.",
        requestId: context.requestId,
      });
    }

    if (!payload.productId) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "productId is required to create an offer.",
        requestId: context.requestId,
      });
    }

    if (payload.priceAmountMinor === undefined || payload.priceAmountMinor === null || payload.priceAmountMinor < 0) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "priceAmountMinor must be a non-negative integer.",
        requestId: context.requestId,
      });
    }

    // Validate Status
    const status = payload.status
      ? validateOfferStatus(payload.status, context.requestId)
      : OfferStatus.ACTIVE;

    // Determine audience type
    let audienceType: OfferAudienceType = payload.audienceType ?? "general";
    if (payload.customerId) {
      audienceType = "customer";
    } else if (payload.customerGroup && payload.customerGroup !== "consumer") {
      audienceType = "group";
    }

    // Date range validation
    if (payload.validFrom && payload.validTo && payload.validFrom >= payload.validTo) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "validTo timestamp must be strictly after validFrom timestamp.",
        requestId: context.requestId,
      });
    }

    const available = payload.available !== undefined ? (payload.available ? 1 : 0) : 1;
    const offerId = this.generateId();

    const row: CommerceOfferRow = {
      id: offerId,
      organization_id: (context.tenantId ?? "tenant-default") as EntityId,
      workspace_id: (context.workspaceId ?? "ws-default") as EntityId,
      seller_id: brandId<"EntityId">(String(payload.sellerId)),
      product_id: brandId<"EntityId">(String(payload.productId)),
      variant_id: payload.variantId ? brandId<"EntityId">(String(payload.variantId)) : null,
      audience_type: audienceType,
      customer_group: payload.customerGroup ?? null,
      customer_id: payload.customerId ? brandId<"EntityId">(String(payload.customerId)) : null,
      available,
      price_amount_minor: Math.floor(payload.priceAmountMinor),
      currency: payload.currency?.toUpperCase() || "IRR",
      min_quantity: payload.minQuantity ?? null,
      max_quantity: payload.maxQuantity ?? null,
      effective_from: payload.validFrom ?? null,
      effective_to: payload.validTo ?? null,
      valid_from: payload.validFrom ?? null,
      valid_to: payload.validTo ?? null,
      digital_entitlement_id: payload.digitalEntitlementId ?? null,
      conditions_json: null,
      status,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const inserted = await this.deps.repository.insertOffer(context, row);
    return mapRowToOffer(inserted);
  }

  /**
   * Updates an existing Offer record with validation on status and fields.
   */
  async updateOffer(
    context: RequestContext,
    offerId: EntityId | string,
    payload: UpdateOfferPayload,
  ): Promise<Offer> {
    const timestamp = this.now();
    const id = brandId<"EntityId">(String(offerId));

    const existing = await this.deps.repository.getOfferById(context, id);
    if (!existing) {
      throw new AppError({
        code: "NOT_FOUND",
        message: `Offer with ID "${offerId}" was not found.`,
        requestId: context.requestId,
      });
    }

    const updates: {
      price_amount_minor?: number;
      currency?: string;
      available?: number;
      status?: OfferStatus;
      valid_from?: string | null;
      effective_from?: string | null;
      valid_to?: string | null;
      effective_to?: string | null;
      updated_at: string;
    } = {
      updated_at: timestamp,
    };

    if (payload.priceAmountMinor !== undefined) {
      if (payload.priceAmountMinor < 0) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "priceAmountMinor cannot be negative.",
          requestId: context.requestId,
        });
      }
      updates.price_amount_minor = Math.floor(payload.priceAmountMinor);
    }

    if (payload.currency !== undefined) {
      updates.currency = payload.currency.toUpperCase();
    }

    if (payload.available !== undefined) {
      updates.available = payload.available ? 1 : 0;
    }

    if (payload.status !== undefined) {
      updates.status = validateOfferStatus(payload.status, context.requestId);
    }

    if (payload.validFrom !== undefined) {
      updates.valid_from = payload.validFrom;
      updates.effective_from = payload.validFrom;
    }

    if (payload.validTo !== undefined) {
      updates.valid_to = payload.validTo;
      updates.effective_to = payload.validTo;
    }

    // Cross-validate dates after partial update
    const effFrom = updates.valid_from !== undefined ? updates.valid_from : existing.valid_from;
    const effTo = updates.valid_to !== undefined ? updates.valid_to : existing.valid_to;
    if (effFrom && effTo && effFrom >= effTo) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "validTo timestamp must be strictly after validFrom timestamp.",
        requestId: context.requestId,
      });
    }

    const updated = await this.deps.repository.updateOfferRow(context, id, updates);
    if (!updated) {
      throw new AppError({
        code: "NOT_FOUND",
        message: `Offer with ID "${offerId}" could not be updated.`,
        requestId: context.requestId,
      });
    }

    return mapRowToOffer(updated);
  }

  /**
   * Disables an Offer by setting availability to false and/or status to INACTIVE.
   */
  async disableOffer(
    context: RequestContext,
    offerId: EntityId | string,
    payload?: DisableOfferPayload,
  ): Promise<Offer> {
    const timestamp = this.now();
    const id = brandId<"EntityId">(String(offerId));

    const existing = await this.deps.repository.getOfferById(context, id);
    if (!existing) {
      throw new AppError({
        code: "NOT_FOUND",
        message: `Offer with ID "${offerId}" was not found.`,
        requestId: context.requestId,
      });
    }

    const updates: {
      available?: number;
      status?: OfferStatus;
      updated_at: string;
    } = {
      available: 0,
      updated_at: timestamp,
    };

    if (payload?.setInactiveStatus) {
      updates.status = OfferStatus.INACTIVE;
    }

    const updated = await this.deps.repository.updateOfferRow(context, id, updates);
    if (!updated) {
      throw new AppError({
        code: "NOT_FOUND",
        message: `Offer with ID "${offerId}" could not be updated.`,
        requestId: context.requestId,
      });
    }

    return mapRowToOffer(updated);
  }

  /**
   * Retrieves an Offer record by ID.
   */
  async getOffer(context: RequestContext, offerId: EntityId | string): Promise<Offer | null> {
    const id = brandId<"EntityId">(String(offerId));
    const row = await this.deps.repository.getOfferById(context, id);
    if (!row) return null;
    return mapRowToOffer(row);
  }
}
