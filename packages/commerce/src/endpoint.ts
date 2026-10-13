import type { EntityId, RequestContext } from "@qooqnos/core";
import { OfferResolver, type OfferResolutionResult } from "./services/offerResolver";
import type { CommerceRepository } from "./repository";
import type { Offer } from "./types/offer";

export interface ResolveOfferEndpointParams {
  readonly customerId?: EntityId | string | undefined;
  readonly sellerId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly customerGroup?: string | undefined;
  readonly asOf?: string | undefined;
}

export interface ResolveOfferEndpointResult {
  readonly success: boolean;
  readonly offer: Offer | null;
  readonly precedenceMatched?: "customer" | "group" | "general" | undefined;
  readonly isInheritedFromProduct?: boolean | undefined;
  readonly resolvedAt: string;
}

export interface OfferEndpointContext {
  readonly repository: CommerceRepository;
  readonly now?: (() => string) | undefined;
}

/**
 * Commerce Package API Endpoint Handler for Offer Resolution.
 * Directly exposes OfferResolver service logic for consumption by
 * storefronts, API gateways, or internal services.
 *
 * Parameters:
 * - customerId: Optional/Targeted customer context
 * - sellerId: Required merchant/business identifier
 * - productId: Required catalog product identifier
 * - variantId: Optional variant identifier
 *
 * Returns resolved optimal offer adhering strictly to precedence:
 * Customer-specific > Group-specific > General base.
 */
export async function handleResolveOfferEndpoint(
  context: RequestContext,
  params: ResolveOfferEndpointParams,
  endpointContext: OfferEndpointContext,
): Promise<ResolveOfferEndpointResult> {
  const nowFn = endpointContext.now ?? (() => new Date().toISOString());
  const resolvedAt = nowFn();

  if (!params.sellerId) {
    throw new Error("sellerId parameter is required");
  }
  if (!params.productId) {
    throw new Error("productId parameter is required");
  }

  const resolver = new OfferResolver({
    repository: endpointContext.repository,
    now: nowFn,
  });

  const result: OfferResolutionResult | null = await resolver.resolveOfferDetailed(
    context,
    {
      sellerId: params.sellerId,
      productId: params.productId,
      variantId: params.variantId,
      customerId: params.customerId,
      customerGroup: params.customerGroup,
      asOf: params.asOf ?? resolvedAt,
    },
  );

  if (!result || !result.offer) {
    return {
      success: false,
      offer: null,
      resolvedAt,
    };
  }

  return {
    success: true,
    offer: result.offer,
    precedenceMatched: result.precedenceMatched,
    isInheritedFromProduct: result.isInheritedFromProduct,
    resolvedAt,
  };
}
