import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { CatalogRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "catalog",
    operation: "catalog.product.create",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CatalogRepository", () => {
  it("requires tenant and workspace predicates when resolving a product business", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return { id: "business-1" } as T; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };

    const repository = new CatalogRepository(new D1Database(raw));
    await repository.createProduct(context(), {
      id: brandId<"EntityId">("product-1"),
      businessId: brandId<"EntityId">("business-1"),
      name: "Phoenix product",
      now: "2026-09-16T00:00:00.000Z",
    });

    const businessLookup = statements.find((sql) => sql.includes("FROM businesses"));
    expect(businessLookup).toContain("organization_id = ?");
    expect(businessLookup).toContain("workspace_id = ?");
  });

  it("rejects product variants that resolve outside the trusted scope", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };

    const repository = new CatalogRepository(new D1Database(raw));
    await expect(repository.createProductVariant(context(), {
      id: brandId<"EntityId">("variant-1"),
      productId: brandId<"EntityId">("product-foreign"),
      sku: "SKU-1",
      now: "2026-09-16T00:00:00.000Z",
    })).rejects.toThrow("Product is not available in the current workspace");

    const productLookup = statements.find((sql) => sql.includes("FROM products"));
    expect(productLookup).toContain("organization_id = ?");
    expect(productLookup).toContain("workspace_id = ?");
  });
});
