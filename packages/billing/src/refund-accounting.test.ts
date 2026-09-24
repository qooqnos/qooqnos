import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { RefundAccountingRepository } from "./refund-accounting";

const ctx: RequestContext = {
  requestId: brandId<"RequestId">("req-refund"),
  correlationId: brandId<"CorrelationId">("corr-refund"),
  actorId: brandId<"EntityId">("user-1"),
  tenantId: brandId<"EntityId">("tenant-1"),
  workspaceId: brandId<"EntityId">("workspace-1"),
  module: "billing",
  operation: "billing.refund.accounting",
  locale: "en",
  timezone: "UTC",
};

describe("RefundAccountingRepository", () => {
  it("creates an idempotent refund request with integer minor-unit money", async () => {
    let inserted = false;
    const row = {
      id: "refund-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      businessId: "business-1",
      paymentReference: "payment-1",
      orderReference: "order-1",
      requestedAmountMinor: 1250,
      refundedAmountMinor: 0,
      currency: "EUR",
      reasonCode: "customer_request",
      status: "requested" as const,
      provider: null,
      providerReference: null,
      providerStatus: null,
      ledgerTransactionId: null,
      requestedBy: "user-1",
      approvedBy: null,
      requestedAt: "2026-09-24T10:00:00.000Z",
      processedAt: null,
      completedAt: null,
      failureCode: null,
      correlationId: "corr-refund",
      idempotencyKey: "refund-1",
      createdAt: "2026-09-24T10:00:00.000Z",
      updatedAt: "2026-09-24T10:00:00.000Z",
    };
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return row as unknown as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { inserted = true; return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repo = new RefundAccountingRepository(new D1Database(raw));
    const result = await repo.createRefund(ctx, {
      id: brandId<"EntityId">("refund-1"),
      paymentReference: "payment-1",
      orderReference: "order-1",
      businessId: brandId<"EntityId">("business-1"),
      requestedAmountMinor: 1250,
      currency: "eur",
      reasonCode: "customer_request",
      idempotencyKey: "refund-1",
      requestedAt: row.requestedAt,
      now: row.createdAt,
    });
    expect(inserted).toBe(true);
    expect(result.currency).toBe("EUR");
    expect(result.status).toBe("requested");
  });

  it("rejects fractional refund amounts", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repo = new RefundAccountingRepository(new D1Database(raw));
    await expect(repo.createRefund(ctx, {
      id: brandId<"EntityId">("refund-2"),
      paymentReference: "payment-2",
      requestedAmountMinor: 10.5,
      currency: "EUR",
      reasonCode: "test",
      idempotencyKey: "refund-2",
      requestedAt: "2026-09-24T10:00:00.000Z",
      now: "2026-09-24T10:00:00.000Z",
    })).rejects.toThrow("positive integer minor-unit");
  });

  it("posts a balanced two-leg refund journal", async () => {
    const refund = {
      id: "refund-3",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      businessId: "business-1",
      paymentReference: "payment-3",
      orderReference: "order-3",
      requestedAmountMinor: 2500,
      refundedAmountMinor: 0,
      currency: "USD",
      reasonCode: "customer_request",
      status: "processing" as const,
      provider: null,
      providerReference: null,
      providerStatus: null,
      ledgerTransactionId: null,
      requestedBy: "user-1",
      approvedBy: "user-1",
      requestedAt: "2026-09-24T10:00:00.000Z",
      processedAt: null,
      completedAt: null,
      failureCode: null,
      correlationId: "corr-refund",
      idempotencyKey: "refund-3",
      createdAt: "2026-09-24T10:00:00.000Z",
      updatedAt: "2026-09-24T10:00:00.000Z",
    };
    let batches = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return refund as unknown as T; },
      async all<T>() {
        return {
          results: [
            { id: "debit", currency: "USD", organizationId: "tenant-1", workspaceId: "workspace-1", businessId: "business-1" },
            { id: "credit", currency: "USD", organizationId: "tenant-1", workspaceId: "workspace-1", businessId: "business-1" },
          ] as T[],
        };
      },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) { batches = statements.length; return statements.map(() => ({ success: true, meta: { changes: 1 } })); },
    };
    const repo = new RefundAccountingRepository(new D1Database(raw));
    const result = await repo.postSuccessfulRefundAccounting(ctx, {
      refundId: brandId<"EntityId">("refund-3"),
      ledgerTransactionId: brandId<"EntityId">("ledger-3"),
      debitAccountId: brandId<"EntityId">("debit"),
      creditAccountId: brandId<"EntityId">("credit"),
      occurredAt: "2026-09-24T10:05:00.000Z",
      now: "2026-09-24T10:05:00.000Z",
    });
    expect(batches).toBe(4);
    expect(result.status).toBe("succeeded");
    expect(result.ledgerTransactionId).toBe("ledger-3");
  });
});
