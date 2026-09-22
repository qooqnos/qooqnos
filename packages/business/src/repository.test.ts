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

  it("records immutable status history when business status changes", async () => {
    const statements: string[] = [];
    let business = {
      id: "business-1",
      organizationId: "tenant-1",
      workspaceId: "workspace-1",
      name: "phoenix",
      displayName: "Phoenix",
      status: "draft",
      publicationStatus: "unpublished",
      businessType: null,
      primaryCategoryId: null,
      defaultLocale: "en",
      timezone: "UTC",
      defaultCurrency: "AZN",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };

    let preparedSql = "";
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>(..._args: unknown[]) {
        return business.id === "business-1" ? (business as unknown as T) : null;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() {
        if (preparedSql.includes("UPDATE businesses SET status")) {
          business = { ...business, status: "active", updatedAt: "2026-09-22T00:01:00.000Z" };
        }
        if (preparedSql.includes("INSERT INTO business_status_history")) {
          statements.push(preparedSql);
        }
        return { success: true };
      },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { preparedSql = sql; return statement; },
      async batch() { return []; },
    };
    const repository = new BusinessRepository(new D1Database(raw));

    const result = await repository.setStatus(
      context(),
      brandId<"EntityId">("business-1"),
      "active",
      "2026-09-22T00:01:00.000Z",
      brandId<"EntityId">("history-1"),
    );

    expect(result.status).toBe("active");
    expect(statements.some((sql) => sql.includes("INSERT INTO business_status_history"))).toBe(true);
  });


  it("transactionally rejects a stale publication transition", async () => {
    let firstCalls = 0;
    let preparedSql = "";
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        if (preparedSql.includes("FROM businesses")) {
          return {
            id: "business-1",
            organizationId: "tenant-1",
            workspaceId: "workspace-1",
            name: "phoenix",
            displayName: "Phoenix",
            status: "active",
            publicationStatus: "unpublished",
            businessType: null,
            primaryCategoryId: null,
            defaultLocale: "en",
            timezone: "UTC",
            defaultCurrency: "AZN",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          } as T;
        }
        return null;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) {
        preparedSql = sql;
        return statement;
      },
      async batch() {
        firstCalls += 1;
        return [{ success: true, meta: { changes: 0 } }, { success: true }, { success: true }];
      },
    };
    const repository = new BusinessRepository(new D1Database(raw));

    await expect(repository.setPublicationStatusAndRecord(
      context(),
      brandId<"EntityId">("business-1"),
      "published",
      "2026-09-22T00:01:00.000Z",
    )).rejects.toThrow("Concurrent business publication transition rejected");

    expect(firstCalls).toBe(1);
  });

});
