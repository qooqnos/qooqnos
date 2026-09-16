import { describe, expect, it } from "vitest";
import { createUnavailableBillingAIEntitlementService } from "./billing";

const service = createUnavailableBillingAIEntitlementService();

describe("Unavailable Billing AI entitlement boundary", () => {
  it("fails closed without inventing entitlement or pricing state", async () => {
    const decision = await service.evaluate({
      operationId: "op-1",
      operationType: "seller.product.extract",
      operationVersion: 1,
      idempotencyKey: "idem-1",
      context: {
        requestId: "req-1" as never,
        correlationId: "corr-1" as never,
        actorId: "actor-1" as never,
        tenantId: "tenant-1" as never,
        workspaceId: "workspace-1" as never,
        module: "ai",
        operation: "seller.product.extract",
        locale: "en",
        timezone: "UTC",
      },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe("temporary_unavailable");
    expect(decision.reason).toBe("Billing entitlement service is not configured.");
    expect(decision.entitlementKey).toBeUndefined();
    expect(decision.quotaKey).toBeUndefined();
    expect(decision.pricingVersion).toBeUndefined();
    expect(decision.reservedUnits).toBeUndefined();
  });
});
