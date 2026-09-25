import { describe, expect, it } from "vitest";
import { buildMerchantProductFeedXml, projectMerchantProductFeed } from "./merchant-feed";
import type { SeoEntity } from "./types";

const entity: SeoEntity = {
  id: "product-1",
  type: "Product",
  sourceModule: "catalog",
  sourceVersion: "1",
  publicationState: "published",
  visibility: "public",
  preferredName: "Red Shirt",
  description: "A red shirt.",
  locale: "en-US",
  imageUrl: "https://cdn.example.com/red.jpg",
  price: 29.9,
  currency: "USD",
  availability: "in_stock",
  productGroupId: "product-1",
  productVariants: [{ id: "variant-1", sku: "RED-M", attributes: { color: "red", size: "M", condition: "new" } }],
  updatedAt: "2026-09-25T00:00:00Z",
};

describe("Merchant Center feed", () => {
  it("projects a canonical product variant", () => {
    const result = projectMerchantProductFeed([entity], { canonicalBaseUrl: "https://qooqnos.com" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "variant-1", itemGroupId: "product-1", price: 29.9, currency: "USD", availability: "in_stock", condition: "new" });
    expect(result.skipped).toHaveLength(0);
  });

  it("blocks a product without canonical condition", () => {
    const incomplete = { ...entity, productVariants: [{ ...entity.productVariants![0], attributes: { color: "red" } }] };
    const result = projectMerchantProductFeed([incomplete], { canonicalBaseUrl: "https://qooqnos.com" });
    expect(result.items).toHaveLength(0);
    expect(result.skipped[0]?.reasons).toContain("missing-condition");
  });

  it("uses the persisted canonical URL and excludes condition from variant title suffix", () => {
    const result = projectMerchantProductFeed([entity], {
      canonicalBaseUrl: "https://qooqnos.com",
      canonicalUrlByEntityId: { "product-1": "https://qooqnos.com/en-US/product/red-shirt" },
    });
    expect(result.items[0]?.link).toBe("https://qooqnos.com/en-US/product/red-shirt");
    expect(result.items[0]?.title).toBe("Red Shirt - color: red, size: M");
  });

  it("emits Google product attributes", () => {
    const result = projectMerchantProductFeed([entity], { canonicalBaseUrl: "https://qooqnos.com" });
    const xml = buildMerchantProductFeedXml(result.items, "https://qooqnos.com");
    expect(xml).toContain("<g:id>variant-1</g:id>");
    expect(xml).toContain("<g:item_group_id>product-1</g:item_group_id>");
    expect(xml).toContain("<g:price>29.90 USD</g:price>");
  });
});
