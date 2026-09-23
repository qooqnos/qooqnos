import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { CustomerRepository } from "@qooqnos/database";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "customer",
    operation: "customer.update_profile",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CustomerRepository profile aggregate boundary", () => {
  it("updates profile-level fields without requiring a customer_profiles table", async () => {
    const current = {
      id: "customer-1",
      organizationId: "tenant-1",
      userId: "user-1",
      status: "active",
      locale: "en",
      timezone: "UTC",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };
    let writes = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return current as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { writes += 1; return { success: true, meta: { changes: 1 } }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() {
        writes += 1;
        return [{ success: true }, { success: true }];
      },
    };
    const repository = new CustomerRepository(new D1Database(raw));

    const updated = await repository.updateProfile(
      context(),
      brandId<"EntityId">("customer-1"),
      { locale: "fa", timezone: "Asia/Tehran", now: "2026-09-23T00:00:00.000Z" },
    );

    expect(updated.id).toBe("customer-1");
    expect(writes).toBe(1);
  });
});
