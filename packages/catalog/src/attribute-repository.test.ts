import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { CatalogAttributeRepository } from "./attribute-repository";

describe("CatalogAttributeRepository", () => {
  it("creates a platform attribute definition", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "attr-1",
          canonicalKey: "color",
          name: "Color",
          description: null,
          dataType: "enum",
          status: "active",
          metadataJson: null,
          createdAt: "2026-09-22T00:00:00.000Z",
          updatedAt: "2026-09-22T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };

    const repository = new CatalogAttributeRepository(new D1Database(raw));
    const record = await repository.createDefinition({
      id: brandId<"EntityId">("attr-1"),
      canonicalKey: " color ",
      name: " Color ",
      dataType: "enum",
      now: "2026-09-22T00:00:00.000Z",
    });

    expect(record.canonicalKey).toBe("color");
    expect(record.dataType).toBe("enum");
    expect(statements.some((sql) => sql.includes("INSERT INTO attribute_definitions"))).toBe(true);
  });

  it("rejects options for non-enumerated attributes", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "attr-text",
          canonicalKey: "material",
          name: "Material",
          description: null,
          dataType: "text",
          status: "active",
          metadataJson: null,
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

    const repository = new CatalogAttributeRepository(new D1Database(raw));
    await expect(repository.createOption({
      id: brandId<"EntityId">("option-1"),
      attributeDefinitionId: brandId<"EntityId">("attr-text"),
      canonicalValue: "cotton",
      displayLabel: "Cotton",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("enum or multi_enum");
  });

  it("requires an existing category before creating category attribute metadata", async () => {
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

    const repository = new CatalogAttributeRepository(new D1Database(raw));
    await expect(repository.attachToCategory({
      id: brandId<"EntityId">("category-attribute-1"),
      categoryId: brandId<"EntityId">("missing-category"),
      attributeDefinitionId: brandId<"EntityId">("attr-1"),
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("Category not found");

    expect(statements[0]).toContain("FROM categories");
  });
});
