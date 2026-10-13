import type { Offer } from "./types/offer";
import { OfferResolver } from "./services/offerResolver";
import {
  OfferController,
  type CreateOfferPayload,
  type UpdateOfferPayload,
  type DisableOfferPayload,
} from "./controllers/offerController";
import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import {
  CommerceRepository,
  type CartRecord,
  type CreateCartInput,
  type AddCartLineInput,
  type StartCheckoutInput,
  type CreatePriceSnapshotInput,
  type CreateOrderInput,
  type AddOrderLineInput,
  type OrderRecord,
  type OrderStatus,
  type FulfillmentPolicyRecord,
  type UpsertFulfillmentPolicyInput,
} from "./repository";

export interface CommerceServiceOptions {
  readonly repository: CommerceRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export interface ResolveOfferCommand {
  readonly customerId?: EntityId | string | undefined;
  readonly sellerId: EntityId | string;
  readonly productId: EntityId | string;
  readonly variantId?: EntityId | string | undefined;
  readonly customerGroup?: string | undefined;
  readonly asOf?: string | undefined;
}

export interface ResolveOfferResponse {
  readonly offer: Offer | null;
  readonly precedenceMatched?: "customer" | "group" | "general" | undefined;
  readonly isInheritedFromProduct?: boolean | undefined;
}

export interface CreateCartCommand {
  readonly customerId?: EntityId | undefined;
  readonly actorReference: string;
  readonly currency: string;
  readonly expiresAt?: string | undefined;
}

export class CommerceService {
  constructor(private readonly options: CommerceServiceOptions) {}

  async createCart(context: RequestContext, command: CreateCartCommand): Promise<CartRecord> {
    await this.options.authorization.assert({
      context,
      permission: "commerce.cart.create",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    const input: CreateCartInput = {
      id: this.options.id(),
      customerId: command.customerId,
      actorReference: command.actorReference,
      currency: command.currency,
      expiresAt: command.expiresAt,
      now: this.options.now(),
    };
    return this.options.repository.createCart(context, input);
  }

  async addCartLine(
    context: RequestContext,
    input: Omit<AddCartLineInput, "id" | "now">,
  ) {
    const cart = await this.options.repository.getCart(context, input.cartId);
    if (!cart) throw new Error("Commerce cart not found");
    await this.options.authorization.assert({
      context,
      permission: "commerce.cart.update",
      resource: { tenantId: cart.organizationId, ...(cart.workspaceId ? { workspaceId: cart.workspaceId } : {}) },
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.addCartLine(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async startCheckout(context: RequestContext, input: Omit<StartCheckoutInput, "id" | "correlationId" | "now">) {
    await this.options.authorization.assert({
      context,
      permission: "commerce.checkout.start",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.startCheckout(context, {
      ...input,
      id: this.options.id(),
      correlationId: context.correlationId,
      now: this.options.now(),
    });
  }

  async createPriceSnapshot(context: RequestContext, input: Omit<CreatePriceSnapshotInput, "id" | "now">) {
    await this.options.authorization.assert({
      context,
      permission: "commerce.checkout.start",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createPriceSnapshot(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createOrder(
    context: RequestContext,
    input: Omit<CreateOrderInput, "id" | "correlationId" | "now">,
  ): Promise<OrderRecord> {
    await this.options.authorization.assert({
      context,
      permission: "commerce.order.create",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.createOrder(context, {
      ...input,
      id: this.options.id(),
      correlationId: context.correlationId,
      now: this.options.now(),
    });
  }

  async addOrderLine(
    context: RequestContext,
    input: Omit<AddOrderLineInput, "id" | "now">,
  ) {
    const order = await this.options.repository.getOrder(context, input.orderId);
    if (!order) throw new Error("Commerce order not found");
    await this.options.authorization.assert({
      context,
      permission: "commerce.order.create",
      resource: { tenantId: order.organizationId, workspaceId: order.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.addOrderLine(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async upsertFulfillmentPolicy(
    context: RequestContext,
    input: Omit<UpsertFulfillmentPolicyInput, "id" | "now">,
  ): Promise<FulfillmentPolicyRecord> {
    await this.options.authorization.assert({
      context,
      permission: "commerce.fulfillment_policy.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.upsertFulfillmentPolicy(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

    /**
   * Endpoint / Service method to resolve the optimal Offer for a given product and customer context.
   * Accepts: customerId, sellerId, productId, and optional variantId.
   * Adheres to precedence rules: Customer > Group > General.
   */
  async resolveOffer(
    context: RequestContext,
    params: ResolveOfferCommand,
  ): Promise<ResolveOfferResponse> {
    // Public storefront resolution requires no assert if unauthenticated
    const resolver = new OfferResolver({ repository: this.options.repository, now: this.options.now });
    const detailed = await resolver.resolveOfferDetailed(context, params);
    if (!detailed) {
      return { offer: null };
    }
    return {
      offer: detailed.offer,
      precedenceMatched: detailed.precedenceMatched,
      isInheritedFromProduct: detailed.isInheritedFromProduct,
    };
  }

  private getOfferController(): OfferController {
    return new OfferController({
      repository: this.options.repository,
      idGenerator: this.options.id,
      now: this.options.now,
    });
  }

  async createOffer(context: RequestContext, payload: CreateOfferPayload): Promise<Offer> {
    await this.options.authorization.assert({
      context,
      permission: "commerce.offer.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.getOfferController().createOffer(context, payload);
  }

  async updateOffer(
    context: RequestContext,
    offerId: EntityId | string,
    payload: UpdateOfferPayload,
  ): Promise<Offer> {
    await this.options.authorization.assert({
      context,
      permission: "commerce.offer.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.getOfferController().updateOffer(context, offerId, payload);
  }

  async disableOffer(
    context: RequestContext,
    offerId: EntityId | string,
    payload?: DisableOfferPayload,
  ): Promise<Offer> {
    await this.options.authorization.assert({
      context,
      permission: "commerce.offer.manage",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.getOfferController().disableOffer(context, offerId, payload);
  }

  async getOffer(
    context: RequestContext,
    offerId: EntityId | string,
  ): Promise<Offer | null> {
    return this.getOfferController().getOffer(context, offerId);
  }
  async setOrderStatus(
    context: RequestContext,
    id: EntityId,
    status: OrderStatus,
  ): Promise<OrderRecord> {
    const order = await this.options.repository.getOrder(context, id);
    if (!order) throw new Error("Commerce order not found");
    const permission =
      status === "cancelled"
        ? "commerce.order.cancel"
        : status === "completed"
          ? "commerce.order.complete"
          : status === "refund_pending"
            ? "commerce.order.request_refund"
            : "commerce.order.create";
    await this.options.authorization.assert({
      context,
      permission,
      resource: { tenantId: order.organizationId, workspaceId: order.workspaceId },
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.setOrderStatus(context, id, status, this.options.now());
  }
}

export const COMMERCE_PERMISSIONS = [
  "commerce.cart.create",
  "commerce.cart.update",
  "commerce.cart.get",
  "commerce.cart.clear",
  "commerce.checkout.start",
  "commerce.checkout.confirm",
  "commerce.order.create",
  "commerce.order.get",
  "commerce.order.cancel",
  "commerce.order.amend",
  "commerce.order.request_refund",
  "commerce.order.complete",
  "commerce.fulfillment_policy.manage",
  "commerce.offer.resolve",
  "commerce.offer.manage",
] as const;
