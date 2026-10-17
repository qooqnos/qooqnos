import { CommerceRepository, CommerceService, type OrderStatus } from "@qooqnos/commerce";
import { BusinessRepository } from "@qooqnos/business";
import { AuthorizationRepository, CustomerRepository } from "@qooqnos/database";
import { createAuthorizationService, type AuthorizationRegistry } from "@qooqnos/runtime";
import { AppError, brandId, type EntityId, type RequestContext } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import type { ApiRouter } from "./router";
import { json } from "./http";

export function registerCommerceRoutes(
  router: ApiRouter,
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
): void {
  router.register({
    method: "GET",
    path: "/api/v1/commerce/offers/resolve",
    module: "commerce",
    operation: "commerce.offer.resolve",
    requireAuthentication: false,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const url = new URL(request.url);
      const sellerId = requiredParam(url.searchParams.get("sellerId") ?? undefined, context.requestId);
      const productId = requiredParam(url.searchParams.get("productId") ?? undefined, context.requestId);
      const variantId = url.searchParams.get("variantId") ?? undefined;
      // This endpoint is public: browser-supplied customer IDs, relationship groups,
      // and time overrides must never unlock private or future pricing tiers.
      // Consumer/base pricing is the only audience resolved without a canonical
      // authenticated Customer mapping and seller-specific relationship check.
      const service = createService(database, authorization, context.requestId);
      const result = await service.resolveOffer(context, {
        sellerId: brandId<"EntityId">(sellerId),
        productId: brandId<"EntityId">(productId),
        ...(variantId ? { variantId: brandId<"EntityId">(variantId) } : {}),
        customerGroup: "consumer",
      });
      if (!result || !result.offer) {
        return json({ data: null, message: "No available offer found for the specified context." }, 404, context.requestId);
      }

      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/offers/resolve",
    module: "commerce",
    operation: "commerce.offer.resolve",
    requireAuthentication: false,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const body = await bodyObject(request, context.requestId);
      const sellerId = requiredId(body.sellerId, "sellerId", context.requestId);
      const productId = requiredId(body.productId, "productId", context.requestId);
      const variantId = body.variantId !== undefined ? requiredId(body.variantId, "variantId", context.requestId) : undefined;
      // Keep the public POST contract aligned with GET. Audience, customer identity,
      // and effective-time context are server-owned, never accepted from the payload.
      const service = createService(database, authorization, context.requestId);
      const result = await service.resolveOffer(context, {
        sellerId,
        productId,
        ...(variantId ? { variantId } : {}),
        customerGroup: "consumer",
      });

      if (!result || !result.offer) {
        return json({ data: null, message: "No available offer found for the specified context." }, 404, context.requestId);
      }

      return json({ data: result }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/offers/resolve-for-customer",
    module: "commerce",
    operation: "commerce.offer.resolve",
    requireAuthentication: false,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      // Authenticate the actor directly, then derive every pricing entitlement
      // from canonical records. A customer does not need seller-workspace
      // membership, so tenant/workspace scope comes from the published Business.
      if (!context.authenticated || !context.actorId) {
        throw new AppError({
          code: "UNAUTHORIZED",
          message: "Authentication is required to resolve customer-specific pricing.",
          requestId: context.requestId,
        });
      }
      if (!database || !authorization) {
        throw new AppError({
          code: "INTERNAL_ERROR",
          message: "Commerce pricing dependencies are not configured.",
          requestId: context.requestId,
        });
      }
      const body = await bodyObject(request, context.requestId);
      const sellerId = requiredId(body.sellerId, "sellerId", context.requestId);
      const productId = requiredId(body.productId, "productId", context.requestId);
      const variantId = body.variantId !== undefined ? requiredId(body.variantId, "variantId", context.requestId) : undefined;
      const target = await new BusinessRepository(database).getPublishedConversationTarget(sellerId);
      if (!target) {
        return json({ data: null, message: "Published seller was not found." }, 404, context.requestId);
      }

      const scopedContext = {
        ...context,
        tenantId: target.organizationId,
        workspaceId: target.workspaceId,
      };
      const customer = await new CustomerRepository(database).getByUserId(scopedContext, context.actorId);
      if (customer && customer.status !== "active") {
        throw new AppError({
          code: "FORBIDDEN",
          message: "This customer account cannot access personalized pricing.",
          requestId: context.requestId,
        });
      }

      const relationshipType = customer
        ? await new CommerceRepository(database).getCustomerRelationshipType(scopedContext, customer.id, sellerId)
        : null;
      const service = createService(database, authorization, context.requestId);
      const result = await service.resolveOffer(scopedContext, {
        sellerId,
        productId,
        ...(variantId ? { variantId } : {}),
        ...(customer ? { customerId: customer.id } : {}),
        customerGroup: relationshipType ?? "consumer",
      });
      if (!result || !result.offer) {
        return json({ data: null, message: "No available offer found for this customer context." }, 404, context.requestId);
      }

      // Never echo the private Customer ID from an offer's audience back to the buyer.
      const { audience, ...offer } = result.offer;
      const safeAudience = audience.type === "customer" ? { type: "customer" as const } : audience;
      return json({
        data: {
          offer: { ...offer, audience: safeAudience },
          precedenceMatched: result.precedenceMatched,
          isInheritedFromProduct: result.isInheritedFromProduct,
        },
      }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/offers",
    module: "commerce",
    operation: "commerce.offer.manage",
    permission: "commerce.offer.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const sellerId = requiredId(body.sellerId, "sellerId", context.requestId);
      const productId = requiredId(body.productId, "productId", context.requestId);
      const priceAmountMinor = requiredInteger(body.priceAmountMinor, "priceAmountMinor", context.requestId);

      const offer = await service.createOffer(context, {
        sellerId,
        productId,
        ...(body.variantId !== undefined ? { variantId: requiredId(body.variantId, "variantId", context.requestId) } : {}),
        ...(body.customerGroup !== undefined ? { customerGroup: String(body.customerGroup) } : {}),
        ...(body.customerId !== undefined ? { customerId: requiredId(body.customerId, "customerId", context.requestId) } : {}),
        ...(body.audienceType !== undefined ? { audienceType: parseOfferAudienceType(body.audienceType, context.requestId) } : {}),
        priceAmountMinor,
        ...(body.currency !== undefined ? { currency: String(body.currency) } : {}),
        ...(body.available !== undefined ? { available: Boolean(body.available) } : {}),
        ...(body.validFrom !== undefined ? { validFrom: String(body.validFrom) } : {}),
        ...(body.validTo !== undefined ? { validTo: String(body.validTo) } : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
      });

      return json({ data: offer }, 201, context.requestId);
    },
  });

  router.register({
    method: "PUT",
    path: "/api/v1/commerce/offers/:offerId",
    module: "commerce",
    operation: "commerce.offer.manage",
    permission: "commerce.offer.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const offerId = requiredId(params.offerId, "offerId", context.requestId);
      const body = await bodyObject(request, context.requestId);

      const offer = await service.updateOffer(context, offerId, {
        ...(body.priceAmountMinor !== undefined ? { priceAmountMinor: Number(body.priceAmountMinor) } : {}),
        ...(body.currency !== undefined ? { currency: String(body.currency) } : {}),
        ...(body.available !== undefined ? { available: Boolean(body.available) } : {}),
        ...(body.validFrom !== undefined ? { validFrom: String(body.validFrom) } : {}),
        ...(body.validTo !== undefined ? { validTo: String(body.validTo) } : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
      });

      return json({ data: offer }, 200, context.requestId);
    },
  });

  router.register({
    method: "DELETE",
    path: "/api/v1/commerce/offers/:offerId",
    module: "commerce",
    operation: "commerce.offer.manage",
    permission: "commerce.offer.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const offerId = requiredId(params.offerId, "offerId", context.requestId);
      const url = new URL(request.url);
      const setInactiveStatus = url.searchParams.get("setInactiveStatus") === "true";

      const offer = await service.disableOffer(context, offerId, {
        setInactiveStatus,
      });

      return json({ data: offer, message: "Offer disabled successfully." }, 200, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/commerce/offers/:offerId",
    module: "commerce",
    operation: "commerce.offer.get",
    requireAuthentication: false,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const service = createService(database, authorization, context.requestId);
      const offerId = requiredId(params.offerId, "offerId", context.requestId);
      const offer = await service.getOffer(context, offerId);
      if (!offer) {
        return json({ data: null, message: `Offer with ID "${offerId}" was not found.` }, 404, context.requestId);
      }
      return json({ data: offer }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/carts",
    module: "commerce",
    operation: "commerce.cart.create",
    permission: "commerce.cart.create",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const cart = await service.createCart(context, {
        actorReference: context.actorId ?? "system",
        ...(body.customerId !== undefined ? { customerId: requiredId(body.customerId, "customerId", context.requestId) } : {}),
        currency: requiredString(body.currency, "currency", context.requestId),
        ...(body.expiresAt !== undefined ? { expiresAt: requiredString(body.expiresAt, "expiresAt", context.requestId) } : {}),
      });
      return json({ data: cart }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/carts/:cartId/lines",
    module: "commerce",
    operation: "commerce.cart.update",
    permission: "commerce.cart.update",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const line = await service.addCartLine(context, {
        cartId: brandId<"EntityId">(requiredParam(params.cartId, context.requestId)),
        resourceType: requiredResourceType(body.resourceType, context.requestId),
        resourceId: requiredId(body.resourceId, "resourceId", context.requestId),
        ...(body.variantReference !== undefined ? { variantReference: requiredString(body.variantReference, "variantReference", context.requestId) } : {}),
        quantity: requiredPositiveInteger(body.quantity, "quantity", context.requestId),
        ...(body.selectedOptions !== undefined ? { selectedOptions: requiredObject(body.selectedOptions, "selectedOptions", context.requestId) } : {}),
        ...(body.sourceReference !== undefined ? { sourceReference: requiredString(body.sourceReference, "sourceReference", context.requestId) } : {}),
      });
      return json({ data: line }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/checkout",
    module: "commerce",
    operation: "commerce.checkout.start",
    permission: "commerce.checkout.start",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const checkout = await service.startCheckout(context, {
        cartId: requiredId(body.cartId, "cartId", context.requestId),
        idempotencyKey,
      });
      return json({ data: checkout }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/price-snapshots",
    module: "commerce",
    operation: "commerce.checkout.start",
    permission: "commerce.checkout.start",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const snapshot = await service.createPriceSnapshot(context, {
        currency: requiredString(body.currency, "currency", context.requestId),
        lineSnapshots: requiredObjectArray(body.lineSnapshots, "lineSnapshots", context.requestId),
        subtotalMinor: requiredInteger(body.subtotalMinor, "subtotalMinor", context.requestId),
        adjustmentTotalMinor: requiredInteger(body.adjustmentTotalMinor, "adjustmentTotalMinor", context.requestId),
        taxTotalMinor: requiredNonNegativeInteger(body.taxTotalMinor, "taxTotalMinor", context.requestId),
        feeTotalMinor: requiredNonNegativeInteger(body.feeTotalMinor, "feeTotalMinor", context.requestId),
        grandTotalMinor: requiredNonNegativeInteger(body.grandTotalMinor, "grandTotalMinor", context.requestId),
        ...(body.catalogVersionRefs !== undefined ? { catalogVersionRefs: requiredStringArray(body.catalogVersionRefs, "catalogVersionRefs", context.requestId) } : {}),
        ...(body.promotionVersionRefs !== undefined ? { promotionVersionRefs: requiredStringArray(body.promotionVersionRefs, "promotionVersionRefs", context.requestId) } : {}),
        ...(body.loyaltyVersionRefs !== undefined ? { loyaltyVersionRefs: requiredStringArray(body.loyaltyVersionRefs, "loyaltyVersionRefs", context.requestId) } : {}),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
        calculatedAt: requiredString(body.calculatedAt, "calculatedAt", context.requestId),
        calculationContextHash: requiredString(body.calculationContextHash, "calculationContextHash", context.requestId),
      });
      return json({ data: snapshot }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/orders",
    module: "commerce",
    operation: "commerce.order.create",
    permission: "commerce.order.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const idempotencyKey = requiredIdempotencyKey(request, context.requestId);
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const order = await service.createOrder(context, {
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        customerId: requiredId(body.customerId, "customerId", context.requestId),
        ...(body.matchRequestId !== undefined ? { matchRequestId: requiredId(body.matchRequestId, "matchRequestId", context.requestId) } : {}),
        ...(body.matchCandidateId !== undefined ? { matchCandidateId: requiredId(body.matchCandidateId, "matchCandidateId", context.requestId) } : {}),
        ...(body.priceSnapshotId !== undefined ? { priceSnapshotId: requiredId(body.priceSnapshotId, "priceSnapshotId", context.requestId) } : {}),
        currency: requiredString(body.currency, "currency", context.requestId),
        subtotalMinor: requiredNonNegativeInteger(body.subtotalMinor, "subtotalMinor", context.requestId),
        adjustmentTotalMinor: requiredInteger(body.adjustmentTotalMinor, "adjustmentTotalMinor", context.requestId),
        taxTotalMinor: requiredNonNegativeInteger(body.taxTotalMinor, "taxTotalMinor", context.requestId),
        feeTotalMinor: requiredNonNegativeInteger(body.feeTotalMinor, "feeTotalMinor", context.requestId),
        grandTotalMinor: requiredNonNegativeInteger(body.grandTotalMinor, "grandTotalMinor", context.requestId),
        sourceChannel: requiredSourceChannel(body.sourceChannel, context.requestId),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
        idempotencyKey,
      });
      return json({ data: order }, 201, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/orders/:orderId/lines",
    module: "commerce",
    operation: "commerce.order.create",
    permission: "commerce.order.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const line = await service.addOrderLine(context, {
        orderId: brandId<"EntityId">(requiredParam(params.orderId, context.requestId)),
        resourceType: requiredResourceType(body.resourceType, context.requestId),
        resourceId: requiredId(body.resourceId, "resourceId", context.requestId),
        ...(body.resourceVersion !== undefined ? { resourceVersion: requiredString(body.resourceVersion, "resourceVersion", context.requestId) } : {}),
        ...(body.variantReference !== undefined ? { variantReference: requiredString(body.variantReference, "variantReference", context.requestId) } : {}),
        descriptionSnapshot: requiredString(body.descriptionSnapshot, "descriptionSnapshot", context.requestId),
        quantity: requiredPositiveInteger(body.quantity, "quantity", context.requestId),
        unitPriceMinorSnapshot: requiredNonNegativeInteger(body.unitPriceMinorSnapshot, "unitPriceMinorSnapshot", context.requestId),
        lineSubtotalMinor: requiredNonNegativeInteger(body.lineSubtotalMinor, "lineSubtotalMinor", context.requestId),
        lineAdjustmentTotalMinor: requiredInteger(body.lineAdjustmentTotalMinor, "lineAdjustmentTotalMinor", context.requestId),
        lineTotalMinor: requiredNonNegativeInteger(body.lineTotalMinor, "lineTotalMinor", context.requestId),
        ...(body.promotionReference !== undefined ? { promotionReference: requiredString(body.promotionReference, "promotionReference", context.requestId) } : {}),
        ...(body.loyaltyReference !== undefined ? { loyaltyReference: requiredString(body.loyaltyReference, "loyaltyReference", context.requestId) } : {}),
        ...(body.bookingReference !== undefined ? { bookingReference: requiredString(body.bookingReference, "bookingReference", context.requestId) } : {}),
        ...(body.fulfillmentReference !== undefined ? { fulfillmentReference: requiredString(body.fulfillmentReference, "fulfillmentReference", context.requestId) } : {}),
      });
      return json({ data: line }, 201, context.requestId);
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/commerce/orders",
    module: "commerce",
    operation: "commerce.order.list",
    permission: "commerce.order.get",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, request }) => {
      const repository = createRepository(database, context.requestId);
      const url = new URL(request.url);
      const businessId = url.searchParams.get("businessId")?.trim();
      const customerId = url.searchParams.get("customerId")?.trim();
      const requestedLimit = Number(url.searchParams.get("limit") ?? "20");
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 20;

      if (customerId) {
        const orders = await repository.listCustomerOrders(context, brandId<"EntityId">(customerId), limit);
        return json({ data: orders }, 200, context.requestId);
      }
      if (businessId) {
        const orders = await repository.listOrders(context, brandId<"EntityId">(businessId), limit);
        return json({ data: orders }, 200, context.requestId);
      }

      // Default fallback: if customer or business context exists
      const targetCustomer = context.actorId ? brandId<"EntityId">(context.actorId) : undefined;
      if (targetCustomer) {
        const orders = await repository.listCustomerOrders(context, targetCustomer, limit);
        return json({ data: orders }, 200, context.requestId);
      }

      throw new AppError({ code: "VALIDATION_ERROR", message: "businessId or customerId query parameter is required.", requestId: context.requestId });
    },
  });

  router.register({
    method: "GET",
    path: "/api/v1/commerce/orders/:orderId",
    module: "commerce",
    operation: "commerce.order.get",
    permission: "commerce.order.get",
    requireAuthentication: true,
    requireWorkspace: false,
    handler: async ({ context, params }) => {
      const repository = createRepository(database, context.requestId);
      const orderId = brandId<"EntityId">(requiredParam(params.orderId, context.requestId));
      const order = await repository.getOrder(context, orderId);
      if (!order) throw new AppError({ code: "NOT_FOUND", message: "Commerce order not found.", requestId: context.requestId });
      const lines = await repository.listOrderLines(context, orderId);
      return json({ data: { order, lines } }, 200, context.requestId);
    },
  });

  router.register({
    method: "POST",
    path: "/api/v1/commerce/orders/:orderId/status",
    module: "commerce",
    operation: "commerce.order.create",
    permission: "commerce.order.create",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request, params }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const status = requiredOrderStatus(body.status, context.requestId);
      const order = await service.setOrderStatus(
        context,
        brandId<"EntityId">(requiredParam(params.orderId, context.requestId)),
        status,
      );
      return json({ data: order }, 200, context.requestId);
    },
  });
  router.register({
    method: "POST",
    path: "/api/v1/commerce/fulfillment-policies",
    module: "commerce",
    operation: "commerce.fulfillment_policy.manage",
    permission: "commerce.fulfillment_policy.manage",
    requireAuthentication: true,
    requireWorkspace: true,
    handler: async ({ context, request }) => {
      const service = createService(database, authorization, context.requestId);
      const body = await bodyObject(request, context.requestId);
      const policy = await service.upsertFulfillmentPolicy(context, {
        businessId: requiredId(body.businessId, "businessId", context.requestId),
        resourceType: requiredFulfillmentPolicyResourceType(body.resourceType, context.requestId),
        ...(body.resourceId !== undefined ? { resourceId: requiredId(body.resourceId, "resourceId", context.requestId) } : {}),
        ...(body.destinationCountry !== undefined ? { destinationCountry: requiredString(body.destinationCountry, "destinationCountry", context.requestId) } : {}),
        ...(body.destinationRegion !== undefined ? { destinationRegion: requiredString(body.destinationRegion, "destinationRegion", context.requestId) } : {}),
        ...(body.destinationPostalCode !== undefined ? { destinationPostalCode: requiredString(body.destinationPostalCode, "destinationPostalCode", context.requestId) } : {}),
        ...(body.shippingRateMinor !== undefined ? { shippingRateMinor: requiredNonNegativeInteger(body.shippingRateMinor, "shippingRateMinor", context.requestId) } : {}),
        ...(body.shippingCurrency !== undefined ? { shippingCurrency: requiredString(body.shippingCurrency, "shippingCurrency", context.requestId) } : {}),
        ...(body.handlingTimeMinDays !== undefined ? { handlingTimeMinDays: requiredNonNegativeInteger(body.handlingTimeMinDays, "handlingTimeMinDays", context.requestId) } : {}),
        ...(body.handlingTimeMaxDays !== undefined ? { handlingTimeMaxDays: requiredNonNegativeInteger(body.handlingTimeMaxDays, "handlingTimeMaxDays", context.requestId) } : {}),
        ...(body.returnWindowDays !== undefined ? { returnWindowDays: requiredNonNegativeInteger(body.returnWindowDays, "returnWindowDays", context.requestId) } : {}),
        ...(body.returnFees !== undefined ? { returnFees: requiredReturnFees(body.returnFees, context.requestId) } : {}),
        ...(body.returnMethod !== undefined ? { returnMethod: requiredReturnMethod(body.returnMethod, context.requestId) } : {}),
        policyVersion: requiredString(body.policyVersion, "policyVersion", context.requestId),
        ...(body.status !== undefined ? { status: requiredFulfillmentPolicyStatus(body.status, context.requestId) } : {}),
      });
      return json({ data: policy }, 201, context.requestId);
    },
  });

}

function createRepository(database: D1Database | undefined, requestId: EntityId): CommerceRepository {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  return new CommerceRepository(database);
}

function createService(
  database: D1Database | undefined,
  authorization: AuthorizationRegistry | undefined,
  requestId: EntityId,
): CommerceService {
  if (!database) throw new AppError({ code: "INTERNAL_ERROR", message: "Database is not configured.", requestId });
  if (!authorization) throw new AppError({ code: "INTERNAL_ERROR", message: "Authorization registry is not configured.", requestId });
  return new CommerceService({
    repository: new CommerceRepository(database),
    authorization: createAuthorizationService(new AuthorizationRepository(database), authorization),
    id: () => brandId<"EntityId">(crypto.randomUUID()),
    now: () => new Date().toISOString(),
  });
}

async function bodyObject(request: Request, requestId: EntityId): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be valid JSON.", requestId });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Request body must be an object.", requestId });
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, requestId: EntityId): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " is required.", requestId });
  }
  return value.trim();
}

