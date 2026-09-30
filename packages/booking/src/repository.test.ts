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
  it("lists business bookings with appointment context", async () => {
    const rows = [
      {
        id: "booking-1",
        organizationId: "tenant-1",
        workspaceId: "workspace-1",
        businessId: "business-1",
        customerId: "customer-1",
        status: "confirmed",
        currency: "USD",
        totalAmountMinor: 5000,
        appointmentStatus: "confirmed",
        startsAt: "2026-09-30T10:00:00.000Z",
        endsAt: "2026-09-30T10:30:00.000Z",
        timezone: "UTC",
        locationId: null,
        resourceId: "resource-1",
        offeringId: "offering-1",
        offeringTitle: "Consultation",
        createdAt: "2026-09-30T09:00:00.000Z",
        updatedAt: "2026-09-30T09:30:00.000Z",
      },
    ];
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
    const repository = new BookingRepository(new D1Database(raw));

    const result = await repository.listBusinessBookings(
      context(),
      brandId<"EntityId">("business-1"),
      24,
    );

    expect(result[0]?.id).toBe("booking-1");
    expect(result[0]?.offeringTitle).toBe("Consultation");
    expect(result[0]?.resourceId).toBe("resource-1");
  });

describe("BookingRepository
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
