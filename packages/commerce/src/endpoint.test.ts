import { describe, it, expect } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { CommerceRepository } from "./repository";
import { handleResolveOfferEndpoint } from "./endpoint";

function createMockContext(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-test"),
    correlationId: brandId<"CorrelationId">("corr-test"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "commerce",
    operation: "commerce.offer.resolve",
    locale: "fa",
    timezone: "Asia/Tehran",
  };
}

describe("Commerce API Endpoint: handleResolveOfferEndpoint", () => {
  const sellerId = "seller-99";
  const productId = "product-laptop";
  const variantId = "var-ram-32gb";
  const customerId = "customer-vip-org";

  const rows = [
    {
      id: "offer-gen-product",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "general",
      customer_group: null,
      customer_id: null,
      available: 1,
      price_amount_minor: 50000000,
      currency: "IRR",
      min_quantity: null,
      max_quantity: null,
      effective_from: null,
      effective_to: null,
      digital_entitlement_id: null,
      conditions_json: null,
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "offer-var-general",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: variantId,
      audience_type: "general",
      customer_group: null,
      customer_id: null,
      available: 1,
      price_amount_minor: 60000000,
      currency: "IRR",
      min_quantity: null,
      max_quantity: null,
      effective_from: null,
      effective_to: null,
      digital_entitlement_id: null,
      conditions_json: null,
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "offer-cust-vip",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: variantId,
      audience_type: "customer",
      customer_group: null,
      customer_id: customerId,
      available: 1,
      price_amount_minor: 54000000,
      currency: "IRR",
      min_quantity: null,
      max_quantity: null,
      effective_from: null,
      effective_to: null,
      digital_entitlement_id: null,
      conditions_json: null,
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  function createRepo() {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null; },
      async all<T>() { return { results: rows as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    return new CommerceRepository(new D1Database(raw));
  }

  it("resolves customer-specific offer when customerId, sellerId, productId, and variantId are passed", async () => {
    const repository = createRepo();
    const result = await handleResolveOfferEndpoint(
      createMockContext(),
      {
        sellerId,
        productId,
        variantId,
        customerId,
      },
      { repository, now: () => "2026-06-01T00:00:00Z" }
    );

    expect(result.success).toBe(true);
    expect(result.offer).not.toBeNull();
    expect(result.offer?.id).toBe("offer-cust-vip");
    expect(result.offer?.priceAmountMinor).toBe(54000000);
    expect(result.precedenceMatched).toBe("customer");
  });

  it("resolves variant general offer when customerId is not matching", async () => {
    const repository = createRepo();
    const result = await handleResolveOfferEndpoint(
      createMockContext(),
      {
        sellerId,
        productId,
        variantId,
      },
      { repository, now: () => "2026-06-01T00:00:00Z" }
    );

    expect(result.success).toBe(true);
    expect(result.offer).not.toBeNull();
    expect(result.offer?.id).toBe("offer-var-general");
    expect(result.offer?.priceAmountMinor).toBe(60000000);
    expect(result.precedenceMatched).toBe("general");
  });

  it("inherits from product general offer when variantId does not have a specific offer", async () => {
    const repository = createRepo();
    const result = await handleResolveOfferEndpoint(
      createMockContext(),
      {
        sellerId,
        productId,
        variantId: "non-existent-variant",
      },
      { repository, now: () => "2026-06-01T00:00:00Z" }
    );

    expect(result.success).toBe(true);
    expect(result.offer).not.toBeNull();
    expect(result.offer?.id).toBe("offer-gen-product");
    expect(result.offer?.priceAmountMinor).toBe(50000000);
    expect(result.isInheritedFromProduct).toBe(true);
  });
});
