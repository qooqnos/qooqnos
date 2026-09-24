import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { AdvertisingService } from "./service";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "advertising",
    operation: "advertising.delivery",
    locale: "en",
    timezone: "UTC",
  };
}

describe("AdvertisingService", () => {
  it("rejects sponsored delivery until moderation and active state are both satisfied", async () => {
    const service = new AdvertisingService({
      repository: {
        async getAd() {
          return {
            id: brandId<"EntityId">("ad-1"),
            campaignVersionId: brandId<"EntityId">("version-1"),
            subjectType: "product",
            subjectId: brandId<"EntityId">("product-1"),
            creativeReference: "creative-1",
            moderationStatus: "pending",
            status: "draft",
            createdAt: "2026-09-25T00:00:00.000Z",
            updatedAt: "2026-09-25T00:00:00.000Z",
          };
        },
      } as never,
      authorization: { async assert() {} } as never,
      id: () => brandId<"EntityId">("generated"),
      now: () => "2026-09-25T00:00:00.000Z",
    });

    await expect(service.decideDelivery(context(), {
      adId: brandId<"EntityId">("ad-1"),
      placementId: brandId<"EntityId">("placement-1"),
      decision: "served",
      policyVersion: "advertising-v1",
      deduplicationKey: "delivery-1",
    })).rejects.toThrow("Only active ads can be served");
  });
});
