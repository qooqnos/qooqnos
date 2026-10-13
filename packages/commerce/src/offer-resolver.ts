import type { EntityId, RequestContext } from "@qooqnos/core";
import type {
  CustomerGroup,
  OfferAudienceType,
  OfferAudience,
  OfferAvailabilityStatus,
  OfferStatus,
  OfferConditions,
  Offer,
} from "./types/offer";

export type {
  CustomerGroup,
  OfferAudienceType,
  OfferAudience,
  OfferAvailabilityStatus,
  OfferStatus,
  OfferConditions,
  Offer,
};




export interface ResolveOfferParams {
  readonly customerId?: EntityId | string | undefined;
  readonly sellerId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly customerGroup?: CustomerGroup | undefined;
  readonly asOf?: string | undefined;
}

export interface ResolvedOfferResult {
  readonly offer: Offer;
  readonly resolvedAudienceType: OfferAudienceType;
  readonly inheritedFromProduct: boolean;
  readonly priceAmountMinor: number;
  readonly currency: string;
}

export interface CustomerGroupResolver {
  resolveCustomerGroup(
    context: RequestContext,
    customerId: EntityId,
    sellerId: EntityId,
  ): Promise<CustomerGroup | null>;
}

export interface OfferStore {
  listOffersForProduct(
    context: RequestContext,
    sellerId: EntityId,
    productId: EntityId,
    variantId?: EntityId | undefined,
  ): Promise<readonly Offer[]>;
}

export interface OfferResolverOptions {
  readonly store?: OfferStore | undefined;
  readonly groupResolver?: CustomerGroupResolver | undefined;
  readonly now?: (() => string) | undefined;
}

export class OfferResolver {
  private readonly store?: OfferStore | undefined;
  private readonly groupResolver?: CustomerGroupResolver | undefined;
  private readonly now: () => string;

  constructor(options?: OfferResolverOptions) {
    this.store = options?.store;
    this.groupResolver = options?.groupResolver;
    this.now = options?.now ?? (() => new Date().toISOString());
  }

  async resolve(
    context: RequestContext,
    params: ResolveOfferParams,
    inMemoryOffers?: readonly Offer[],
  ): Promise<Offer | null> {
    const detailed = await this.resolveDetailed(context, params, inMemoryOffers);
    return detailed ? detailed.offer : null;
  }

  async resolveDetailed(
    context: RequestContext,
    params: ResolveOfferParams,
    inMemoryOffers?: readonly Offer[],
  ): Promise<ResolvedOfferResult | null> {
    const sellerId = String(params.sellerId) as EntityId;
    const productId = String(params.productId) as EntityId;
    const variantId = params.variantId ? (String(params.variantId) as EntityId) : undefined;
    const customerId = params.customerId ? (String(params.customerId) as EntityId) : undefined;
    const nowIso = params.asOf ?? this.now();

    let candidates: readonly Offer[];
    if (inMemoryOffers) {
      candidates = inMemoryOffers.filter(
        (o) => o.sellerId === sellerId && o.productId === productId,
      );
    } else if (this.store) {
      candidates = await this.store.listOffersForProduct(context, sellerId, productId, variantId);
    } else {
      candidates = [];
    }

    if (candidates.length === 0) {
      return null;
    }

    let customerGroup: CustomerGroup = params.customerGroup ?? "consumer";
    if (customerId && !params.customerGroup && this.groupResolver) {
      const resolvedGroup = await this.groupResolver.resolveCustomerGroup(context, customerId, sellerId);
      if (resolvedGroup) {
        customerGroup = resolvedGroup;
      }
    }

    const variantOffers = variantId
      ? candidates.filter((o) => o.variantId === variantId)
      : [];
    const productOffers = candidates.filter((o) => !o.variantId);

    const findMatchingOffer = (
      offerPool: readonly Offer[],
      matcher: (offer: Offer) => boolean,
    ): Offer | null => {
      for (const offer of offerPool) {
        if (!matcher(offer)) continue;
        if (!this.isTemporalValid(offer, nowIso)) continue;
        return offer;
      }
      return null;
    };

    // Priority Tier 1: Customer-specific
    if (customerId) {
      if (variantId) {
        const match = findMatchingOffer(
          variantOffers,
          (o) => o.audience.type === "customer" && o.audience.customerId === customerId,
        );
        if (match) {
          if (!match.available) return null;
          return {
            offer: match,
            resolvedAudienceType: "customer",
            inheritedFromProduct: false,
            priceAmountMinor: match.priceAmountMinor,
            currency: match.currency,
          };
        }
      }
      const matchProduct = findMatchingOffer(
        productOffers,
        (o) => o.audience.type === "customer" && o.audience.customerId === customerId,
      );
      if (matchProduct) {
        if (!matchProduct.available) return null;
        return {
          offer: matchProduct,
          resolvedAudienceType: "customer",
          inheritedFromProduct: Boolean(variantId),
          priceAmountMinor: matchProduct.priceAmountMinor,
          currency: matchProduct.currency,
        };
      }
    }

    // Priority Tier 2: Customer Group
    if (customerGroup) {
      if (variantId) {
        const match = findMatchingOffer(
          variantOffers,
          (o) => o.audience.type === "group" && o.audience.group === customerGroup,
        );
        if (match) {
          if (!match.available) return null;
          return {
            offer: match,
            resolvedAudienceType: "group",
            inheritedFromProduct: false,
            priceAmountMinor: match.priceAmountMinor,
            currency: match.currency,
          };
        }
      }
      const matchProduct = findMatchingOffer(
        productOffers,
        (o) => o.audience.type === "group" && o.audience.group === customerGroup,
      );
      if (matchProduct) {
        if (!matchProduct.available) return null;
        return {
          offer: matchProduct,
          resolvedAudienceType: "group",
          inheritedFromProduct: Boolean(variantId),
          priceAmountMinor: matchProduct.priceAmountMinor,
          currency: matchProduct.currency,
        };
      }
    }

    // Priority Tier 3: General / Public Base Offer
    if (variantId) {
      const match = findMatchingOffer(
        variantOffers,
        (o) => o.audience.type === "general",
      );
      if (match) {
        if (!match.available) return null;
        return {
          offer: match,
          resolvedAudienceType: "general",
          inheritedFromProduct: false,
          priceAmountMinor: match.priceAmountMinor,
          currency: match.currency,
        };
      }
    }
    const matchProduct = findMatchingOffer(
      productOffers,
      (o) => o.audience.type === "general",
    );
    if (matchProduct) {
      if (!matchProduct.available) return null;
      return {
        offer: matchProduct,
        resolvedAudienceType: "general",
        inheritedFromProduct: Boolean(variantId),
        priceAmountMinor: matchProduct.priceAmountMinor,
        currency: matchProduct.currency,
      };
    }

    return null;
  }

  private isTemporalValid(offer: Offer, nowIso: string): boolean {
    const statusUpper = String(offer.status).toUpperCase();
    if (statusUpper !== "ACTIVE") {
      return false;
    }
    const from = offer.validFrom ?? offer.conditions?.effectiveFrom;
    const to = offer.validTo ?? offer.conditions?.effectiveTo;
    if (from && to && from >= to) {
      return false;
    }
    if (from && from > nowIso) {
      return false;
    }
    if (to && to <= nowIso) {
      return false;
    }
    return true;
  }

  private isValidOffer(offer: Offer, nowIso: string): boolean {
    if (!this.isTemporalValid(offer, nowIso)) {
      return false;
    }
    if (offer.availabilityStatus === "unavailable" || !offer.available) {
      return false;
    }
    return true;
  }
}
