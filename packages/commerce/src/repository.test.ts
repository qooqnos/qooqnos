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
    const repository = new CommerceRepository({
      first: async () => null,
      all: async () => [],
      run: async () => ({ success: true }),
    } as never);

    await expect(repository.createCart(context(), {
      id: brandId<"EntityId">("cart-1"),
      actorReference: "user-1",
      currency: "bad",
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
});
