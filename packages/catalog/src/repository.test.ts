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
  it("projects active business products and services with workspace scope", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() {
        if (statements.length === 1) return { results: [{ id: "product-1" }] as T[] };
        return { results: [{ id: "service-1" }] as T[] };
      },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };
    const repository = new CatalogRepository(new D1Database(raw));
    const result = await repository.listBusinessEntityIds(context(), brandId<"EntityId">("business-1"));
    expect(result).toEqual({ productIds: ["product-1"], serviceIds: ["service-1"] });
    expect(statements[0]).toContain("b.organization_id = ?");
    expect(statements[1]).toContain("b.workspace_id = ?");
  });

  it("requires tenant and workspace predicates when resolving a product business", async () => {
    const statements: string[] = [];
    let firstCalls = 0;
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        firstCalls += 1;
        if (firstCalls === 1) return { id: "business-1" } as T;
        return { id: "product-1", businessId: "business-1", name: "Phoenix product", description: null, status: "draft", createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T00:00:00.000Z" } as T;
      },
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

  it("scopes product reads through the owning business", async () => {
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

    const repository = new CatalogRepository(new D1Database(raw));
    const product = await repository.getProduct(context(), brandId<"EntityId">("product-foreign"));

    expect(product).toBeNull();
    const productLookup = statements.find((sql) => sql.includes("FROM products p"));
    expect(productLookup).toContain("INNER JOIN businesses b ON b.id = p.business_id");
    expect(productLookup).toContain("b.organization_id = ?");
    expect(productLookup).toContain("b.workspace_id = ?");
  });

  it("scopes offering reads through the owning business", async () => {
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

    const repository = new CatalogRepository(new D1Database(raw));
    const offering = await repository.getOffering(context(), brandId<"EntityId">("offering-foreign"));

    expect(offering).toBeNull();
    const offeringLookup = statements.find((sql) => sql.includes("FROM offerings o"));
    expect(offeringLookup).toContain("INNER JOIN businesses b ON b.id = o.business_id");
    expect(offeringLookup).toContain("b.organization_id = ?");
    expect(offeringLookup).toContain("b.workspace_id = ?");
  });

  it("rejects product variants that resolve outside the trusted scope", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first() { return null; },
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

  it("returns only active variants for a published public product offering and omits internal SKU fields", async () => {
    const statements: string[] = [];
    let currentSql = "";
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        if (currentSql.includes("FROM offerings o") && currentSql.includes("o.publication_status = 'published'")) {
          return { productId: "product-1", organizationId: "tenant-1", workspaceId: "workspace-1" } as T;
        }
        if (currentSql.includes("SELECT pv.id FROM product_variants pv")) {
          return { id: "variant-1" } as T;
        }
        if (currentSql.includes("FROM attribute_definitions")) {
          return { canonicalKey: "color", name: "Color", dataType: "text", status: "active" } as T;
        }
        return null as T | null;
      },
      async all<T>() {
        if (currentSql.includes("FROM product_variants pv") && currentSql.includes("WHERE pv.product_id = ?")) {
          return { results: [{
            id: "variant-1",
            priceAmountMinor: 1250000,
            currency: "IRR",
            pricingType: "fixed",
            priceSource: "variant",
            availability: "in_stock",
          }] as T[] };
        }
        if (currentSql.includes("FROM attribute_values WHERE target_type = ?")) {
          return { results: [{
            id: "value-color-1",
            attributeDefinitionId: "attribute-color",
            targetType: "product_variant",
            targetId: "variant-1",
            sourceType: "seller_input",
            sourceReference: null,
            confidence: 1,
            optionId: null,
            textValue: "Black",
            integerValue: null,
            numberValue: null,
            booleanValue: null,
            dateValue: null,
            datetimeValue: null,
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          }] as T[] };
        }
        return { results: [] as T[] };
      },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { currentSql = sql; statements.push(sql); return statement; },
      async batch() { return []; },
    };
    const repository = new CatalogRepository(new D1Database(raw));
    const variants = await repository.listPublishedOfferingVariants(context(), brandId<"EntityId">("offering-1"));
    expect(variants).toEqual([{
      id: "variant-1",
      attributes: [{ key: "color", label: "Color", value: "Black" }],
      priceAmountMinor: 1250000,
      currency: "IRR",
      pricingType: "fixed",
      priceSource: "variant",
      availability: "in_stock",
    }]);
    expect(statements[0]).toContain("o.status = 'active'");
    expect(statements[0]).toContain("o.publication_status = 'published'");
    expect(statements[0]).toContain("b.publication_status = 'published'");
    expect(statements.some((sql) => sql.includes("pv.status = 'active'"))).toBe(true);
    expect(statements.some((sql) => sql.includes("pr.product_variant_id = pv.id"))).toBe(true);
    expect(statements.some((sql) => sql.includes("pr.product_variant_id IS NULL"))).toBe(true);
    expect(statements.some((sql) => sql.includes("inventory_items") && sql.includes("l.status = 'active'"))).toBe(true);
    expect(JSON.stringify(variants)).not.toContain("sku");
  });

  it("does not return variants for an unpublished offering", async () => {
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
    const repository = new CatalogRepository(new D1Database(raw));
    await expect(repository.listPublishedOfferingVariants(context(), brandId<"EntityId">("unpublished-offer"))).resolves.toEqual([]);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("o.publication_status = 'published'");
  });

});