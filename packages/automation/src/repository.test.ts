import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { AutomationRepository } from "./repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "automation",
    operation: "automation.execution.run",
    locale: "en",
    timezone: "UTC",
  };
}

describe("AutomationRepository", () => {
  it("does not create a second running execution for the same correlation", async () => {
    const existing = {
      id: "execution-1", workflowId: "workflow-1", workflowVersionId: "version-1", triggerId: "trigger-1",
      organizationId: "tenant-1", workspaceId: "workspace-1", businessId: null,
      status: "running", inputReference: null, correlationId: "corr-1", traceId: "trace-1",
      startedAt: "2026-09-22T00:00:00.000Z", completedAt: null,
      createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z",
    };
    let writes = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return existing as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { writes += 1; return { success: true }; },
    };
    const raw: D1DatabaseLike = { prepare() { return statement; }, async batch() { return []; } };
    const repository = new AutomationRepository(new D1Database(raw));
    const result = await repository.startExecution(context(), {
      id: brandId<"EntityId">("execution-new"),
      workflowId: brandId<"EntityId">("workflow-1"),
      workflowVersionId: brandId<"EntityId">("version-1"),
      triggerId: brandId<"EntityId">("trigger-1"),
      correlationId: "corr-1",
      traceId: "trace-2",
      now: "2026-09-22T00:01:00.000Z",
    });
    expect(result.id).toBe("execution-1");
    expect(writes).toBe(0);
  });
});
