import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { AutomationService } from "./service";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "automation",
    operation: "automation.workflow.activate",
    locale: "en",
    timezone: "UTC",
  };
}

describe("AutomationService lifecycle", () => {
  it("activates a workflow version through the repository boundary", async () => {
    const calls: string[] = [];
    const service = new AutomationService({
      repository: {
        async activateVersion(_context: RequestContext, workflowId: string, versionId: string) {
          calls.push(workflowId + ":" + versionId);
          return { id: workflowId, activeVersionId: versionId, status: "active" };
        },
      } as never,
      authorization: { async assert() {} } as never,
      id: () => brandId<"EntityId">("generated"),
      traceId: () => "trace-1",
      now: () => "2026-09-23T00:00:00.000Z",
    });

    const result = await service.activateVersion(context(), {
      workflowId: brandId<"EntityId">("workflow-1"),
      versionId: brandId<"EntityId">("version-2"),
    });

    expect(result.activeVersionId).toBe("version-2");
    expect(calls).toEqual(["workflow-1:version-2"]);
  });

  it("pauses and retires through one canonical workflow lifecycle operation", async () => {
    const calls: string[] = [];
    const service = new AutomationService({
      repository: {
        async setWorkflowStatus(_context: RequestContext, workflowId: string, status: string) {
          calls.push(workflowId + ":" + status);
          return { id: workflowId, status };
        },
      } as never,
      authorization: { async assert() {} } as never,
      id: () => brandId<"EntityId">("generated"),
      traceId: () => "trace-1",
      now: () => "2026-09-23T00:00:00.000Z",
    });

    await service.pauseWorkflow(context(), brandId<"EntityId">("workflow-1"));
    await service.retireWorkflow(context(), brandId<"EntityId">("workflow-1"));

    expect(calls).toEqual(["workflow-1:paused", "workflow-1:retired"]);
  });
});
