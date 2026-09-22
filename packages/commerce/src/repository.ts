import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type CartStatus = "active" | "expired" | "converted" | "abandoned";
export type CheckoutStatus = "started" | "validating" | "committed" | "failed" | "expired";
export type OrderStatus =
  | "draft"
  | "pending_confirmation"
  | "pending_payment"
  | "confirmed"
  | "in_fulfillment"
  | "completed"
  | "cancelled"
  | "refund_pending"
  | "refunded";

export interface CartRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly customerId: EntityId | null;
  readonly actorReference: string;
  readonly status: CartStatus;
  readonly currency: string;
  readonly version: number;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CartLineRecord {
  readonly id: EntityId;
  readonly cartId: EntityId;
  readonly resourceType: "offering" | "product_variant" | "service";
  readonly resourceId: EntityId;
  readonly variantReference: string | null;
  readonly quantity: number;
  readonly selectedOptions: Readonly<Record<string, unknown>> | null;
  readonly sourceReference: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CheckoutSessionRecord {
  readonly id: EntityId;
  readonly cartId: EntityId;
  readonly status: CheckoutStatus;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly catalogSnapshotRefs: readonly string[];
  readonly promotionQualificationRefs: readonly string[];
  readonly loyaltyBenefitRefs: readonly string[];
  readonly bookingReservationRefs: readonly string[];
  readonly paymentAttemptRef: string | null;
  readonly failureCode: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PriceSnapshotRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly currency: string;
  readonly lineSnapshots: readonly Readonly<Record<string, unknown>>[];
  readonly subtotalMinor: number;
  readonly adjustmentTotalMinor: number;
  readonly taxTotalMinor: number;
  readonly feeTotalMinor: number;
  readonly grandTotalMinor: number;
  readonly catalogVersionRefs: readonly string[];
  readonly promotionVersionRefs: readonly string[];
  readonly loyaltyVersionRefs: readonly string[];
  readonly policyVersion: string;
  readonly calculatedAt: string;
  readonly calculationContextHash: string;
  readonly createdAt: string;
}

export interface OrderRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly businessId: EntityId;
  readonly customerId: EntityId;
  readonly priceSnapshotId: EntityId | null;
  readonly status: OrderStatus;
  readonly currency: string;
  readonly subtotalMinor: number;
  readonly adjustmentTotalMinor: number;
  readonly taxTotalMinor: number;
  readonly feeTotalMinor: number;
  readonly grandTotalMinor: number;
  readonly paymentStatusRef: string | null;
  readonly fulfillmentStatusRef: string | null;
  readonly sourceChannel: "web" | "app" | "agent" | "api" | "ai_tool";
  readonly policyVersion: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly confirmedAt: string | null;
  readonly completedAt: string | null;
}

