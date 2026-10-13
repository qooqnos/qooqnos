import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CommerceRepository } from "./repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "commerce",
    operation: "commerce.order.create",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CommerceRepository", () => {
  it("rejects non-ISO currency values", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CommerceRepository(new D1Database(raw));

    await expect(repository.createCart(context(), {
      id: brandId<"EntityId">("cart-1"),
      actorReference: "user-1",
      currency: "BAD!",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("3-letter ISO currency code");
  });

  it("preserves checkout idempotency for repeated starts", async () => {
    let inserts = 0;
    const existing = {
      id: "checkout-1",
      cartId: "cart-1",
      status: "started",
      idempotencyKey: "idem-1",
      correlationId: "corr-1",
      catalogSnapshotRefsJson: "[]",
      promotionQualificationRefsJson: "[]",
      loyaltyBenefitRefsJson: "[]",
      bookingReservationRefsJson: "[]",
      paymentAttemptRef: null,
      failureCode: null,
      startedAt: "2026-09-22T00:00:00.000Z",
      completedAt: null,
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return existing as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { inserts += 1; return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CommerceRepository(new D1Database(raw));
    const result = await repository.startCheckout(context(), {
      id: brandId<"EntityId">("checkout-1"),
      cartId: brandId<"EntityId">("cart-1"),
      idempotencyKey: "idem-1",
      correlationId: "corr-1",
      now: "2026-09-22T00:00:00.000Z",
    });

    expect(result.id).toBe("checkout-1");
    expect(inserts).toBe(0);
  });

  it("lists orders within the active tenant, workspace and business", async () => {
    let bound: unknown[] = [];
    const statement: D1PreparedStatementLike = {
      bind(...args: unknown[]) {
        bound = args;
        return this;
      },
      async first<T>() { return null as T | null; },
      async all<T>() {
        return {
          results: [{
            id: "order-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            businessId: "business-1",
            customerId: "customer-1",
            matchRequestId: null,
            matchCandidateId: null,
            priceSnapshotId: null,
            status: "confirmed",
            currency: "AZN",
            subtotalMinor: 1000,
            adjustmentTotalMinor: 0,
            taxTotalMinor: 0,
            feeTotalMinor: 0,
            grandTotalMinor: 1000,
            paymentStatusRef: null,
            fulfillmentStatusRef: null,
            sourceChannel: "web",
            policyVersion: "v1",
            idempotencyKey: "idem-1",
            correlationId: "corr-1",
            createdAt: "2026-09-29T00:00:00.000Z",
            updatedAt: "2026-09-29T00:00:00.000Z",
            confirmedAt: null,
            completedAt: null,
          }] as T[],
        };
      },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CommerceRepository(new D1Database(raw));

    const orders = await repository.listOrders(context(), brandId<"EntityId">("business-1"), 100);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.id).toBe("order-1");
    expect(bound).toEqual(["tenant-1", "workspace-1", "business-1", 50]);
  });

  it("rejects malformed stored Commerce snapshot JSON", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "snapshot-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          currency: "AZN",
          lineSnapshotsJson: "{bad",
          subtotalMinor: 100,
          adjustmentTotalMinor: 0,
          taxTotalMinor: 0,
          feeTotalMinor: 0,
          grandTotalMinor: 100,
          catalogVersionRefsJson: "[]",
          promotionVersionRefsJson: "[]",
          loyaltyVersionRefsJson: "[]",
          policyVersion: "p1",
          calculatedAt: "2026-09-22T00:00:00.000Z",
          calculationContextHash: "hash-1",
          createdAt: "2026-09-22T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CommerceRepository(new D1Database(raw));

    await expect(repository.createPriceSnapshot(context(), {
      id: brandId<"EntityId">("snapshot-1"),
      currency: "AZN",
      lineSnapshots: [{ line: 1 }],
      subtotalMinor: 100,
      adjustmentTotalMinor: 0,
      taxTotalMinor: 0,
      feeTotalMinor: 0,
      grandTotalMinor: 100,
      policyVersion: "p1",
      calculatedAt: "2026-09-22T00:00:00.000Z",
      calculationContextHash: "hash-1",
      now: "2026-09-22T00:00:01.000Z",
    })).rejects.toThrow("snapshot is invalid");
  });

  it("creates and retrieves a unified commerce offer", async () => {
    const store = new Map<string, unknown>();
    let boundParams: readonly unknown[] = [];
    const statement: D1PreparedStatementLike = {
      bind(...params: readonly unknown[]) {
        boundParams = params;
        return this;
      },
      async first<T>(): Promise<T | null> {
        const id = boundParams[0] as string | undefined;
        return (id ? (store.get(id) ?? null) : null) as T | null;
      },
      async all<T>(): Promise<{ results: T[] }> {
        return { results: Array.from(store.values()) as T[] };
      },
      async run(): Promise<{ success: boolean }> {
        const p = boundParams;
        if (p && p.length > 5) {
          const row = {
            id: p[0],
            organization_id: p[1],
            workspace_id: p[2],
            seller_id: p[3],
            product_id: p[4],
            variant_id: p[5],
            audience_type: p[6],
            customer_group: p[7],
            customer_id: p[8],
            available: p[9],
            price_amount_minor: p[10],
            currency: p[11],
            min_quantity: p[12],
            max_quantity: p[13],
            effective_from: p[14],
            effective_to: p[15],
            digital_entitlement_id: p[16],
            conditions_json: p[17],
            status: p[18],
            created_at: p[19],
            updated_at: p[20],
          };
          store.set(String(row.id), row);
        }
        return { success: true };
      },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CommerceRepository(new D1Database(raw));

    const offer = await repository.createOffer(context(), {
      id: brandId<"EntityId">("offer-1"),
      sellerId: brandId<"EntityId">("business-1"),
      productId: brandId<"EntityId">("product-1"),
      audienceType: "group",
      customerGroup: "partner",
      available: true,
      priceAmountMinor: 2150000,
      currency: "IRR",
      minQuantity: 1,
      now: "2026-01-01T00:00:00Z",
    });

    expect(offer.id).toBe("offer-1");
    expect(offer.seller_id).toBe("business-1");
    expect(offer.price_amount_minor).toBe(2150000);
    expect(offer.customer_group).toBe("partner");
    expect(offer.available).toBe(1);
  });
});
