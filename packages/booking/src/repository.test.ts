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
    operation: "booking.create",
    locale: "en",
    timezone: "UTC",
  };
}

describe("BookingRepository", () => {
  it("keeps terminal bookings from being reopened", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "booking-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          businessId: "business-1",
          customerId: "customer-1",
          status: "completed",
          currency: "AZN",
          totalAmountMinor: 1000,
          policySnapshot: null,
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
    const repository = new BookingRepository(new D1Database(raw));

    await expect(repository.setStatus(
      context(),
      brandId<"EntityId">("booking-1"),
      "confirmed",
      "2026-09-22T00:01:00.000Z",
    )).rejects.toThrow("cannot be reopened");
  });
});
