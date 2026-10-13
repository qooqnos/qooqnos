import type { EntityId, RequestContext } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import {
  CommerceRepository,
  type CommerceOfferRow,
} from "../repository";
import type {
  Offer,
  OfferAudienceType,
  OfferStatus,
  CustomerGroup,
} from "../types/offer";

export interface ResolveOfferInput {
  readonly customerId?: EntityId | string | undefined;
  readonly sellerId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly customerGroup?: CustomerGroup | undefined;
  readonly asOf?: string | undefined;
}

export interface OfferResolutionResult {
  readonly offer: Offer;
  readonly precedenceMatched: OfferAudienceType;
  readonly isInheritedFromProduct: boolean;
}

export interface OfferResolverServiceOptions {
  readonly repository?: CommerceRepository | undefined;
  readonly database?: D1Database | undefined;
  readonly now?: (() => string) | undefined;
}

/**
 * OfferResolver Service
 * Consolidates access and pricing logic into a unified Offer decision.
 * Precedence Rule: Customer-specific > Group-specific > General base.
 * Variant items inherit from product base offers unless explicitly overridden.
 */
export class OfferResolver {
  private readonly repository: CommerceRepository | undefined;
  private readonly now: () => string;

  constructor(options?: OfferResolverServiceOptions) {
    if (options?.repository) {
      this.repository = options.repository;
    } else if (options?.database) {
      this.repository = new CommerceRepository(options.database);
    }
    this.now = options?.now ?? (() => new Date().toISOString());
  }

  /**
   * Resolves the optimal offer for a product/variant and audience.
   * Queries database or memory and applies precedence: Customer > Group > General.
   * Returns null if no valid/available offer exists.
   */
  async resolveOffer(
    context: RequestContext,
    input: ResolveOfferInput,
    inMemoryOffers?: readonly Offer[],
  ): Promise<Offer | null> {
    const detailed = await this.resolveOfferDetailed(context, input, inMemoryOffers);
    return detailed ? detailed.offer : null;
  }

  /**
   * Detailed resolver returning metadata on matching tier and inheritance.
   */
  async resolveOfferDetailed(
    context: RequestContext,
    input: ResolveOfferInput,
    inMemoryOffers?: readonly Offer[],
  ): Promise<OfferResolutionResult | null> {
    const sellerId = String(input.sellerId) as EntityId;
    const productId = String(input.productId) as EntityId;
    const variantId = input.variantId ? (String(input.variantId) as EntityId) : undefined;
    const customerId = input.customerId ? (String(input.customerId) as EntityId) : undefined;
    const nowIso = input.asOf ?? this.now();

    let offers: readonly Offer[];

    if (inMemoryOffers) {
      offers = inMemoryOffers.filter(
        (o) => o.sellerId === sellerId && o.productId === productId,
      );
    } else if (this.repository) {
      const rows = await this.repository.listProductOffers(
        context,
        sellerId,
        productId,
        variantId,
      );
      offers = rows.map((row) => this.mapRowToOffer(row));
    } else {
      offers = [];
    }

    if (offers.length === 0) {
      return null;
    }

    // Determine customer group: use provided, look up relationship, or fallback to "consumer"
    let customerGroup: CustomerGroup = input.customerGroup ?? "consumer";
    if (customerId && !input.customerGroup && context.workspaceId) {
      try {
        const foundGroup = await this.lookupCustomerGroup(context, customerId, sellerId);
        if (foundGroup) {
          customerGroup = foundGroup;
        }
      } catch {
        // Fallback to "consumer"
      }
    }

    const variantOffers = variantId
      ? offers.filter((o) => o.variantId === variantId)
      : [];
    const productOffers = offers.filter((o) => !o.variantId);

    const matchActiveOffer = (
      pool: readonly Offer[],
      matcher: (offer: Offer) => boolean,
    ): Offer | null => {
      for (const item of pool) {
        if (!matcher(item)) continue;
        if (!this.isValid(item, nowIso)) continue;
        return item;
      }
      return null;
    };

    // Tier 1: Customer-Specific Offer (Precedence: 1)
    if (customerId) {
      if (variantId) {
        const variantCustomerOffer = matchActiveOffer(
          variantOffers,
          (o) => o.audience.type === "customer" && o.audience.customerId === customerId,
        );
        if (variantCustomerOffer) {
          if (!variantCustomerOffer.available) return null;
          return {
            offer: variantCustomerOffer,
            precedenceMatched: "customer",
            isInheritedFromProduct: false,
          };
        }
      }

      const productCustomerOffer = matchActiveOffer(
        productOffers,
        (o) => o.audience.type === "customer" && o.audience.customerId === customerId,
      );
      if (productCustomerOffer) {
        if (!productCustomerOffer.available) return null;
        return {
          offer: productCustomerOffer,
          precedenceMatched: "customer",
          isInheritedFromProduct: Boolean(variantId),
        };
      }
    }

    // Tier 2: Customer Group Offer (Precedence: 2)
    if (customerGroup) {
      if (variantId) {
        const variantGroupOffer = matchActiveOffer(
          variantOffers,
          (o) => o.audience.type === "group" && o.audience.group === customerGroup,
        );
        if (variantGroupOffer) {
          if (!variantGroupOffer.available) return null;
          return {
            offer: variantGroupOffer,
            precedenceMatched: "group",
            isInheritedFromProduct: false,
          };
        }
      }

      const productGroupOffer = matchActiveOffer(
        productOffers,
        (o) => o.audience.type === "group" && o.audience.group === customerGroup,
      );
      if (productGroupOffer) {
        if (!productGroupOffer.available) return null;
        return {
          offer: productGroupOffer,
          precedenceMatched: "group",
          isInheritedFromProduct: Boolean(variantId),
        };
      }
    }

    // Tier 3: General Public Offer (Precedence: 3)
    if (variantId) {
      const variantGeneralOffer = matchActiveOffer(
        variantOffers,
        (o) => o.audience.type === "general",
      );
      if (variantGeneralOffer) {
        if (!variantGeneralOffer.available) return null;
        return {
          offer: variantGeneralOffer,
          precedenceMatched: "general",
          isInheritedFromProduct: false,
        };
      }
    }

    const productGeneralOffer = matchActiveOffer(
      productOffers,
      (o) => o.audience.type === "general",
    );
    if (productGeneralOffer) {
      if (!productGeneralOffer.available) return null;
      return {
        offer: productGeneralOffer,
        precedenceMatched: "general",
        isInheritedFromProduct: Boolean(variantId),
      };
    }

    return null;
  }

