import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { LoyaltyService } from "./service";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "loyalty",
    operation: "loyalty.adjust",
    locale: "en",
    timezone: "UTC",
  };
}

describe("LoyaltyService", () => {
  it("rejects zero-point ledger adjustments before repository mutation", async () => {
    let called = false;
    const service = new LoyaltyService({
      repository: {
        async postLedger() {
          called = true;
          return {};
        },
      } as never,
      authorization: { async assert() {} } as never,
      id: () => brandId<"EntityId">("generated"),
      now: () => "2026-09-25T00:00:00.000Z",
    });

    await expect(service.postLedger(context(), {
      membershipId: brandId<"EntityId">("membership-1"),
      entryType: "adjustment",
      pointsDelta: 0,
      idempotencyKey: "entry-1",
    })).rejects.toThrow("pointsDelta must be a non-zero integer");

    expect(called).toBe(false);
  });
});
