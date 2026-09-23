import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { BookingRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "booking",
    operation: "booking.finalize",
    locale: "en",
    timezone: "UTC",
  };
}

const booking = {
  id: "booking-1",
  organizationId: "tenant-1",
  workspaceId: "workspace-1",
  businessId: "business-1",
  customerId: "customer-1",
  status: "confirmed",
  currency: "AZN",
  totalAmountMinor: 1000,
  policySnapshot: null,
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
} as const;

describe("BookingRepository finalization", () => {
  it("commits hold consumption, booking and appointment in one batch", async () => {
    let batchCount = 0;
    const statement: D1PreparedStatementLike = {
      bind() {
        return this;
      },
      async first<T>() {
        return null as T | null;
      },
      async all<T>() {
        return { results: [] as T[] };
      },
      async run() {
        return { success: true };
      },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) {
        return sql.includes("WHERE id = ? AND organization_id = ? AND workspace_id = ?")
          ? {
              ...statement,
              async first<T>() {
                return booking as T;
              },
            }
          : statement;
      },
      async batch(items) {
        batchCount += 1;
        expect(items).toHaveLength(7);
        return items.map(() => ({ success: true, meta: { changes: 1 } }));
      },
    };

    const repository = new BookingRepository(new D1Database(raw));
    const result = await repository.finalize(context(), {
      bookingId: brandId<"EntityId">("booking-1"),
      idempotencyKey: "booking-finalize-1",
      businessId: brandId<"EntityId">("business-1"),
      customerId: brandId<"EntityId">("customer-1"),
      offeringId: brandId<"EntityId">("offering-1"),
      currency: "AZN",
      quantity: 1,
      titleSnapshot: "Consultation",
      priceMinorSnapshot: 1000,
      holdId: brandId<"EntityId">("hold-1"),
      startsAt: "2026-09-23T10:00:00.000Z",
      endsAt: "2026-09-23T11:00:00.000Z",
      now: "2026-09-22T10:00:00.000Z",
    });

    expect(result.id).toBe("booking-1");
    expect(batchCount).toBe(1);
  });

  it("replays the existing booking without a second transaction", async () => {
    let batchCount = 0;
    const statement: D1PreparedStatementLike = {
      bind() {
        return this;
      },
      async first<T>() {
        return booking as T;
      },
      async all<T>() {
        return { results: [] as T[] };
      },
      async run() {
        return { success: true };
      },
    };
    const raw: D1DatabaseLike = {
      prepare() {
        return statement;
      },
      async batch() {
        batchCount += 1;
        return [];
      },
    };

    const repository = new BookingRepository(new D1Database(raw));
    const result = await repository.finalize(context(), {
      bookingId: brandId<"EntityId">("booking-1"),
      idempotencyKey: "booking-finalize-1",
      businessId: brandId<"EntityId">("business-1"),
      customerId: brandId<"EntityId">("customer-1"),
      offeringId: brandId<"EntityId">("offering-1"),
      currency: "AZN",
      quantity: 1,
      titleSnapshot: "Consultation",
      priceMinorSnapshot: 1000,
      holdId: brandId<"EntityId">("hold-1"),
      startsAt: "2026-09-23T10:00:00.000Z",
      endsAt: "2026-09-23T11:00:00.000Z",
      now: "2026-09-22T10:00:00.000Z",
    });

    expect(result.id).toBe("booking-1");
    expect(batchCount).toBe(0);
  });
});
