import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { AiRuntimeService } from "./runtime-service";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "ai",
    operation: "ai.operation.start",
    locale: "en",
    timezone: "UTC",
  };
}

describe("AiRuntimeService", () => {
  it("blocks operations denied by Billing entitlement", async () => {
    let finalStatus = "";
    const service = new AiRuntimeService({
      repository: {
        createOperation: async () => ({
          id: "operation-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          operationType: "seller.product.generate",
          operationVersion: 1,
          requestId: "req-1",
          correlationId: "corr-1",
          idempotencyKey: "idem-1",
          status: "created",
          inputReference: null,
          outputReference: null,
          createdAt: "2026-09-22T00:00:00.000Z",
          updatedAt: "2026-09-22T00:00:00.000Z",
        }),
        setOperationStatus: async (_context: RequestContext, _id: string, status: string) => {
          finalStatus = status;
          return { id: "operation-1", status } as never;
        },
      } as never,
      entitlement: {
        evaluate: async () => ({
          allowed: false,
          decision: "denied",
          entitlementDecisionId: "decision-1",
          reason: "quota exhausted",
        }),
      },
      id: () => brandId<"EntityId">("id-1"),
      now: () => "2026-09-22T00:00:00.000Z",
    });

    const result = await service.startOperation(context(), {
      operationTypeId: brandId<"EntityId">("operation-type-1"),
      operationType: "seller.product.generate",
      operationVersion: 1,
      requestId: "req-1",
      correlationId: "corr-1",
      idempotencyKey: "idem-1",
      businessId: brandId<"EntityId">("business-1"),
    });

    expect(finalStatus).toBe("blocked");
    expect(result.entitlement?.allowed).toBe(false);
  });
});
