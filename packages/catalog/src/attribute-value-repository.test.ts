import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import {
  D1Database,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from "@qooqnos/database";
import { CatalogAttributeValueRepository } from "./attribute-value-repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "catalog",
    operation: "catalog.attribute_value.set",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CatalogAttributeValueRepository", () => {
  it("rejects targets outside the trusted workspace", async () => {
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

    const repository = new CatalogAttributeValueRepository(new D1Database(raw));

    await expect(repository.get(
      context(),
      brandId<"EntityId">("attribute-color"),
      "product_variant",
      brandId<"EntityId">("variant-foreign"),
    )).rejects.toThrow("not available in the current workspace");
  });

  it("writes a typed multi-enum value and its option rows atomically", async () => {
    const batches: Array<readonly unknown[]> = [];
    let firstIndex = 0;
    const firstResults: unknown[] = [
      { id: "variant-1" },
      {
        id: "attribute-materials",
        canonicalKey: "materials",
        name: "Materials",
        description: null,
        dataType: "multi_enum",
        status: "active",
        metadataJson: null,
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      },
      null,
      { id: "variant-1" },
      {
        id: "value-1",
        attributeDefinitionId: "attribute-materials",
        targetType: "product_variant",
        targetId: "variant-1",
        sourceType: "seller_confirmed",
        sourceReference: null,
        confidence: 1,
        optionId: null,
        textValue: null,
        integerValue: null,
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        datetimeValue: null,
        createdAt: "2026-09-22T00:00:00.000Z",
        updatedAt: "2026-09-22T00:00:00.000Z",
      },
    ];

    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return firstResults[firstIndex++] as T | null; },
      async all<T>( ) {
        return { results: [{ optionId: "option-cotton" }] as T[] };
      },
      async run() { return { success: true }; },
    };

    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch(statements) {
        batches.push(statements);
        return statements.map(() => ({ success: true }));
      },
    };

    const repository = new CatalogAttributeValueRepository(new D1Database(raw));
    const result = await repository.set(context(), {
      id: brandId<"EntityId">("value-1"),
      attributeDefinitionId: brandId<"EntityId">("attribute-materials"),
      targetType: "product_variant",
      targetId: brandId<"EntityId">("variant-1"),
      sourceType: "seller_confirmed",
      confidence: 1,
      multiEnumOptionIds: [
        brandId<"EntityId">("option-cotton"),
      ],
      now: "2026-09-22T00:00:00.000Z",
    });

    expect(result.multiEnumOptionIds).toEqual(["option-cotton"]);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(3);
  });
});