function requiredId(value: unknown, field: string, requestId: EntityId): EntityId {
  return brandId<"EntityId">(requiredString(value, field, requestId));
}

function requiredParam(value: string | undefined, requestId: EntityId): string {
  if (!value) throw new AppError({ code: "NOT_FOUND", message: "Route parameter is missing.", requestId });
  return value;
}

function requiredPositiveInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a positive integer.", requestId });
  }
  return value as number;
}

function requiredNonNegativeInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be a non-negative integer.", requestId });
  }
  return value as number;
}

function requiredInteger(value: unknown, field: string, requestId: EntityId): number {
  if (!Number.isSafeInteger(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an integer.", requestId });
  }
  return value as number;
}

function requiredObject(value: unknown, field: string, requestId: EntityId): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an object.", requestId });
  }
  return value as Readonly<Record<string, unknown>>;
}

function requiredObjectArray(value: unknown, field: string, requestId: EntityId): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || !value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an array of objects.", requestId });
  }
  return value as readonly Readonly<Record<string, unknown>>[];
}

function requiredStringArray(value: unknown, field: string, requestId: EntityId): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new AppError({ code: "VALIDATION_ERROR", message: field + " must be an array of strings.", requestId });
  }
  return value as readonly string[];
}

function requiredResourceType(value: unknown, requestId: EntityId): "offering" | "product_variant" | "service" {
  if (value === "offering" || value === "product_variant" || value === "service") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "resourceType is invalid.", requestId });
}

