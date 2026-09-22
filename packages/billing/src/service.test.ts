import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { BillingService } from "./service";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "billing",
    operation: "billing.entitlement.evaluate",
    locale: "en",
    timezone: "UTC",
  };
}

describe("BillingService", () => {
  it("requires business scope for AI entitlement evaluation", async () => {
    const service = new BillingService({
      repository: {} as never,
      id: () => "decision-1",
      now: () => "2026-09-22T00:00:00.000Z",
    });

    const result = await service.evaluate({
      context: context(),
      operationId: "op-1",
      operationType: "ai.requests.monthly",
      operationVersion: 1,
      idempotencyKey: "idem-1",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Business billing scope");
  });

  it("denies when an active subscription has no matching entitlement", async () => {
    const service = new BillingService({
      repository: {
        getActiveSubscription: async () => ({
          id: "subscription-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          businessId: "business-1",
          planId: "plan-1",
          billingPriceId: "price-1",
          status: "active",
          startsAt: "2026-09-01T00:00:00.000Z",
          trialEndsAt: null,
          currentPeriodStart: "2026-09-01T00:00:00.000Z",
          currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          graceUntil: null,
          cancelledAt: null,
          expiresAt: null,
          version: 1,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        }),
        listEntitlementSnapshots: async () => [],
      } as never,
      id: () => "decision-2",
      now: () => "2026-09-22T00:00:00.000Z",
    });

    const result = await service.evaluate({
      context: context(),
      operationId: "op-2",
      operationType: "ai.requests.monthly",
      operationVersion: 1,
      businessId: brandId<"EntityId">("business-1"),
      idempotencyKey: "idem-2",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("No Billing entitlement");
  });

  it("passes the integer plan entitlement as the atomic quota limit", async () => {
    let captured: Record<string, unknown> | undefined;
    const service = new BillingService({
      repository: {
        getActiveSubscription: async () => ({
          id: "subscription-2",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          businessId: "business-1",
          planId: "plan-1",
          billingPriceId: "price-1",
          status: "active",
          startsAt: "2026-09-01T00:00:00.000Z",
          trialEndsAt: null,
          currentPeriodStart: "2026-09-01T00:00:00.000Z",
          currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          graceUntil: null,
          cancelledAt: null,
          expiresAt: null,
          version: 1,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        }),
        listEntitlementSnapshots: async () => [{
          id: "snapshot-1",
          subscriptionId: "subscription-2",
          entitlementKey: "seller.product.extract",
          valueType: "integer" as const,
          value: 5,
          sourcePlanId: "plan-1",
          sourcePlanVersion: 1,
          effectiveFrom: "2026-09-01T00:00:00.000Z",
          effectiveTo: null,
        }],
        consumeUsageQuota: async (_context: RequestContext, input: Record<string, unknown>) => {
          captured = input;
          return { allowed: true, limit: 5, remaining: 4 };
        },
      } as never,
      id: () => "decision-3",
      now: () => "2026-09-22T00:00:00.000Z",
    });

    const result = await service.evaluate({
      context: context(),
      operationId: "op-3",
      operationType: "seller.product.extract",
      operationVersion: 1,
      businessId: brandId<"EntityId">("business-1"),
      idempotencyKey: "idem-3",
    });

    expect(result.decision).toBe("quota_consumed");
    expect(captured?.fallbackLimit).toBe(5);
    expect(result.quotaLimit).toBe(5);
    expect(result.quotaRemaining).toBe(4);
  });

});
