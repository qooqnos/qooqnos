import { describe, expect, it, vi } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { createSellerProductAIRuntimePolicy } from "./ai-runtime-policy";

const context: RequestContext = {
  requestId: brandId<"RequestId">("req-1"),
  correlationId: brandId<"CorrelationId">("corr-1"),
  actorId: brandId<"EntityId">("actor-1"),
  tenantId: brandId<"EntityId">("tenant-1"),
  workspaceId: brandId<"EntityId">("workspace-1"),
  module: "ai",
  operation: "seller.product.extract",
  locale: "en",
  timezone: "UTC",
};

describe("Seller AI runtime policy", () => {
  it("passes the full AI operation identity to Billing and translates the decision", async () => {
    const authorization = { assert: vi.fn(async () => undefined) };
    const billing = {
      evaluate: vi.fn(async () => ({
        allowed: true,
        decision: "quota_consumed" as const,
        entitlementDecisionId: "entitlement-1",
        entitlementKey: "seller-ai.extract",
        quotaRemaining: 42,
        meterId: "ai.tokens",
        reservedUnits: 3,
        pricingVersion: "pricing-7",
      })),
    };
    const policy = createSellerProductAIRuntimePolicy({
      authorization,
      billing,
      validateOutput() {},
      async validateSafety() { return "allowed" as const; },
    });

    const decision = await policy.checkEntitlement({
      operationId: "operation-1",
      operationType: "seller.product.extract",
      operationVersion: 2,
      context,
      idempotencyKey: "idem-1",
      input: { title: "Example" },
      dataClassification: "internal",
      promptVersion: "prompt-3",
      outputSchemaVersion: "schema-2",
      policyVersion: "policy-5",
      budgetUnits: 10,
    });

    expect(billing.evaluate).toHaveBeenCalledWith({
      context,
      operationId: "operation-1",
      operationType: "seller.product.extract",
      operationVersion: 2,
      idempotencyKey: "idem-1",
      budgetUnits: 10,
    });
    expect(decision).toMatchObject({
      allowed: true,
      decision: "quota_consumed",
      entitlementDecisionId: "entitlement-1",
      entitlementKey: "seller-ai.extract",
      policyVersion: "pricing-7",
      meterKey: "ai.tokens",
      reservedQuantity: 3,
      pricingReference: "pricing-7",
    });
  });

  it("uses the canonical AI permission with authentication and workspace requirements", async () => {
    const authorization = { assert: vi.fn(async () => undefined) };
    const billing = { evaluate: vi.fn() };
    const policy = createSellerProductAIRuntimePolicy({
      authorization,
      billing,
      validateOutput() {},
      async validateSafety() { return "allowed" as const; },
    });

    await policy.authorize(context, "seller.product.extract");

    expect(authorization.assert).toHaveBeenCalledWith({
      context,
      permission: "ai.seller_product.generate_draft",
      requireAuthentication: true,
      requireWorkspace: true,
    });
  });
});
