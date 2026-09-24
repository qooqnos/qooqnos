import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { ApprovalService } from "./approval-service";

const context: RequestContext = {
  requestId: brandId<"RequestId">("req-1"),
  correlationId: brandId<"CorrelationId">("corr-1"),
  actorId: brandId<"EntityId">("actor-1"),
  tenantId: brandId<"EntityId">("tenant-1"),
  workspaceId: brandId<"EntityId">("workspace-1"),
  module: "authorization",
  operation: "approval",
  locale: "en",
  timezone: "UTC",
};

describe("ApprovalService", () => {
  it("delegates approve to the repository while preserving the approver actor", async () => {
    let decidedBy: string | undefined;
    const service = new ApprovalService({
      repository: {
        async decide(_context, input) {
          decidedBy = input.decidedBy;
          return { id: input.id, status: input.status };
        },
      } as never,
      authorization: { async assert() {} } as never,
      id: () => brandId<"EntityId">("approval-1"),
      now: () => "2026-09-25T00:00:00.000Z",
    });

    const result = await service.approve(context, brandId<"EntityId">("approval-1"), context.actorId!, "approved");
    expect(result.status).toBe("approved");
    expect(decidedBy).toBe("actor-1");
  });
});