export interface OrderLineRecord {
  readonly id: EntityId;
  readonly orderId: EntityId;
  readonly resourceType: "offering" | "product_variant" | "service";
  readonly resourceId: EntityId;
  readonly resourceVersion: string | null;
  readonly variantReference: string | null;
  readonly descriptionSnapshot: string;
  readonly quantity: number;
  readonly unitPriceMinorSnapshot: number;
  readonly lineSubtotalMinor: number;
  readonly lineAdjustmentTotalMinor: number;
  readonly lineTotalMinor: number;
  readonly promotionReference: string | null;
  readonly loyaltyReference: string | null;
  readonly bookingReference: string | null;
  readonly fulfillmentReference: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCartInput {
  readonly id: EntityId;
  readonly customerId?: EntityId | undefined;
  readonly actorReference: string;
  readonly currency: string;
  readonly expiresAt?: string | undefined;
  readonly now: string;
}

export interface AddCartLineInput {
  readonly id: EntityId;
  readonly cartId: EntityId;
  readonly resourceType: CartLineRecord["resourceType"];
  readonly resourceId: EntityId;
  readonly variantReference?: string | undefined;
  readonly quantity: number;
  readonly selectedOptions?: Readonly<Record<string, unknown>> | undefined;
  readonly sourceReference?: string | undefined;
  readonly now: string;
}

export interface StartCheckoutInput {
  readonly id: EntityId;
  readonly cartId: EntityId;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly now: string;
}

export interface CreatePriceSnapshotInput {
  readonly id: EntityId;
  readonly currency: string;
  readonly lineSnapshots: readonly Readonly<Record<string, unknown>>[];
  readonly subtotalMinor: number;
  readonly adjustmentTotalMinor: number;
  readonly taxTotalMinor: number;
  readonly feeTotalMinor: number;
  readonly grandTotalMinor: number;
  readonly catalogVersionRefs?: readonly string[] | undefined;
  readonly promotionVersionRefs?: readonly string[] | undefined;
  readonly loyaltyVersionRefs?: readonly string[] | undefined;
  readonly policyVersion: string;
  readonly calculatedAt: string;
  readonly calculationContextHash: string;
  readonly now: string;
}

export interface CreateOrderInput {
  readonly id: EntityId;
  readonly businessId: EntityId;
  readonly customerId: EntityId;
  readonly priceSnapshotId?: EntityId | undefined;
  readonly currency: string;
  readonly subtotalMinor: number;
  readonly adjustmentTotalMinor: number;
  readonly taxTotalMinor: number;
  readonly feeTotalMinor: number;
  readonly grandTotalMinor: number;
  readonly sourceChannel: OrderRecord["sourceChannel"];
  readonly policyVersion: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly now: string;
}

export interface AddOrderLineInput {
  readonly id: EntityId;
  readonly orderId: EntityId;
  readonly resourceType: OrderLineRecord["resourceType"];
  readonly resourceId: EntityId;
  readonly resourceVersion?: string | undefined;
  readonly variantReference?: string | undefined;
  readonly descriptionSnapshot: string;
  readonly quantity: number;
  readonly unitPriceMinorSnapshot: number;
  readonly lineSubtotalMinor: number;
  readonly lineAdjustmentTotalMinor: number;
  readonly lineTotalMinor: number;
  readonly promotionReference?: string | undefined;
  readonly loyaltyReference?: string | undefined;
  readonly bookingReference?: string | undefined;
  readonly fulfillmentReference?: string | undefined;
  readonly now: string;
}

export class CommerceRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async createCart(context: RequestContext, input: CreateCartInput): Promise<CartRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    if (!input.actorReference.trim()) throw new DatabaseError("Commerce cart actor reference is required");
    const currency = normalizeCurrency(input.currency);

