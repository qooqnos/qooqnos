import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { PromotionService } from "./service";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "promotion",
    operation: "promotion.evaluate",
    locale: "en",
    timezone: "UTC",
  };
}

describe("PromotionService", () => {
  it("rejects a promotion below its minimum amount and persists the qualification", async () => {
    let persisted: { decision: string; reasons: readonly string[] } | undefined;
    const service = new PromotionService({
      repository: {
        async getRequired() {
          return { id: brandId<"EntityId">("promotion-1"), status: "active", organizationId: brandId<"EntityId">("tenant-1"), workspaceId: brandId<"EntityId">("workspace-1") };
        },
        async getActiveVersion() {
          return {
            id: brandId<"EntityId">("version-1"),
            promotionId: brandId<"EntityId">("promotion-1"),
            version: 1,
            status: "active",
            benefit: { type: "PERCENTAGE_DISCOUNT", value: 10 },
            eligibilityRules: { minimumAmountMinor: 5000 },
            stackPolicy: {},
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            effectiveTo: null,
          };
        },
        async qualify(_context: RequestContext, input: { decision: string; reasons: readonly string[] }) {
          persisted = { decision: input.decision, reasons: input.reasons };
          return input;
        },
        async countCustomerRedemptions() { return 0; },
      } as never,
      authorization: { async assert() {} } as never,
      id: () => brandId<"EntityId">("generated"),
      now: () => "2026-09-25T00:00:00.000Z",
    });

    await service.evaluate(context(), {
      promotionId: brandId<"EntityId">("promotion-1"),
      subjectId: brandId<"EntityId">("customer-1"),
      amountMinor: 4999,
      idempotencyKey: "qualification-1",
    });

    expect(persisted?.decision).toBe("rejected");
    expect(persisted?.reasons).toContain("minimum_amount");
  });
});
