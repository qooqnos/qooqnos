import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CustomerRepository, type CustomerPreferenceRecord } from "./customer-repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "customer",
    operation: "customer.preference.write",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CustomerRepository", () => {
  it("rejects customer creation outside request tenant", async () => {
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
    const repository = new CustomerRepository(new D1Database(raw));

    await expect(repository.create(context(), {
      id: brandId<"EntityId">("customer-1"),
      organizationId: brandId<"EntityId">("tenant-2"),
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("does not match request context");
  });

  it("enforces organization scope on reads", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };
    const repository = new CustomerRepository(new D1Database(raw));

    const result = await repository.get(context(), brandId<"EntityId">("customer-foreign"));

    expect(result).toBeNull();
    expect(statements[0]).toContain("organization_id = ?");
  });

  it("rejects invalid preference confidence", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "customer-1",
          organizationId: "tenant-1",
          userId: null,
          status: "active",
          locale: null,
          timezone: null,
          createdAt: "2026-09-22T00:00:00.000Z",
          updatedAt: "2026-09-22T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CustomerRepository(new D1Database(raw));

    await expect(repository.setPreference(context(), {
      id: brandId<"EntityId">("preference-1"),
      customerId: brandId<"EntityId">("customer-1"),
      attribute: "style",
      valueReference: "minimal",
      source: "seller_confirmed",
      confidence: 1.5,
      persistence: "persistent",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("between 0 and 1");
  });
});
