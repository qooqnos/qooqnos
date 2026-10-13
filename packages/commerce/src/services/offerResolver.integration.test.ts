import { describe, it, expect } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { OfferResolver } from "./offerResolver";
import { CommerceRepository, type CommerceOfferRow } from "../repository";
import { OfferStatus } from "../types/offer";

function createRequestContext(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-integ-offer"),
    correlationId: brandId<"CorrelationId">("corr-integ-offer"),
    actorId: brandId<"EntityId">("actor-customer-1"),
    tenantId: brandId<"EntityId">("tenant-acme"),
    workspaceId: brandId<"EntityId">("ws-main"),
    module: "commerce",
    operation: "commerce.offer.resolve",
    locale: "fa",
    timezone: "Asia/Tehran",
  };
}

describe("OfferResolver Integration Suite (Precedence & Lifecycle Validity)", () => {
  const sellerId = brandId<"EntityId">("seller-tehran-mart");
  const productId = brandId<"EntityId">("product-smartphone-pro");
  const variantId = brandId<"EntityId">("variant-512gb-black");
  const targetCustomerId = brandId<"EntityId">("customer-vip-armin");
  const otherCustomerId = brandId<"EntityId">("customer-standard-sara");

  // Fixed reference point for the suite: 2026-06-15T12:00:00Z
  const currentTestTime = "2026-06-15T12:00:00Z";

  function createDatabaseMock(mockRows: CommerceOfferRow[]) {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: mockRows as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CommerceRepository(new D1Database(raw));
    return new OfferResolver({
      repository,
      now: () => currentTestTime,
    });
  }

  describe("1. Precedence Resolution: Customer > Group > General", () => {
    const tieredOffers: CommerceOfferRow[] = [
      // General Public Offer: 10,000,000 Tomans
      {
        id: brandId<"EntityId">("off-general-base"),
        organization_id: brandId<"EntityId">("tenant-acme"),
        workspace_id: brandId<"EntityId">("ws-main"),
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "general",
        customer_group: null,
        customer_id: null,
        available: 1,
        price_amount_minor: 10000000,
        currency: "IRR",
        min_quantity: null,
        max_quantity: null,
        effective_from: null,
        effective_to: null,
        digital_entitlement_id: null,
        conditions_json: null,
        status: OfferStatus.ACTIVE,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      // Group Offer (partner): 8,500,000 Tomans
      {
        id: brandId<"EntityId">("off-group-partner"),
        organization_id: brandId<"EntityId">("tenant-acme"),
        workspace_id: brandId<"EntityId">("ws-main"),
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "group",
        customer_group: "partner",
        customer_id: null,
        available: 1,
        price_amount_minor: 8500000,
        currency: "IRR",
        min_quantity: null,
        max_quantity: null,
        effective_from: null,
        effective_to: null,
        digital_entitlement_id: null,
        conditions_json: null,
        status: OfferStatus.ACTIVE,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      // Group Offer (agent): 8,000,000 Tomans
      {
        id: brandId<"EntityId">("off-group-agent"),
        organization_id: brandId<"EntityId">("tenant-acme"),
        workspace_id: brandId<"EntityId">("ws-main"),
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "group",
        customer_group: "agent",
        customer_id: null,
        available: 1,
        price_amount_minor: 8000000,
        currency: "IRR",
        min_quantity: null,
        max_quantity: null,
        effective_from: null,
        effective_to: null,
        digital_entitlement_id: null,
        conditions_json: null,
        status: OfferStatus.ACTIVE,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      // Customer-Specific Offer (Armin): 7,200,000 Tomans
      {
        id: brandId<"EntityId">("off-customer-armin"),
        organization_id: brandId<"EntityId">("tenant-acme"),
        workspace_id: brandId<"EntityId">("ws-main"),
        seller_id: sellerId,
        product_id: productId,
        variant_id: null,
        audience_type: "customer",
        customer_group: null,
        customer_id: targetCustomerId,
        available: 1,
        price_amount_minor: 7200000,
        currency: "IRR",
        min_quantity: null,
        max_quantity: null,
        effective_from: null,
        effective_to: null,
        digital_entitlement_id: null,
        conditions_json: null,
        status: OfferStatus.ACTIVE,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    it("prioritizes Customer offer over Group and General when matching customerId is provided", async () => {
      const resolver = createDatabaseMock(tieredOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        customerId: targetCustomerId,
        customerGroup: "partner", // Even though user belongs to partner group, customer offer takes highest priority
      });

      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-customer-armin");
      expect(result?.precedenceMatched).toBe("customer");
      expect(result?.offer.priceAmountMinor).toBe(7200000);
    });

    it("prioritizes Group offer over General when customerId does not have a direct offer", async () => {
      const resolver = createDatabaseMock(tieredOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        customerId: otherCustomerId,
        customerGroup: "partner",
      });

      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-group-partner");
      expect(result?.precedenceMatched).toBe("group");
      expect(result?.offer.priceAmountMinor).toBe(8500000);
    });

    it("falls back to General public offer when no customer or group matches", async () => {
      const resolver = createDatabaseMock(tieredOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        customerGroup: "consumer",
      });

      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-general-base");
      expect(result?.precedenceMatched).toBe("general");
      expect(result?.offer.priceAmountMinor).toBe(10000000);
    });
  });

  describe("2. Handling Invalid Statuses (DRAFT, INACTIVE, EXPIRED)", () => {
    it("falls through higher priority tiers if status is not ACTIVE", async () => {
      const mixedStatusOffers: CommerceOfferRow[] = [
        // Customer offer is in DRAFT status
        {
          id: brandId<"EntityId">("off-customer-draft"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "customer",
          customer_group: null,
          customer_id: targetCustomerId,
          available: 1,
          price_amount_minor: 6000000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.DRAFT,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        // Group offer is INACTIVE
        {
          id: brandId<"EntityId">("off-group-inactive"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "group",
          customer_group: "partner",
          customer_id: null,
          available: 1,
          price_amount_minor: 7500000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.INACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        // General offer is ACTIVE
        {
          id: brandId<"EntityId">("off-general-active"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "general",
          customer_group: null,
          customer_id: null,
          available: 1,
          price_amount_minor: 10000000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const resolver = createDatabaseMock(mixedStatusOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        customerId: targetCustomerId,
        customerGroup: "partner",
      });

      // Customer DRAFT and Group INACTIVE are discarded, resolves ACTIVE General offer
      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-general-active");
      expect(result?.precedenceMatched).toBe("general");
      expect(result?.offer.status).toBe(OfferStatus.ACTIVE);
    });

    it("returns null when all candidate offers are invalid or inactive", async () => {
      const allInactive: CommerceOfferRow[] = [
        {
          id: brandId<"EntityId">("off-expired-explicit"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "general",
          customer_group: null,
          customer_id: null,
          available: 1,
          price_amount_minor: 10000000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.EXPIRED,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const resolver = createDatabaseMock(allInactive);
      const offer = await resolver.resolveOffer(createRequestContext(), {
        sellerId,
        productId,
      });

      expect(offer).toBeNull();
    });
  });

  describe("3. Handling Temporal Range Validity (validFrom and validTo)", () => {
    it("rejects offers where validTo has expired relative to current time", async () => {
      const timeOffers: CommerceOfferRow[] = [
        // Expired Customer Offer: ended 2026-05-31
        {
          id: brandId<"EntityId">("off-customer-expired-date"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "customer",
          customer_group: null,
          customer_id: targetCustomerId,
          available: 1,
          price_amount_minor: 6500000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: "2026-01-01T00:00:00Z",
          effective_to: "2026-05-31T23:59:59Z", // Expired compared to currentTestTime (2026-06-15)
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        // Group offer active between 2026-06-01 and 2026-07-01 (Current date is within range)
        {
          id: brandId<"EntityId">("off-group-valid-time"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "group",
          customer_group: "partner",
          customer_id: null,
          available: 1,
          price_amount_minor: 8200000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: "2026-06-01T00:00:00Z",
          effective_to: "2026-07-01T00:00:00Z",
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const resolver = createDatabaseMock(timeOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        customerId: targetCustomerId,
        customerGroup: "partner",
      });

      // Customer offer was skipped because validTo < current time. Group offer was selected.
      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-group-valid-time");
      expect(result?.precedenceMatched).toBe("group");
      expect(result?.offer.priceAmountMinor).toBe(8200000);
    });

    it("rejects offers where validFrom has not started yet", async () => {
      const futureOffers: CommerceOfferRow[] = [
        // Group offer starts in August 2026
        {
          id: brandId<"EntityId">("off-group-future-date"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "group",
          customer_group: "partner",
          customer_id: null,
          available: 1,
          price_amount_minor: 7900000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: "2026-08-01T00:00:00Z", // Future date
          effective_to: "2026-12-31T23:59:59Z",
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        // General offer always valid
        {
          id: brandId<"EntityId">("off-general-valid-always"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "general",
          customer_group: null,
          customer_id: null,
          available: 1,
          price_amount_minor: 10000000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const resolver = createDatabaseMock(futureOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        customerGroup: "partner",
      });

      // Group offer is not valid yet (validFrom > current time). Falls back to General.
      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-general-valid-always");
      expect(result?.precedenceMatched).toBe("general");
    });
  });

  describe("4. Variant Overrides and Fallback Inheritance", () => {
    it("prefers variant-specific customer offer over product base customer offer", async () => {
      const variantHierarchyOffers: CommerceOfferRow[] = [
        // Product-level customer offer: 7,000,000 Tomans
        {
          id: brandId<"EntityId">("off-prod-customer"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "customer",
          customer_group: null,
          customer_id: targetCustomerId,
          available: 1,
          price_amount_minor: 7000000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        // Variant-level customer offer: 7,800,000 Tomans
        {
          id: brandId<"EntityId">("off-var-customer"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: variantId,
          audience_type: "customer",
          customer_group: null,
          customer_id: targetCustomerId,
          available: 1,
          price_amount_minor: 7800000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const resolver = createDatabaseMock(variantHierarchyOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        variantId,
        customerId: targetCustomerId,
      });

      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-var-customer");
      expect(result?.isInheritedFromProduct).toBe(false);
      expect(result?.offer.priceAmountMinor).toBe(7800000);
    });

    it("inherits product-level offer for variant when variant has no explicit offer", async () => {
      const baseProductOffers: CommerceOfferRow[] = [
        {
          id: brandId<"EntityId">("off-prod-general"),
          organization_id: brandId<"EntityId">("tenant-acme"),
          workspace_id: brandId<"EntityId">("ws-main"),
          seller_id: sellerId,
          product_id: productId,
          variant_id: null,
          audience_type: "general",
          customer_group: null,
          customer_id: null,
          available: 1,
          price_amount_minor: 10000000,
          currency: "IRR",
          min_quantity: null,
          max_quantity: null,
          effective_from: null,
          effective_to: null,
          digital_entitlement_id: null,
          conditions_json: null,
          status: OfferStatus.ACTIVE,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const resolver = createDatabaseMock(baseProductOffers);
      const result = await resolver.resolveOfferDetailed(createRequestContext(), {
        sellerId,
        productId,
        variantId: "variant-without-own-offer",
      });

      expect(result).not.toBeNull();
      expect(result?.offer.id).toBe("off-prod-general");
      expect(result?.isInheritedFromProduct).toBe(true);
      expect(result?.precedenceMatched).toBe("general");
    });
  });
});
