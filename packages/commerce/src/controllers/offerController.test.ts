import { describe, it, expect, beforeEach } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { OfferController } from "./offerController";
import { CommerceRepository, type CommerceOfferRow } from "../repository";
import { OfferStatus } from "../types/offer";

type MockD1Statement = D1PreparedStatementLike & { _bound?: unknown[] };

function asCommerceOfferRow(value: Record<string, unknown>): CommerceOfferRow {
  return value as unknown as CommerceOfferRow;
}

function createMockContext(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-offer-ctrl"),
    correlationId: brandId<"CorrelationId">("corr-offer-ctrl"),
    actorId: brandId<"EntityId">("actor-seller-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "commerce",
    operation: "commerce.offer.manage",
    locale: "fa",
    timezone: "Asia/Tehran",
  };
}

describe("OfferController (API Controller for Offer Lifecycle)", () => {
  let mockRows: CommerceOfferRow[] = [];
  let controller: OfferController;

  beforeEach(() => {
    mockRows = [];
    const statement: D1PreparedStatementLike = {
      bind(...params: unknown[]) {
        (this as MockD1Statement)._bound = params;
        return this;
      },
      async first<T>() {
        const bound = (this as MockD1Statement)._bound || [];
        const id = bound[0];
        const found = mockRows.find((r) => r.id === id);
        return (found as T) ?? null;
      },
      async all<T>() {
        return { results: mockRows as T[] };
      },
      async run() {
        const bound = (this as MockD1Statement)._bound || [];
        if (bound.length >= 21) {
          // INSERT
          const row = asCommerceOfferRow({
            id: bound[0],
            organization_id: bound[1],
            workspace_id: bound[2],
            seller_id: bound[3],
            product_id: bound[4],
            variant_id: bound[5],
            audience_type: bound[6],
            customer_group: bound[7],
            customer_id: bound[8],
            available: bound[9],
            price_amount_minor: bound[10],
            currency: bound[11],
            min_quantity: bound[12],
            max_quantity: bound[13],
            effective_from: bound[14],
            effective_to: bound[15],
            valid_from: bound[16],
            valid_to: bound[17],
            digital_entitlement_id: bound[18],
            conditions_json: bound[19],
            status: bound[20],
            created_at: bound[21],
            updated_at: bound[22],
          });
          mockRows.push(row);
        } else if (bound.length > 0) {
          // UPDATE
          const id = bound[bound.length - 1];
          const idx = mockRows.findIndex((r) => r.id === id);
          if (idx !== -1) {
            mockRows[idx] = asCommerceOfferRow({
              ...mockRows[idx]!,
              seller_id: bound[0],
              product_id: bound[1],
              variant_id: bound[2],
              audience_type: bound[3],
              customer_group: bound[4],
              customer_id: bound[5],
              available: bound[6],
              price_amount_minor: bound[7],
              currency: bound[8],
              min_quantity: bound[9],
              max_quantity: bound[10],
              effective_from: bound[11],
              effective_to: bound[12],
              valid_from: bound[13],
              valid_to: bound[14],
              digital_entitlement_id: bound[15],
              conditions_json: bound[16],
              status: bound[17],
              updated_at: bound[18],
            });
          }
        }
        return { success: true };
      },
    };

    const raw: D1DatabaseLike = {
      prepare() {
        return statement;
      },
      async batch() {
        return [];
      },
    };

    const repo = new CommerceRepository(new D1Database(raw));
    controller = new OfferController({
      repository: repo,
      idGenerator: () => brandId<"EntityId">("off-test-123"),
      now: () => "2026-06-01T10:00:00Z",
    });
  });

  it("creates a new Offer record with valid ACTIVE status and fields", async () => {
    const offer = await controller.createOffer(createMockContext(), {
      sellerId: "seller-alpha",
      productId: "prod-laptop-x",
      customerGroup: "partner",
      priceAmountMinor: 15000000,
      currency: "IRR",
      status: OfferStatus.ACTIVE,
      validFrom: "2026-01-01T00:00:00Z",
      validTo: "2026-12-31T23:59:59Z",
    });

    expect(offer.id).toBe("off-test-123");
    expect(offer.sellerId).toBe("seller-alpha");
    expect(offer.productId).toBe("prod-laptop-x");
    expect(offer.customerGroup).toBe("partner");
    expect(offer.status).toBe(OfferStatus.ACTIVE);
    expect(offer.available).toBe(true);
    expect(offer.priceAmountMinor).toBe(15000000);
  });

  it("validates and rejects invalid status values", async () => {
    await expect(
      controller.createOffer(createMockContext(), {
        sellerId: "seller-alpha",
        productId: "prod-laptop-x",
        priceAmountMinor: 1000,
        status: "INVALID_STATUS",
      }),
    ).rejects.toThrowError(/Invalid offer status/);
  });

  it("validates and rejects negative price amounts", async () => {
    await expect(
      controller.createOffer(createMockContext(), {
        sellerId: "seller-alpha",
        productId: "prod-laptop-x",
        priceAmountMinor: -500,
      }),
    ).rejects.toThrowError(/priceAmountMinor must be a non-negative integer/);
  });

  it("validates and rejects inverted date ranges (validTo <= validFrom)", async () => {
    await expect(
      controller.createOffer(createMockContext(), {
        sellerId: "seller-alpha",
        productId: "prod-laptop-x",
        priceAmountMinor: 1000,
        validFrom: "2026-12-31T00:00:00Z",
        validTo: "2026-01-01T00:00:00Z",
      }),
    ).rejects.toThrowError(/validTo timestamp must be strictly after validFrom/);
  });

  it("updates an existing Offer and allows managing the status field", async () => {
    // First create
    await controller.createOffer(createMockContext(), {
      sellerId: "seller-alpha",
      productId: "prod-laptop-x",
      priceAmountMinor: 1000000,
      status: OfferStatus.DRAFT,
    });

    // Update to ACTIVE with price change
    const updated = await controller.updateOffer(createMockContext(), "off-test-123", {
      priceAmountMinor: 1200000,
      status: OfferStatus.ACTIVE,
    });

    expect(updated.priceAmountMinor).toBe(1200000);
    expect(updated.status).toBe(OfferStatus.ACTIVE);
  });

  it("disables an Offer record by setting available=false and optionally status=INACTIVE", async () => {
    // Create initial
    await controller.createOffer(createMockContext(), {
      sellerId: "seller-alpha",
      productId: "prod-laptop-x",
      priceAmountMinor: 1000000,
      status: OfferStatus.ACTIVE,
      available: true,
    });

    // Disable offer
    const disabled = await controller.disableOffer(createMockContext(), "off-test-123", {
      setInactiveStatus: true,
    });

    expect(disabled.available).toBe(false);
    expect(disabled.status).toBe(OfferStatus.INACTIVE);
  });
});
