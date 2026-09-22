import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CustomerAddressRepository } from "./customer-address-repository";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "./client";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "customer",
    operation: "customer.address.create",
    locale: "en",
    timezone: "UTC",
  };
}

describe("CustomerAddressRepository", () => {
  it("rejects addresses for a customer outside the organization", async () => {
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() { return null as T | null; },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare() { return statement; },
      async batch() { return []; },
    };
    const repository = new CustomerAddressRepository(new D1Database(raw));

    await expect(repository.create(context(), {
      id: brandId<"EntityId">("address-1"),
      customerId: brandId<"EntityId">("customer-foreign"),
      countryCode: "az",
      now: "2026-09-22T00:00:00.000Z",
    })).rejects.toThrow("not available in the current organization");
  });

  it("normalizes country code before persistence", async () => {
    const statements: string[] = [];
    const statement: D1PreparedStatementLike = {
      bind() { return this; },
      async first<T>() {
        return {
          id: "address-1",
          customerId: "customer-1",
          countryCode: "AZ",
          administrativeArea: null,
          locality: "Baku",
          district: null,
          postalCode: null,
          streetLine1: "Main Street",
          streetLine2: null,
          buildingNumber: "1",
          unit: null,
          formatted: null,
          locale: "az-AZ",
          createdAt: "2026-09-22T00:00:00.000Z",
          updatedAt: "2026-09-22T00:00:00.000Z",
        } as T;
      },
      async all<T>() { return { results: [] as T[] }; },
      async run() { return { success: true }; },
    };
    const raw: D1DatabaseLike = {
      prepare(sql: string) { statements.push(sql); return statement; },
      async batch() { return []; },
    };
    const repository = new CustomerAddressRepository(new D1Database(raw));
    const result = await repository.create(context(), {
      id: brandId<"EntityId">("address-1"),
      customerId: brandId<"EntityId">("customer-1"),
      countryCode: "az",
      locality: "Baku",
      streetLine1: "Main Street",
      buildingNumber: "1",
      locale: "az-AZ",
      now: "2026-09-22T00:00:00.000Z",
    });

    expect(result.countryCode).toBe("AZ");
    expect(statements.some((sql) => sql.includes("INSERT INTO customer_addresses"))).toBe(true);
  });
});
