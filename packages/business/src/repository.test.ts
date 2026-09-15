import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type AtomicCommandInput, type AtomicCommandResult, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { BusinessRepository, type BusinessRecord } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "business",
    operation: "business.create",
    locale: "en",
    timezone: "UTC",
  };
}

function database(): D1Database {
  const statement: D1PreparedStatementLike = {
    bind() { return this; },
    async first<T>() { return { id: "workspace-1" } as T; },
    async all<T>() { return { results: [] as T[] }; },
    async run() { return { success: true }; },
  };
  const raw: D1DatabaseLike = {
    prepare() { return statement; },
    async batch() { return []; },
  };
  return new D1Database(raw);
}

describe("BusinessRepository", () => {
  it("composes business state, audit and outbox into one atomic command", async () => {
    let captured: AtomicCommandInput<BusinessRecord> | undefined;
    const commands = {
      async execute<TResult>(_context: unknown, input: AtomicCommandInput<TResult>): Promise<AtomicCommandResult<TResult>> {
        captured = input as AtomicCommandInput<BusinessRecord>;
        return { kind: "executed", result: input.result };
      },
    };
    const repository = new BusinessRepository(database(), commands as never);

    const result = await repository.createAtomic(
      context(),
      {
        id: brandId<"EntityId">("business-1"),
        organizationId: brandId<"EntityId">("tenant-1"),
        workspaceId: brandId<"EntityId">("workspace-1"),
        name: "phoenix",
        displayName: "Phoenix",
        now: "2026-09-16T00:00:00.000Z",
      },
      {
        idempotencyKey: "create-1",
        requestFingerprint: "fingerprint-1",
        idempotencyExpiresAt: "2026-09-17T00:00:00.000Z",
        auditId: "audit-1",
        requestId: "req-1",
        correlationId: "corr-1",
      },
    );

    expect(result.kind).toBe("executed");
    expect(captured?.statements).toHaveLength(1);
    expect(captured?.statements[0]?.sql).toContain("INSERT INTO businesses");
    expect(captured?.audit.action).toBe("business.created");
    expect(captured?.audit.targetId).toBe("business-1");
    expect(captured?.outbox?.[0]?.eventType).toBe("business.created.v1");
  });

  it("rejects a command whose tenant/workspace differs from the trusted context", async () => {
    const repository = new BusinessRepository(database(), {
      async execute<TResult>(_context: unknown, input: AtomicCommandInput<TResult>): Promise<AtomicCommandResult<TResult>> {
        return { kind: "executed", result: input.result };
      },
    } as never);

    await expect(
      repository.createAtomic(
        context(),
        {
          id: brandId<"EntityId">("business-2"),
          organizationId: brandId<"EntityId">("other-tenant"),
          workspaceId: brandId<"EntityId">("workspace-1"),
          name: "other",
          displayName: "Other",
          now: "2026-09-16T00:00:00.000Z",
        },
        {
          idempotencyKey: "create-2",
          requestFingerprint: "fingerprint-2",
          idempotencyExpiresAt: "2026-09-17T00:00:00.000Z",
          auditId: "audit-2",
          requestId: "req-1",
          correlationId: "corr-1",
        },
      ),
    ).rejects.toThrow("Business creation scope does not match request context");
  });
});
