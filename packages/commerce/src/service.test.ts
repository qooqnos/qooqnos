import { describe, it, expect } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { CommerceService } from "./service";
import { CommerceRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "commerce",
    operation: "commerce.offer.resolve",
    locale: "fa",
    timezone: "Asia/Tehran",
  };
}

describe("CommerceService resolveOffer endpoint logic", () => {
  const sellerId = brandId<"EntityId">("seller-1");
  const productId = brandId<"EntityId">("product-1");
  const customerId = brandId<"EntityId">("cust-vip");

  const rows = [
    {
      id: "off-general",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "general",
      customer_group: null,
      customer_id: null,
      available: 1,
      price_amount_minor: 500000,
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
      id: "off-customer-vip",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "customer",
      customer_group: null,
      customer_id: customerId,
      available: 1,
      price_amount_minor: 400000,
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

  function createService() {
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
    const repository = new CommerceRepository(new D1Database(raw));
    const mockAuth: any = {
      assert: async () => {},
    };
    return new CommerceService({
      repository,
      authorization: mockAuth,
      id: () => brandId<"EntityId">("test-id"),
      now: () => "2026-06-01T00:00:00Z",
    });
  }

  it("resolves the applicable offer adhering to customer priority over general", async () => {
    const service = createService();

    // Resolving with customerId returns the VIP offer
    const vipOffer = await service.resolveOffer(context(), {
      sellerId,
      productId,
      customerId,
    });
    expect(vipOffer).not.toBeNull();
    expect(vipOffer.offer).not.toBeNull();
    expect(vipOffer.offer?.id).toBe("off-customer-vip");
    expect(vipOffer.offer?.priceAmountMinor).toBe(400000);
    expect(vipOffer.precedenceMatched).toBe("customer");

    // Resolving without customerId returns the general offer
    const genOffer = await service.resolveOffer(context(), {
      sellerId,
      productId,
    });
    expect(genOffer).not.toBeNull();
    expect(genOffer.offer).not.toBeNull();
    expect(genOffer.offer?.id).toBe("off-general");
    expect(genOffer.offer?.priceAmountMinor).toBe(500000);
    expect(genOffer.precedenceMatched).toBe("general");
  });
});
