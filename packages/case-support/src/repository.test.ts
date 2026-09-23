import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { CaseSupportRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("agent-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "case-support",
    operation: "case.sla.evaluate",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CaseSupportRepository", () => {
  it("records first response exactly once", async () => {
    let writes = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return { id: "case-1", organizationId: "tenant-1", workspaceId: "workspace-1", caseTypeId: "type-1", status: "assigned", priority: "normal", severity: "medium", subjectType: "customer", subjectId: "customer-1", requesterType: "customer", requesterId: "customer-1", sourceType: "api", sourceReference: "src-1", queueId: null, assigneeId: "agent-1", slaId: "sla-1", version: 2, openedAt: "2026-09-23T00:00:00.000Z", resolvedAt: null, closedAt: null, createdAt: "2026-09-23T00:00:00.000Z", updatedAt: "2026-09-23T00:01:00.000Z" } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { writes += 1; return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CaseSupportRepository(new D1Database(raw));

    await repository.recordFirstResponse(context(), {
      caseId: brandId<"EntityId">("case-1"),
      actorId: "agent-1",
      now: "2026-09-23T00:02:00.000Z",
    });

    expect(writes).toBe(1);
  });

  it("creates an idempotent SLA breach event and outbox pair", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return { id: "case-1", organizationId: "tenant-1", workspaceId: "workspace-1", caseTypeId: "type-1", status: "assigned", priority: "normal", severity: "medium", subjectType: "customer", subjectId: "customer-1", requesterType: "customer", requesterId: "customer-1", sourceType: "api", sourceReference: "src-1", queueId: null, assigneeId: "agent-1", slaId: "sla-1", version: 2, openedAt: "2026-09-23T00:00:00.000Z", resolvedAt: null, closedAt: null, createdAt: "2026-09-23T00:00:00.000Z", updatedAt: "2026-09-23T00:01:00.000Z" } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return [
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ]; },
    };
    const repository = new CaseSupportRepository(new D1Database(raw));

    await expect(repository.recordSlaBreach(context(), {
      caseId: brandId<"EntityId">("case-1"),
      metric: "resolution",
      targetAt: "2026-09-23T01:00:00.000Z",
      now: "2026-09-23T01:01:00.000Z",
    })).resolves.toBe(true);
  });
});
