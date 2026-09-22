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
} from "./repository";

export interface CommerceServiceOptions {
  readonly repository: CommerceRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
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
] as const;
