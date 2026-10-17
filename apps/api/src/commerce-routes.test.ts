import { describe, it, expect } from "vitest";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { ApiRouter } from "./router";
import { createAuthorizationRegistry } from "@qooqnos/runtime";

describe("GET & POST /api/v1/commerce/offers/resolve endpoint", () => {
  const sellerId = "seller-alpha";
  const productId = "product-shoe-x";
  const customerId = "customer-ali";

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
      price_amount_minor: 1000000,
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
      id: "off-partner-group",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "group",
      customer_group: "partner",
      customer_id: null,
      available: 1,
      price_amount_minor: 700000,
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
      id: "off-future-general",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "general",
      customer_group: null,
      customer_id: null,
      available: 1,
      price_amount_minor: 100,
      currency: "IRR",
      min_quantity: null,
      max_quantity: null,
      effective_from: "2027-01-01T00:00:00Z",
      effective_to: null,
      valid_from: "2027-01-01T00:00:00Z",
      valid_to: null,
      digital_entitlement_id: null,
      conditions_json: null,
      status: "ACTIVE",
      created_at: "2027-01-01T00:00:00Z",
      updated_at: "2027-01-01T00:00:00Z",
    },
    {
      id: "off-customer-ali",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "customer",
      customer_group: null,
      customer_id: customerId,
      available: 1,
      price_amount_minor: 850000,
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

  function createRouter() {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: rows as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const database = new D1Database(raw);
    const authorization = createAuthorizationRegistry();
    const router = new ApiRouter({ database, authorization });
    return router;
  }

  it("GET /api/v1/commerce/offers/resolve ignores caller-supplied customer, group and effective time", async () => {
    const router = createRouter();
    const request = new Request(
      `http://localhost/api/v1/commerce/offers/resolve?sellerId=${sellerId}&productId=${productId}&customerId=${customerId}&customerGroup=partner&asOf=2027-01-02T00%3A00%3A00Z`,
      { method: "GET" }
    );
    const response = await router.handle(request);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: { offer: { id: string; priceAmountMinor: number }; precedenceMatched: string } };
    expect(body.data.offer.id).toBe("off-general");
    expect(body.data.offer.priceAmountMinor).toBe(1000000);
    expect(body.data.precedenceMatched).toBe("general");
  });

  it("POST /api/v1/commerce/offers/resolve ignores caller-supplied restricted audience and time", async () => {
    const router = createRouter();
    const request = new Request("http://localhost/api/v1/commerce/offers/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId,
        productId,
        customerId,
        customerGroup: "partner",
        asOf: "2027-01-02T00:00:00Z",
      }),
    });
    const response = await router.handle(request);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { data: { offer: { id: string; priceAmountMinor: number }; precedenceMatched: string } };
    expect(body.data.offer.id).toBe("off-general");
    expect(body.data.offer.priceAmountMinor).toBe(1000000);
    expect(body.data.precedenceMatched).toBe("general");
  });
});
