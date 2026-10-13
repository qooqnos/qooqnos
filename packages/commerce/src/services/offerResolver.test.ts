import { describe, it, expect } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { OfferResolver } from "./offerResolver";
import { CommerceRepository } from "../repository";

const mockContext: RequestContext = {
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

describe("OfferResolver in services/offerResolver.ts", () => {
  const sellerId = brandId<"EntityId">("seller-shop-1");
  const productId = brandId<"EntityId">("product-book-1");
  const customerId = brandId<"EntityId">("customer-ali");

  const databaseRows = [
    // 1. General base offer
    {
      id: "offer-gen",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "general",
      customer_group: null,
      customer_id: null,
      available: 1,
      price_amount_minor: 300000,
      currency: "IRR",
      min_quantity: null,
      max_quantity: null,
      effective_from: null,
      effective_to: null,
      digital_entitlement_id: null,
      conditions_json: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    // 2. Customer group offer (partner)
    {
      id: "offer-grp-partner",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "group",
      customer_group: "partner",
      customer_id: null,
      available: 1,
      price_amount_minor: 250000,
      currency: "IRR",
      min_quantity: null,
      max_quantity: null,
      effective_from: null,
      effective_to: null,
      digital_entitlement_id: null,
      conditions_json: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    // 3. Customer-specific offer
    {
      id: "offer-cust-ali",
      organization_id: "tenant-1",
      workspace_id: "workspace-1",
      seller_id: sellerId,
      product_id: productId,
      variant_id: null,
      audience_type: "customer",
      customer_group: null,
      customer_id: customerId,
      available: 1,
      price_amount_minor: 220000,
      currency: "IRR",
      min_quantity: null,
      max_quantity: null,
      effective_from: null,
      effective_to: null,
      digital_entitlement_id: null,
      conditions_json: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  function createMockRepo(rows: typeof databaseRows) {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>(): Promise<T | null> {
        return null;
      },
      async all<T>(): Promise<{ results: T[] }> {
        return { results: rows as T[] };
      },
      async run() {
        return { success: true };
      },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    return new CommerceRepository(new D1Database(raw));
  }

  it("queries the database and returns optimal offer following precedence: Customer > Group > General", async () => {
    const repository = createMockRepo(databaseRows);
    const resolver = new OfferResolver({ repository });

    // Customer-specific match (Ali)
    const resultAli = await resolver.resolveOfferDetailed(mockContext, {
      sellerId,
      productId,
      customerId,
      customerGroup: "partner", // Even with partner group, Ali specific offer wins
    });
    expect(resultAli).not.toBeNull();
    expect(resultAli?.offer.id).toBe("offer-cust-ali");
    expect(resultAli?.precedenceMatched).toBe("customer");
    expect(resultAli?.offer.priceAmountMinor).toBe(220000);

    // Group match (Other partner)
    const resultPartner = await resolver.resolveOfferDetailed(mockContext, {
      sellerId,
      productId,
      customerId: "other-cust",
      customerGroup: "partner",
    });
    expect(resultPartner).not.toBeNull();
    expect(resultPartner?.offer.id).toBe("offer-grp-partner");
    expect(resultPartner?.precedenceMatched).toBe("group");
    expect(resultPartner?.offer.priceAmountMinor).toBe(250000);

    // General fallback
    const resultGeneral = await resolver.resolveOfferDetailed(mockContext, {
      sellerId,
      productId,
    });
    expect(resultGeneral).not.toBeNull();
    expect(resultGeneral?.offer.id).toBe("offer-gen");
    expect(resultGeneral?.precedenceMatched).toBe("general");
    expect(resultGeneral?.offer.priceAmountMinor).toBe(300000);
  });


  it("only considers offers where current date is within the [validFrom, validTo] range", async () => {
    const timeBoundedRows = [
      // 1. Expired special partner offer
      {
        id: "offer-expired",
        organization_id: "tenant-1",
        workspace_id: "workspace-1",
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "customer",
        customer_group: null,
        customer_id: customerId,
        available: 1,
        price_amount_minor: 180000,
        currency: "IRR",
        valid_from: "2026-01-01T00:00:00Z",
        valid_to: "2026-05-01T00:00:00Z",
        status: "ACTIVE",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      // 2. Future offer (not yet started)
      {
        id: "offer-future",
        organization_id: "tenant-1",
        workspace_id: "workspace-1",
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "group",
        customer_group: "partner",
        customer_id: null,
        available: 1,
        price_amount_minor: 210000,
        currency: "IRR",
        valid_from: "2026-08-01T00:00:00Z",
        valid_to: "2026-12-31T23:59:59Z",
        status: "ACTIVE",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      // 3. Currently valid active general offer
      {
        id: "offer-current-active",
        organization_id: "tenant-1",
        workspace_id: "workspace-1",
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "general",
        customer_group: null,
        customer_id: null,
        available: 1,
        price_amount_minor: 290000,
        currency: "IRR",
        valid_from: "2026-01-01T00:00:00Z",
        valid_to: "2026-12-31T23:59:59Z",
        status: "ACTIVE",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const repo = createMockRepo(timeBoundedRows);
    const resolver = new OfferResolver({
      repository: repo,
      now: () => "2026-06-15T12:00:00Z", // Middle of the year
    });

    const result = await resolver.resolveOfferDetailed(mockContext, {
      sellerId,
      productId,
      customerId,
      customerGroup: "partner",
    });

    // The customer offer is expired (< 2026-05-01)
    // The partner group offer is not yet valid (> 2026-08-01)
    // Therefore, the resolver skips them and picks the currently valid general offer!
    expect(result).not.toBeNull();
    expect(result?.offer.id).toBe("offer-current-active");
    expect(result?.precedenceMatched).toBe("general");
    expect(result?.offer.priceAmountMinor).toBe(290000);
  });


  it("rejects offers where status is not ACTIVE (e.g., DRAFT, INACTIVE, EXPIRED)", async () => {
    const nonActiveRows = [
      {
        id: "offer-draft-customer",
        organization_id: "tenant-1",
        workspace_id: "workspace-1",
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "customer",
        customer_group: null,
        customer_id: customerId,
        available: 1,
        price_amount_minor: 120000,
        currency: "IRR",
        valid_from: null,
        valid_to: null,
        status: "DRAFT", // Not active
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "offer-inactive-group",
        organization_id: "tenant-1",
        workspace_id: "workspace-1",
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "group",
        customer_group: "partner",
        customer_id: null,
        available: 1,
        price_amount_minor: 150000,
        currency: "IRR",
        valid_from: null,
        valid_to: null,
        status: "INACTIVE", // Inactive
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "offer-active-general",
        organization_id: "tenant-1",
        workspace_id: "workspace-1",
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "general",
        customer_group: null,
        customer_id: null,
        available: 1,
        price_amount_minor: 290000,
        currency: "IRR",
        valid_from: "2026-01-01T00:00:00Z",
        valid_to: "2026-12-31T23:59:59Z",
        status: "ACTIVE", // Only active one
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    const repo = createMockRepo(nonActiveRows);
    const resolver = new OfferResolver({
      repository: repo,
      now: () => "2026-06-15T12:00:00Z",
    });

    const result = await resolver.resolveOfferDetailed(mockContext, {
      sellerId,
      productId,
      customerId,
      customerGroup: "partner",
    });

    expect(result).not.toBeNull();
    // Skips customer (DRAFT) and partner (INACTIVE), selects active general
    expect(result?.offer.id).toBe("offer-active-general");
    expect(result?.offer.status).toBe("ACTIVE");
    expect(result?.precedenceMatched).toBe("general");
  });

  it("returns null if no matching active offer exists", async () => {
    const repository = createMockRepo([]);
    const resolver = new OfferResolver({ repository });

    const offer = await resolver.resolveOffer(mockContext, {
      sellerId,
      productId,
    });
    expect(offer).toBeNull();
  });
});
