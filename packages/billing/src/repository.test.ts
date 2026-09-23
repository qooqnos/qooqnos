import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { D1Database, type D1DatabaseLike, type D1PreparedStatementLike } from "@qooqnos/database";
import { BillingRepository } from "./repository";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "billing",
    operation: "billing.subscription.manage",
    locale: "en",
    timezone: "UTC",
  };
}

function repositoryWithStatus(status: "cancelled" | "expired") {
  const statement: D1PreparedStatementLike = {
    bind() { return this; },
    async first<T>() {
      return {
        id: "subscription-1",
        organizationId: "tenant-1",
        workspaceId: "workspace-1",
        businessId: "business-1",
        planId: "plan-1",
        billingPriceId: "price-1",
        status,
        startsAt: "2026-09-01T00:00:00.000Z",
        trialEndsAt: null,
        currentPeriodStart: "2026-09-01T00:00:00.000Z",
        currentPeriodEnd: "2026-10-01T00:00:00.000Z",
        graceUntil: null,
        cancelledAt: status === "cancelled" ? "2026-09-20T00:00:00.000Z" : null,
        expiresAt: status === "expired" ? "2026-09-22T00:00:00.000Z" : null,
        version: 2,
        createdAt: "2026-09-01T00:00:00.000Z",
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
  return new BillingRepository(new D1Database(raw));
}

describe("BillingRepository", () => {
  it("does not reopen cancelled subscriptions", async () => {
    const repository = repositoryWithStatus("cancelled");

    await expect(repository.transitionSubscription(
      context(),
      brandId<"EntityId">("subscription-1"),
      "active",
      "2026-09-23T00:00:00.000Z",
      "2026-09-23T00:00:00.000Z",
      "corr-1",
    )).rejects.toThrow("can only expire");
  });

  it("does not reopen expired subscriptions", async () => {
    const repository = repositoryWithStatus("expired");

    await expect(repository.transitionSubscription(
      context(),
      brandId<"EntityId">("subscription-1"),
      "active",
      "2026-09-23T00:00:00.000Z",
      "2026-09-23T00:00:00.000Z",
      "corr-2",
    )).rejects.toThrow("cannot be reopened");
  });
});