    await this.database.run(
      "INSERT INTO commerce_carts (id, organization_id, workspace_id, customer_id, actor_reference, status, currency, version, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, 1, ?, ?, ?)",
      input.id,
      organizationId,
      workspaceId,
      input.customerId ?? null,
      input.actorReference.trim(),
      currency,
      input.expiresAt ?? null,
      input.now,
      input.now,
    );
    const cart = await this.getCart(context, input.id);
    if (!cart) throw new DatabaseError("Commerce cart not found after creation");
    return cart;
  }

  async getCart(context: RequestContext, id: EntityId): Promise<CartRecord | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    return this.database.first<CartRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, customer_id AS customerId, actor_reference AS actorReference, status, currency, version, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt FROM commerce_carts WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,
      organizationId,
      workspaceId,
    );
  }

  async addCartLine(context: RequestContext, input: AddCartLineInput): Promise<CartLineRecord> {
    const cart = await this.getCart(context, input.cartId);
    if (!cart) throw new DatabaseError("Commerce cart not found");
    if (cart.status !== "active") throw new DatabaseError("Only active carts can be modified");
    if (input.quantity < 1) throw new DatabaseError("Cart quantity must be positive");
    await this.database.run(
      "INSERT INTO commerce_cart_lines (id, cart_id, resource_type, resource_id, variant_reference, quantity, selected_options_json, source_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.cartId,
      input.resourceType,
      input.resourceId,
      input.variantReference ?? null,
      input.quantity,
      input.selectedOptions ? JSON.stringify(input.selectedOptions) : null,
      input.sourceReference ?? null,
      input.now,
      input.now,
    );
    const line = await this.database.first<CartLineRecord & { selectedOptionsJson: string | null }>(
      "SELECT id, cart_id AS cartId, resource_type AS resourceType, resource_id AS resourceId, variant_reference AS variantReference, quantity, selected_options_json AS selectedOptionsJson, source_reference AS sourceReference, created_at AS createdAt, updated_at AS updatedAt FROM commerce_cart_lines WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!line) throw new DatabaseError("Commerce cart line not found after creation");
    return { ...line, selectedOptions: parseObject(line.selectedOptionsJson) };
  }

  async listCartLines(context: RequestContext, cartId: EntityId): Promise<readonly CartLineRecord[]> {
    const cart = await this.getCart(context, cartId);
    if (!cart) throw new DatabaseError("Commerce cart not found");
    const rows = await this.database.all<CartLineRecord & { selectedOptionsJson: string | null }>(
      "SELECT id, cart_id AS cartId, resource_type AS resourceType, resource_id AS resourceId, variant_reference AS variantReference, quantity, selected_options_json AS selectedOptionsJson, source_reference AS sourceReference, created_at AS createdAt, updated_at AS updatedAt FROM commerce_cart_lines WHERE cart_id = ? ORDER BY created_at ASC, id ASC",
      cartId,
    );
    return rows.map((row) => ({ ...row, selectedOptions: parseObject(row.selectedOptionsJson) }));
  }

  async startCheckout(context: RequestContext, input: StartCheckoutInput): Promise<CheckoutSessionRecord> {
    const cart = await this.getCart(context, input.cartId);
    if (!cart) throw new DatabaseError("Commerce cart not found");
    if (cart.status !== "active") throw new DatabaseError("Only active carts can enter checkout");
    if (!input.idempotencyKey.trim()) throw new DatabaseError("Checkout idempotency key is required");
    const existing = await this.database.first<CheckoutSessionRow>(
      "SELECT id, cart_id AS cartId, status, idempotency_key AS idempotencyKey, correlation_id AS correlationId, catalog_snapshot_refs_json AS catalogSnapshotRefsJson, promotion_qualification_refs_json AS promotionQualificationRefsJson, loyalty_benefit_refs_json AS loyaltyBenefitRefsJson, booking_reservation_refs_json AS bookingReservationRefsJson, payment_attempt_ref AS paymentAttemptRef, failure_code AS failureCode, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM commerce_checkout_sessions WHERE cart_id = ? AND idempotency_key = ? LIMIT 1",
      input.cartId,
      input.idempotencyKey.trim(),
    );
    if (existing) return hydrateCheckout(existing);

    await this.database.run(
      "INSERT INTO commerce_checkout_sessions (id, cart_id, status, idempotency_key, correlation_id, started_at, created_at, updated_at) VALUES (?, ?, 'started', ?, ?, ?, ?, ?)",
      input.id,
      input.cartId,
      input.idempotencyKey.trim(),
      input.correlationId,
      input.now,
      input.now,
      input.now,
    );
    const row = await this.database.first<CheckoutSessionRow>(
      "SELECT id, cart_id AS cartId, status, idempotency_key AS idempotencyKey, correlation_id AS correlationId, catalog_snapshot_refs_json AS catalogSnapshotRefsJson, promotion_qualification_refs_json AS promotionQualificationRefsJson, loyalty_benefit_refs_json AS loyaltyBenefitRefsJson, booking_reservation_refs_json AS bookingReservationRefsJson, payment_attempt_ref AS paymentAttemptRef, failure_code AS failureCode, started_at AS startedAt, completed_at AS completedAt, created_at AS createdAt, updated_at AS updatedAt FROM commerce_checkout_sessions WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Commerce checkout session not found after creation");
    return hydrateCheckout(row);
  }

  async createPriceSnapshot(context: RequestContext, input: CreatePriceSnapshotInput): Promise<PriceSnapshotRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    validateMoney(input.subtotalMinor, "subtotal");
    validateMoney(input.adjustmentTotalMinor, "adjustmentTotal", true);
    validateMoney(input.taxTotalMinor, "taxTotal");
    validateMoney(input.feeTotalMinor, "feeTotal");
    validateMoney(input.grandTotalMinor, "grandTotal");
    if (!input.policyVersion.trim()) throw new DatabaseError("Commerce policy version is required");
    if (!input.calculationContextHash.trim()) throw new DatabaseError("Commerce calculation context hash is required");

    await this.database.run(
      "INSERT INTO commerce_price_snapshots (id, organization_id, workspace_id, currency, line_snapshots_json, subtotal_minor, adjustment_total_minor, tax_total_minor, fee_total_minor, grand_total_minor, catalog_version_refs_json, promotion_version_refs_json, loyalty_version_refs_json, policy_version, calculated_at, calculation_context_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      organizationId,
      workspaceId,
      normalizeCurrency(input.currency),
      JSON.stringify(input.lineSnapshots),
      input.subtotalMinor,
      input.adjustmentTotalMinor,
      input.taxTotalMinor,
      input.feeTotalMinor,
      input.grandTotalMinor,
      JSON.stringify(input.catalogVersionRefs ?? []),
      JSON.stringify(input.promotionVersionRefs ?? []),
      JSON.stringify(input.loyaltyVersionRefs ?? []),
      input.policyVersion.trim(),
      input.calculatedAt,
      input.calculationContextHash.trim(),
      input.now,
    );
    const row = await this.database.first<PriceSnapshotRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, currency, line_snapshots_json AS lineSnapshotsJson, subtotal_minor AS subtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_total_minor AS taxTotalMinor, fee_total_minor AS feeTotalMinor, grand_total_minor AS grandTotalMinor, catalog_version_refs_json AS catalogVersionRefsJson, promotion_version_refs_json AS promotionVersionRefsJson, loyalty_version_refs_json AS loyaltyVersionRefsJson, policy_version AS policyVersion, calculated_at AS calculatedAt, calculation_context_hash AS calculationContextHash, created_at AS createdAt FROM commerce_price_snapshots WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Commerce price snapshot not found after creation");
    return hydratePriceSnapshot(row);
  }

  async createOrder(context: RequestContext, input: CreateOrderInput): Promise<OrderRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    validateMoney(input.subtotalMinor, "subtotal");
    validateMoney(input.adjustmentTotalMinor, "adjustmentTotal", true);
    validateMoney(input.taxTotalMinor, "taxTotal");
    validateMoney(input.feeTotalMinor, "feeTotal");
    validateMoney(input.grandTotalMinor, "grandTotal");
    if (!input.policyVersion.trim()) throw new DatabaseError("Commerce policy version is required");

    const existing = await this.getOrderByIdempotency(context, input.idempotencyKey);
    if (existing) {
      await this.database.run(
        "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'commerce.order.created', 1, 'commerce_order', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        existing.id + ":created",
        existing.id,
        existing.organizationId,
        existing.workspaceId,
        JSON.stringify({ orderId: existing.id, sourceChannel: existing.sourceChannel }),
        existing.createdAt,
        existing.createdAt,
      );
      return existing;
    }

    const now = input.now;
    const orderId = input.id;
    await this.database.transaction([
      {
        sql: "INSERT OR IGNORE INTO commerce_orders (id, organization_id, workspace_id, business_id, customer_id, price_snapshot_id, status, currency, subtotal_minor, adjustment_total_minor, tax_total_minor, fee_total_minor, grand_total_minor, source_channel, policy_version, idempotency_key, correlation_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          orderId,
          organizationId,
          workspaceId,
          input.businessId,
          input.customerId,
          input.priceSnapshotId ?? null,
          normalizeCurrency(input.currency),
          input.subtotalMinor,
          input.adjustmentTotalMinor,
          input.taxTotalMinor,
          input.feeTotalMinor,
          input.grandTotalMinor,
          input.sourceChannel,
          input.policyVersion.trim(),
          input.idempotencyKey.trim(),
          input.correlationId,
          now,
          now,
        ],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, 'commerce.order.created', 1, 'commerce_order', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          orderId + ":created",
          orderId,
          organizationId,
          workspaceId,
          JSON.stringify({ orderId, sourceChannel: input.sourceChannel }),
          now,
          now,
        ],
      },
    ]);

    const order = await this.getOrder(context, orderId);
    if (!order) throw new DatabaseError("Commerce order not found after creation");
    return order;
  }
  async getOrderByIdempotency(context: RequestContext, idempotencyKey: string): Promise<OrderRecord | null> {
    if (!idempotencyKey.trim()) return null;
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<OrderRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, customer_id AS customerId, price_snapshot_id AS priceSnapshotId, status, currency, subtotal_minor AS subtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_total_minor AS taxTotalMinor, fee_total_minor AS feeTotalMinor, grand_total_minor AS grandTotalMinor, payment_status_ref AS paymentStatusRef, fulfillment_status_ref AS fulfillmentStatusRef, source_channel AS sourceChannel, policy_version AS policyVersion, idempotency_key AS idempotencyKey, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt, confirmed_at AS confirmedAt, completed_at AS completedAt FROM commerce_orders WHERE organization_id = ? AND workspace_id = ? AND idempotency_key = ? LIMIT 1",
      organizationId,
      workspaceId,
      idempotencyKey.trim(),
    );
  }

  async getOrder(context: RequestContext, id: EntityId): Promise<OrderRecord | null> {
    return this.database.first<OrderRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, customer_id AS customerId, price_snapshot_id AS priceSnapshotId, status, currency, subtotal_minor AS subtotalMinor, adjustment_total_minor AS adjustmentTotalMinor, tax_total_minor AS taxTotalMinor, fee_total_minor AS feeTotalMinor, grand_total_minor AS grandTotalMinor, payment_status_ref AS paymentStatusRef, fulfillment_status_ref AS fulfillmentStatusRef, source_channel AS sourceChannel, policy_version AS policyVersion, idempotency_key AS idempotencyKey, correlation_id AS correlationId, created_at AS createdAt, updated_at AS updatedAt, confirmed_at AS confirmedAt, completed_at AS completedAt FROM commerce_orders WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
  }

  async addOrderLine(context: RequestContext, input: AddOrderLineInput): Promise<OrderLineRecord> {
    const order = await this.getOrder(context, input.orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    if (order.status !== "draft" && order.status !== "pending_confirmation") {
      throw new DatabaseError("Committed Commerce order lines are immutable");
    }
    if (input.quantity < 1) throw new DatabaseError("Order line quantity must be positive");
    if (!input.descriptionSnapshot.trim()) throw new DatabaseError("Order line description snapshot is required");
    for (const [name, value] of [
      ["unitPrice", input.unitPriceMinorSnapshot],
      ["lineSubtotal", input.lineSubtotalMinor],
      ["lineAdjustment", input.lineAdjustmentTotalMinor],
      ["lineTotal", input.lineTotalMinor],
    ] as const) validateMoney(value, name, name === "lineAdjustment");

    await this.database.run(
      "INSERT INTO commerce_order_lines (id, order_id, resource_type, resource_id, resource_version, variant_reference, description_snapshot, quantity, unit_price_minor_snapshot, line_subtotal_minor, line_adjustment_total_minor, line_total_minor, promotion_reference, loyalty_reference, booking_reference, fulfillment_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.orderId,
      input.resourceType,
      input.resourceId,
      input.resourceVersion ?? null,
      input.variantReference ?? null,
      input.descriptionSnapshot.trim(),
      input.quantity,
      input.unitPriceMinorSnapshot,
      input.lineSubtotalMinor,
      input.lineAdjustmentTotalMinor,
      input.lineTotalMinor,
      input.promotionReference ?? null,
      input.loyaltyReference ?? null,
      input.bookingReference ?? null,
      input.fulfillmentReference ?? null,
      input.now,
      input.now,
    );
    const row = await this.database.first<OrderLineRecord>(
      "SELECT id, order_id AS orderId, resource_type AS resourceType, resource_id AS resourceId, resource_version AS resourceVersion, variant_reference AS variantReference, description_snapshot AS descriptionSnapshot, quantity, unit_price_minor_snapshot AS unitPriceMinorSnapshot, line_subtotal_minor AS lineSubtotalMinor, line_adjustment_total_minor AS lineAdjustmentTotalMinor, line_total_minor AS lineTotalMinor, promotion_reference AS promotionReference, loyalty_reference AS loyaltyReference, booking_reference AS bookingReference, fulfillment_reference AS fulfillmentReference, created_at AS createdAt, updated_at AS updatedAt FROM commerce_order_lines WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Commerce order line not found after creation");
    return row;
  }


  async listOrderLines(
    context: RequestContext,
    orderId: EntityId,
  ): Promise<readonly OrderLineRecord[]> {
    const order = await this.getOrder(context, orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    return this.database.all<OrderLineRecord>(
      "SELECT id, order_id AS orderId, resource_type AS resourceType, resource_id AS resourceId, resource_version AS resourceVersion, variant_reference AS variantReference, description_snapshot AS descriptionSnapshot, quantity, unit_price_minor_snapshot AS unitPriceMinorSnapshot, line_subtotal_minor AS lineSubtotalMinor, line_adjustment_total_minor AS lineAdjustmentTotalMinor, line_total_minor AS lineTotalMinor, promotion_reference AS promotionReference, loyalty_reference AS loyaltyReference, booking_reference AS bookingReference, fulfillment_reference AS fulfillmentReference, created_at AS createdAt, updated_at AS updatedAt FROM commerce_order_lines WHERE order_id = ? ORDER BY created_at ASC, id ASC",
      orderId,
    );
  }

  async addOrderAdjustment(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly orderId: EntityId;
      readonly orderLineId?: EntityId | undefined;
      readonly adjustmentType: "promotion" | "loyalty" | "fee" | "tax" | "manual_approved";
      readonly sourceModule: string;
      readonly sourceReference: string;
      readonly amountMinor: number;
      readonly currency: string;
      readonly policyVersion: string;
      readonly now: string;
    },
  ): Promise<void> {
    const order = await this.getOrder(context, input.orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    if (order.status !== "draft" && order.status !== "pending_confirmation") {
      throw new DatabaseError("Order adjustments are immutable after commitment");
    }
    validateMoney(input.amountMinor, "adjustment", true);
    if (!input.sourceModule.trim() || !input.sourceReference.trim()) {
      throw new DatabaseError("Commerce adjustment source is required");
    }

    await this.database.run(
      "INSERT INTO commerce_order_adjustments (id, order_id, order_line_id, adjustment_type, source_module, source_reference, amount_minor, currency, policy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.orderId,
      input.orderLineId ?? null,
      input.adjustmentType,
      input.sourceModule.trim(),
      input.sourceReference.trim(),
      input.amountMinor,
      normalizeCurrency(input.currency),
      input.policyVersion.trim(),
      input.now,
    );
  }

  async recordTransactionAttempt(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly orderId: EntityId;
      readonly attemptType: string;
      readonly attemptStatus: string;
      readonly idempotencyKey: string;
      readonly providerReference?: string | undefined;
      readonly requestedAt: string;
      readonly completedAt?: string | undefined;
      readonly failureCode?: string | undefined;
      readonly correlationId: string;
      readonly now: string;
    },
  ): Promise<void> {
    const order = await this.getOrder(context, input.orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    if (!input.attemptType.trim() || !input.attemptStatus.trim()) {
      throw new DatabaseError("Commerce transaction attempt type/status are required");
    }
    await this.database.run(
      "INSERT INTO commerce_transaction_attempts (id, order_id, attempt_type, attempt_status, idempotency_key, provider_reference, requested_at, completed_at, failure_code, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.orderId,
      input.attemptType.trim(),
      input.attemptStatus.trim(),
      input.idempotencyKey.trim(),
      input.providerReference?.trim() || null,
      input.requestedAt,
      input.completedAt ?? null,
      input.failureCode?.trim() || null,
      input.correlationId,
      input.now,
    );
  }

  async recordFulfillmentReference(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly orderId: EntityId;
      readonly orderLineId?: EntityId | undefined;
      readonly fulfillmentType: string;
      readonly externalModule: string;
      readonly externalReference: string;
      readonly statusReference?: string | undefined;
      readonly now: string;
    },
  ): Promise<void> {
    const order = await this.getOrder(context, input.orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    if (!input.externalModule.trim() || !input.externalReference.trim()) {
      throw new DatabaseError("Commerce fulfillment external reference is required");
    }
    await this.database.run(
      "INSERT INTO commerce_fulfillment_references (id, order_id, order_line_id, fulfillment_type, external_module, external_reference, status_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.orderId,
      input.orderLineId ?? null,
      input.fulfillmentType.trim(),
      input.externalModule.trim(),
      input.externalReference.trim(),
      input.statusReference?.trim() || null,
      input.now,
      input.now,
    );
  }

  async requestCancellation(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly orderId: EntityId;
      readonly requestedBy: string;
      readonly reasonCode: string;
      readonly policyVersion: string;
      readonly decision: string;
      readonly effectiveAt: string;
      readonly correlationId: string;
      readonly now: string;
    },
  ): Promise<void> {
    const order = await this.getOrder(context, input.orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    if (isTerminalOrderStatus(order.status) && order.status !== "cancelled") {
      throw new DatabaseError("Terminal Commerce order cannot be cancelled");
    }
    await this.database.run(
      "INSERT INTO commerce_cancellations (id, order_id, requested_by, reason_code, policy_version, decision, effective_at, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.orderId,
      input.requestedBy.trim(),
      input.reasonCode.trim(),
      input.policyVersion.trim(),
      input.decision.trim(),
      input.effectiveAt,
      input.correlationId,
      input.now,
    );
  }

  async requestRefundReference(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly orderId: EntityId;
      readonly requestedAmountMinor: number;
      readonly currency: string;
      readonly reasonCode: string;
      readonly billingReference: string;
      readonly refundStatus: string;
      readonly requestedAt: string;
      readonly completedAt?: string | undefined;
      readonly correlationId: string;
      readonly now: string;
    },
  ): Promise<void> {
    const order = await this.getOrder(context, input.orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    if (input.requestedAmountMinor <= 0) throw new DatabaseError("Commerce refund amount must be positive");
    if (!input.billingReference.trim()) throw new DatabaseError("Billing refund reference is required");
    await this.database.run(
      "INSERT INTO commerce_refund_references (id, order_id, requested_amount_minor, currency, reason_code, billing_reference, refund_status, requested_at, completed_at, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.orderId,
      input.requestedAmountMinor,
      normalizeCurrency(input.currency),
      input.reasonCode.trim(),
      input.billingReference.trim(),
      input.refundStatus.trim(),
      input.requestedAt,
      input.completedAt ?? null,
      input.correlationId,
      input.now,
    );
  }

  async setOrderStatus(context: RequestContext, id: EntityId, status: OrderStatus, now: string): Promise<OrderRecord> {
    const current = await this.getOrder(context, id);
    if (!current) throw new DatabaseError("Commerce order not found");
    if (isTerminalOrderStatus(current.status) && current.status !== status) {
      throw new DatabaseError("Terminal Commerce order cannot be reopened");
    }
    if (current.status === status) return current;

    const confirmedAt = status === "confirmed" && !current.confirmedAt ? now : current.confirmedAt;
    const completedAt = status === "completed" && !current.completedAt ? now : current.completedAt;
    const eventType =
      status === "confirmed"
        ? "commerce.order.confirmed"
        : status === "cancelled"
          ? "commerce.order.cancelled"
          : status === "completed"
            ? "commerce.order.completed"
            : "commerce.order.status.changed";

    const results = await this.database.transaction([
      {
        sql: "UPDATE commerce_orders SET status = ?, confirmed_at = ?, completed_at = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND workspace_id = ? AND status = ?",
        params: [
          status,
          confirmedAt,
          completedAt,
          now,
          id,
          current.organizationId,
          current.workspaceId,
          current.status,
        ],
      },
      {
        sql: "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at) VALUES (?, ?, 1, 'commerce_order', ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)",
        params: [
          id + ":status:" + status + ":" + now,
          eventType,
          id,
          current.organizationId,
          current.workspaceId,
          JSON.stringify({ orderId: id, fromStatus: current.status, toStatus: status }),
          now,
          now,
        ],
      },
    ]);

    const update = results[0];
    if (!update || (update.meta?.changes ?? 0) !== 1) {
      const latest = await this.getOrder(context, id);
      if (latest?.status === status) return latest;
      throw new DatabaseError("Commerce order changed concurrently");
    }

    const updated = await this.getOrder(context, id);
    if (!updated) throw new DatabaseError("Commerce order not found after status update");
    return updated;
  }


  async appendOrderEvent(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly orderId: EntityId;
      readonly eventType: string;
      readonly eventVersion?: number | undefined;
      readonly actorReference?: string | undefined;
      readonly source: string;
      readonly occurredAt: string;
      readonly correlationId: string;
      readonly causationId?: string | undefined;
      readonly provenanceReference?: string | undefined;
      readonly payloadReference?: string | undefined;
      readonly now: string;
    },
  ): Promise<void> {
    const order = await this.getOrder(context, input.orderId);
    if (!order) throw new DatabaseError("Commerce order not found");
    await this.database.run(
      "INSERT INTO commerce_order_events (id, order_id, event_type, event_version, tenant_id, workspace_id, actor_reference, source, occurred_at, correlation_id, causation_id, provenance_reference, payload_reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.orderId,
      input.eventType.trim(),
      input.eventVersion ?? 1,
      order.organizationId,
      order.workspaceId,
      input.actorReference ?? null,
      input.source.trim(),
      input.occurredAt,
      input.correlationId,
      input.causationId ?? null,
      input.provenanceReference ?? null,
      input.payloadReference ?? null,
      input.now,
    );
  }
}

