import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { FinancialAuditRepository } from "./financial-audit";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-fin-audit"),
    correlationId: brandId<"CorrelationId">("corr-fin-audit"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "billing",
    operation: "billing.financial-audit.append",
    locale: "en",
    timezone: "UTC",
  };
}

describe("FinancialAuditRepository", () => {
  it("appends an immutable financial event with an integrity hash", async () => {
    let inserted = false;
    const row = {
      id: "audit-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      businessId: null,
      actorId: "user-1",
      eventType: "payment.refund.requested",
      entityType: "payment",
      entityId: "payment-1",
      outcome: "succeeded" as const,
      amountMinor: 1250,
      currency: "EUR",
      reasonCode: "customer_request",
      reason: "Customer requested refund",
      source: "billing.refund",
      requestId: "req-fin-audit",
      correlationId: "corr-fin-audit",
      idempotencyKey: "refund-1",
      beforeJson: null,
      afterJson: JSON.stringify({ status: "requested" }),
      metadataJson: JSON.stringify({ channel: "api" }),
      integrityHash: "hash",
      occurredAt: "2026-09-24T09:00:00.000Z",
      createdAt: "2026-09-24T09:00:00.000Z",
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
    const repository = new FinancialAuditRepository(new D1Database(raw));
    const result = await repository.append(context(), {
      id: brandId<"EntityId">("audit-1"),
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: brandId<"EntityId">("payment-1"),
      outcome: row.outcome,
      amountMinor: row.amountMinor,
      currency: row.currency,
      reasonCode: row.reasonCode,
      reason: row.reason,
      source: row.source,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
      after: JSON.parse(row.afterJson),
      metadata: JSON.parse(row.metadataJson),
      occurredAt: row.occurredAt,
      now: row.createdAt,
    });
    expect(inserted).toBe(true);
    expect(result.integrityHash).toBe("hash");
    expect(result.after).toEqual({ status: "requested" });
  });

  it("rejects non-integer money", async () => {
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
    const repository = new FinancialAuditRepository(new D1Database(raw));
    await expect(repository.append(context(), {
      id: brandId<"EntityId">("audit-2"),
      eventType: "payment.captured",
      entityType: "payment",
      entityId: brandId<"EntityId">("payment-2"),
      outcome: "succeeded",
      amountMinor: 10.5,
      source: "billing.payment",
      correlationId: "corr-fin-audit",
      occurredAt: "2026-09-24T09:00:00.000Z",
      now: "2026-09-24T09:00:00.000Z",
    })).rejects.toThrow("integer minor-unit");
  });
});