function requiredFulfillmentPolicyResourceType(value: unknown, requestId: EntityId): "product" | "product_variant" | "offering" {
  if (value === "product" || value === "product_variant" || value === "offering") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "resourceType is invalid.", requestId });
}

function requiredReturnFees(value: unknown, requestId: EntityId): "FreeReturn" | "ReturnFeesCustomerResponsibility" | "ReturnShippingFees" {
  if (value === "FreeReturn" || value === "ReturnFeesCustomerResponsibility" || value === "ReturnShippingFees") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "returnFees is invalid.", requestId });
}

function requiredReturnMethod(value: unknown, requestId: EntityId): "ReturnByMail" | "ReturnInStore" | "ReturnAtKiosk" {
  if (value === "ReturnByMail" || value === "ReturnInStore" || value === "ReturnAtKiosk") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "returnMethod is invalid.", requestId });
}

function requiredFulfillmentPolicyStatus(value: unknown, requestId: EntityId): "draft" | "active" | "retired" {
  if (value === "draft" || value === "active" || value === "retired") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}

function requiredSourceChannel(value: unknown, requestId: EntityId): "web" | "app" | "agent" | "api" | "ai_tool" {
  if (value === "web" || value === "app" || value === "agent" || value === "api" || value === "ai_tool") return value;
  throw new AppError({ code: "VALIDATION_ERROR", message: "sourceChannel is invalid.", requestId });
}

function requiredOrderStatus(value: unknown, requestId: EntityId): OrderStatus {
  const statuses: readonly OrderStatus[] = [
    "draft",
    "pending_confirmation",
    "pending_payment",
    "confirmed",
    "in_fulfillment",
    "completed",
    "cancelled",
    "refund_pending",
    "refunded",
  ];
  if (typeof value === "string" && statuses.includes(value as OrderStatus)) return value as OrderStatus;
  throw new AppError({ code: "VALIDATION_ERROR", message: "status is invalid.", requestId });
}

function requiredIdempotencyKey(request: Request, requestId: EntityId): string {
  const value = request.headers.get("idempotency-key")?.trim();
  if (!value) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is required.", requestId });
  if (value.length > 200) throw new AppError({ code: "VALIDATION_ERROR", message: "Idempotency-Key header is too long.", requestId });
  return value;
}


function parseOfferAudienceType(
  value: unknown,
  requestId: RequestContext["requestId"],
): "customer" | "group" | "general" {
  if (value === "customer" || value === "group" || value === "general") return value;
  throw new AppError({
    code: "VALIDATION_ERROR",
    message: "audienceType must be customer, group, or general.",
    requestId,
  });
}