interface CheckoutSessionRow {
  readonly id: EntityId;
  readonly cartId: EntityId;
  readonly status: CheckoutStatus;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly catalogSnapshotRefsJson: string | null;
  readonly promotionQualificationRefsJson: string | null;
  readonly loyaltyBenefitRefsJson: string | null;
  readonly bookingReservationRefsJson: string | null;
  readonly paymentAttemptRef: string | null;
  readonly failureCode: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PriceSnapshotRow {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly currency: string;
  readonly lineSnapshotsJson: string;
  readonly subtotalMinor: number;
  readonly adjustmentTotalMinor: number;
  readonly taxTotalMinor: number;
  readonly feeTotalMinor: number;
  readonly grandTotalMinor: number;
  readonly catalogVersionRefsJson: string | null;
  readonly promotionVersionRefsJson: string | null;
  readonly loyaltyVersionRefsJson: string | null;
  readonly policyVersion: string;
  readonly calculatedAt: string;
  readonly calculationContextHash: string;
  readonly createdAt: string;
}

function hydrateCheckout(row: CheckoutSessionRow): CheckoutSessionRecord {
  return {
    id: row.id,
    cartId: row.cartId,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    catalogSnapshotRefs: parseStringArray(row.catalogSnapshotRefsJson),
    promotionQualificationRefs: parseStringArray(row.promotionQualificationRefsJson),
    loyaltyBenefitRefs: parseStringArray(row.loyaltyBenefitRefsJson),
    bookingReservationRefs: parseStringArray(row.bookingReservationRefsJson),
    paymentAttemptRef: row.paymentAttemptRef,
    failureCode: row.failureCode,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hydratePriceSnapshot(row: PriceSnapshotRow): PriceSnapshotRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    currency: row.currency,
    lineSnapshots: parseObjectArray(row.lineSnapshotsJson),
    subtotalMinor: row.subtotalMinor,
    adjustmentTotalMinor: row.adjustmentTotalMinor,
    taxTotalMinor: row.taxTotalMinor,
    feeTotalMinor: row.feeTotalMinor,
    grandTotalMinor: row.grandTotalMinor,
    catalogVersionRefs: parseStringArray(row.catalogVersionRefsJson),
    promotionVersionRefs: parseStringArray(row.promotionVersionRefsJson),
    loyaltyVersionRefs: parseStringArray(row.loyaltyVersionRefsJson),
    policyVersion: row.policyVersion,
    calculatedAt: row.calculatedAt,
    calculationContextHash: row.calculationContextHash,
    createdAt: row.createdAt,
  };
}

function parseStringArray(value: string | null): readonly string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error("invalid array");
    }
    return parsed;
  } catch {
    throw new DatabaseError("Stored Commerce reference list is invalid");
  }
}

function parseObject(value: string | null): Readonly<Record<string, unknown>> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Readonly<Record<string, unknown>>
      : null;
  } catch {
    throw new DatabaseError("Stored Commerce cart options are invalid");
  }
}

function parseObjectArray(value: string): readonly Readonly<Record<string, unknown>>[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      throw new Error("invalid array");
    }
    return parsed as readonly Readonly<Record<string, unknown>>[];
  } catch {
    throw new DatabaseError("Stored Commerce snapshot is invalid");
  }
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new DatabaseError("Commerce currency must be a 3-letter ISO currency code");
  return normalized;
}

function validateMoney(value: number, field: string, allowNegative = false): void {
  if (!Number.isSafeInteger(value)) throw new DatabaseError(\`Commerce \${field} must be an integer minor-unit value\`);
  if (!allowNegative && value < 0) throw new DatabaseError(\`Commerce \${field} cannot be negative\`);
}

function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === "completed" || status === "cancelled" || status === "refunded";
}
