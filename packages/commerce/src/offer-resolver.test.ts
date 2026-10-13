import { describe, it, expect } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import {
  OfferResolver,
  type Offer,
  type CustomerGroupResolver,
  type CustomerGroup,
} from "./offer-resolver";

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

describe("OfferResolver Service", () => {
  const sellerA = brandId<"EntityId">("seller-a");
  const sellerB = brandId<"EntityId">("seller-b");
  const productShoe = brandId<"EntityId">("prod-shoe-x");
  const variant42 = brandId<"EntityId">("var-42");
  const variant43 = brandId<"EntityId">("var-43");
  const customerMohammad = brandId<"EntityId">("cust-mohammad");
  const customerStoreX = brandId<"EntityId">("cust-store-x");

  const baseOffers: Offer[] = [
    {
      id: brandId<"EntityId">("off-gen"),
      sellerId: sellerA,
      productId: productShoe,
      audience: { type: "general" },
      availabilityStatus: "available",
      available: true,
      priceAmountMinor: 2500000,
      currency: "IRR",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: brandId<"EntityId">("off-partner"),
      sellerId: sellerA,
      productId: productShoe,
      audience: { type: "group", group: "partner" },
      availabilityStatus: "available",
      available: true,
      priceAmountMinor: 2150000,
      currency: "IRR",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: brandId<"EntityId">("off-store-x"),
      sellerId: sellerA,
      productId: productShoe,
      audience: { type: "customer", customerId: customerStoreX },
      availabilityStatus: "available",
      available: true,
      priceAmountMinor: 2000000,
      currency: "IRR",
      status: "active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  it("resolves general public offer when no customer or group is specified", async () => {
    const resolver = new OfferResolver();
    const offer = await resolver.resolve(
      mockContext,
      { sellerId: sellerA, productId: productShoe },
      baseOffers,
    );
    expect(offer).not.toBeNull();
    expect(offer?.priceAmountMinor).toBe(2500000);
    expect(offer?.audience.type).toBe("general");
  });

  it("resolves group offer when customer is partner, overriding general offer", async () => {
    const resolver = new OfferResolver();
    const offer = await resolver.resolve(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        customerId: customerMohammad,
        customerGroup: "partner",
      },
      baseOffers,
    );
    expect(offer).not.toBeNull();
    expect(offer?.priceAmountMinor).toBe(2150000);
    expect(offer?.audience.type).toBe("group");
  });

  it("resolves customer-specific offer, overriding both group and general offers (Customer > Group > General)", async () => {
    const resolver = new OfferResolver();
    const offer = await resolver.resolve(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        customerId: customerStoreX,
        customerGroup: "partner",
      },
      baseOffers,
    );
    expect(offer).not.toBeNull();
    expect(offer?.priceAmountMinor).toBe(2000000);
    expect(offer?.audience.type).toBe("customer");
    expect(offer?.audience.customerId).toBe(customerStoreX);
  });

  it("returns null if no offer exists or audience has no valid offer", async () => {
    const resolver = new OfferResolver();
    const restrictedOffers: Offer[] = [
      {
        id: brandId<"EntityId">("off-partner-only"),
        sellerId: sellerA,
        productId: productShoe,
        audience: { type: "group", group: "partner" },
        availabilityStatus: "available",
        available: true,
        priceAmountMinor: 2150000,
        currency: "IRR",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const offer = await resolver.resolve(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        customerGroup: "agent",
      },
      restrictedOffers,
    );
    expect(offer).toBeNull();
  });

  it("returns null if offer is explicitly marked available: false", async () => {
    const resolver = new OfferResolver();
    const agentBlockedOffers: Offer[] = [
      ...baseOffers,
      {
        id: brandId<"EntityId">("off-agent-blocked"),
        sellerId: sellerA,
        productId: productShoe,
        audience: { type: "group", group: "agent" },
        availabilityStatus: "unavailable",
        available: false,
        priceAmountMinor: 0,
        currency: "IRR",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const offer = await resolver.resolve(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        customerGroup: "agent",
      },
      agentBlockedOffers,
    );
    expect(offer).toBeNull();
  });

  it("inherits base product offer for variants when variant has no override", async () => {
    const resolver = new OfferResolver();
    const detailed = await resolver.resolveDetailed(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        variantId: variant42,
        customerGroup: "partner",
      },
      baseOffers,
    );
    expect(detailed).not.toBeNull();
    expect(detailed?.priceAmountMinor).toBe(2150000);
    expect(detailed?.inheritedFromProduct).toBe(true);
  });

  it("overrides base product offer when variant defines its own offer", async () => {
    const resolver = new OfferResolver();
    const offersWithVariantOverride: Offer[] = [
      ...baseOffers,
      {
        id: brandId<"EntityId">("off-var43-partner"),
        sellerId: sellerA,
        productId: productShoe,
        variantId: variant43,
        audience: { type: "group", group: "partner" },
        availabilityStatus: "available",
        available: true,
        priceAmountMinor: 2300000,
        currency: "IRR",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const detailed43 = await resolver.resolveDetailed(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        variantId: variant43,
        customerGroup: "partner",
      },
      offersWithVariantOverride,
    );
    expect(detailed43).not.toBeNull();
    expect(detailed43?.priceAmountMinor).toBe(2300000);
    expect(detailed43?.inheritedFromProduct).toBe(false);

    const detailed42 = await resolver.resolveDetailed(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        variantId: variant42,
        customerGroup: "partner",
      },
      offersWithVariantOverride,
    );
    expect(detailed42).not.toBeNull();
    expect(detailed42?.priceAmountMinor).toBe(2150000);
    expect(detailed42?.inheritedFromProduct).toBe(true);
  });

  it("respects seller boundary: offer in seller A does not apply to seller B", async () => {
    const resolver = new OfferResolver();
    const offer = await resolver.resolve(
      mockContext,
      {
        sellerId: sellerB,
        productId: productShoe,
        customerGroup: "partner",
      },
      baseOffers,
    );
    expect(offer).toBeNull();
  });

  it("uses CustomerGroupResolver to determine role when customerId is provided", async () => {
    const mockGroupResolver: CustomerGroupResolver = {
      async resolveCustomerGroup(_ctx, custId, _sellerId): Promise<CustomerGroup | null> {
        if (custId === customerMohammad) {
          return "partner";
        }
        return "consumer";
      },
    };

    const resolver = new OfferResolver({ groupResolver: mockGroupResolver });
    const offer = await resolver.resolve(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        customerId: customerMohammad,
      },
      baseOffers,
    );
    expect(offer).not.toBeNull();
    expect(offer?.priceAmountMinor).toBe(2150000);
  });

  it("rejects inactive or expired offers based on timestamp conditions", async () => {
    const resolver = new OfferResolver();
    const timeOffers: Offer[] = [
      {
        id: brandId<"EntityId">("off-expired"),
        sellerId: sellerA,
        productId: productShoe,
        audience: { type: "general" },
        availabilityStatus: "available",
        available: true,
        priceAmountMinor: 1500000,
        currency: "IRR",
        status: "active",
        conditions: {
          effectiveFrom: "2026-01-01T00:00:00Z",
          effectiveTo: "2026-05-01T00:00:00Z",
        },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ];

    const offer = await resolver.resolve(
      mockContext,
      {
        sellerId: sellerA,
        productId: productShoe,
        asOf: "2026-10-01T00:00:00Z",
      },
      timeOffers,
    );
    expect(offer).toBeNull();
  });
});