  /**
   * Evaluates if an offer is currently valid and active:
   * - Status must be ACTIVE
   * - Must be marked available
   * - Compares current time against validFrom and validTo date range:
   *   Only considers offers where current date is within that range [validFrom, validTo).
   */
  private isValid(offer: Offer, nowIso: string): boolean {
    const statusUpper = String(offer.status).toUpperCase();
    if (statusUpper !== "ACTIVE") return false;
    if (offer.availabilityStatus === "unavailable" || !offer.available) return false;

    const from = offer.validFrom ?? offer.conditions?.effectiveFrom;
    const to = offer.validTo ?? offer.conditions?.effectiveTo;

    // Logical coherence: validTo must be strictly greater than validFrom
    if (from && to && from >= to) {
      return false;
    }

    // Current time must NOT be before validFrom (if set)
    if (from && from > nowIso) {
      return false;
    }

    // Current time must NOT be equal or after validTo (if set)
    if (to && to <= nowIso) {
      return false;
    }

    return true;
  }

  private async lookupCustomerGroup(
    context: RequestContext,
    customerId: EntityId,
    sellerId: EntityId,
  ): Promise<CustomerGroup | null> {
    if (!this.repository) return null;
    const type = await this.repository.getCustomerRelationshipType(context, customerId, sellerId);
    return (type as CustomerGroup) ?? null;
  }

  private mapRowToOffer(row: CommerceOfferRow): Offer {
    let parsedConditions = undefined;
    if (row.conditions_json) {
      try {
        parsedConditions = JSON.parse(row.conditions_json);
      } catch {
        // ignore malformed custom json
      }
    }

    return {
      id: row.id,
      organizationId: row.organization_id,
      workspaceId: row.workspace_id,
      sellerId: row.seller_id,
      productId: row.product_id,
      ...(row.variant_id ? { variantId: row.variant_id } : {}),
      audience: {
        type: row.audience_type,
        ...(row.customer_id ? { customerId: row.customer_id } : {}),
        ...(row.customer_group ? { group: row.customer_group as CustomerGroup } : {}),
      },
      availabilityStatus: row.available === 1 ? "available" : "unavailable",
      available: row.available === 1,
      priceAmountMinor: row.price_amount_minor,
      currency: row.currency,
      ...(row.valid_from ? { validFrom: row.valid_from } : (row.effective_from ? { validFrom: row.effective_from } : {})),
      ...(row.valid_to ? { validTo: row.valid_to } : (row.effective_to ? { validTo: row.effective_to } : {})),
      conditions: {
        ...(row.min_quantity !== null ? { minQuantity: row.min_quantity } : {}),
        ...(row.max_quantity !== null ? { maxQuantity: row.max_quantity } : {}),
        ...(row.effective_from !== null ? { effectiveFrom: row.effective_from } : {}),
        ...(row.effective_to !== null ? { effectiveTo: row.effective_to } : {}),
        ...(row.digital_entitlement_id !== null ? { digitalEntitlementId: row.digital_entitlement_id } : {}),
        ...parsedConditions,
      },
      status: row.status as OfferStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
