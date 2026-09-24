import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CapabilityRegistry } from "@qooqnos/runtime";
import { AutomationExecutor } from "./executor";

const context: RequestContext = {
  requestId: brandId<"RequestId">("req-comp"),
  correlationId: brandId<"CorrelationId">("corr-comp"),
  actorId: brandId<"EntityId">("user-comp"),
  tenantId: brandId<"EntityId">("tenant-comp"),
  workspaceId: brandId<"EntityId">("workspace-comp"),
  module: "automation",
  operation: "automation.execution.manage",
  locale: "en",
  timezone: "UTC",
};

describe("Automation compensation", () => {
  it("compensates completed prior actions in reverse order", async () => {
    const calls: string[] = [];
    const refs = new Map<string, any>();
    const steps = new Map<string, any>();
    let executionStatus = "running";
    const registry = new CapabilityRegistry();
    registry.register({ id: "test.reserve", async handler() { calls.push("reserve"); return { id: "r1" }; } });
    registry.register({ id: "test.fail", async handler() { calls.push("fail"); throw new Error("boom"); } });
    registry.register({ id: "test.release", async handler(_ctx, input: any) { calls.push("release:" + input.originalOutput.id); return { ok: true }; } });

    const repository = {
      async getExecution() { return { id:"e",workflowId:"w",workflowVersionId:"v",triggerId:"t",organizationId:"o",workspaceId:"ws",businessId:null,status:executionStatus,inputReference:null,correlationId:"c",traceId:"tr",startedAt:null,completedAt:null,createdAt:"now",updatedAt:"now" }; },
      async listActions() { return [
        { id: brandId<"EntityId">("a1"), capability:"test.reserve", inputMappingJson:"{}", compensationPolicyJson:'{"version":1,"mode":"automatic","capability":"test.release"}', sequence:0 },
        { id: brandId<"EntityId">("a2"), capability:"test.fail", inputMappingJson:"{}", compensationPolicyJson:null, sequence:1 },
      ]; },
      async getStepExecution(_c: RequestContext, _e: string, id: string) { return steps.get(id) ?? null; },
      async createStepExecution(_c: RequestContext, input: any) { const row={id:input.id,executionId:input.executionId,stepId:input.stepId,status:"pending",sequence:input.sequence,outputReference:null,inputReference:null}; steps.set(input.stepId,row); return row; },
      async updateStepExecution(_c: RequestContext, input: any) { const row=[...steps.values()].find((x:any)=>x.id===input.id); if(row) Object.assign(row,input); },
      async createExecutionAttempt() {},
      async completeExecutionAttempt() {},
      async recordExecutionError() {},
      async getCompensationReference(_c: RequestContext,_e: string,id: string) { return refs.get(id) ?? null; },
      async createCompensationReference(_c: RequestContext,input: any) { const row={...input,status:"requested",outputReference:null,evidenceReference:null}; refs.set(input.failedActionId,row); return row; },
      async updateCompensationReference(_c: RequestContext,input: any) { const row=refs.get(input.failedActionId); Object.assign(row,input); return row; },
      async setExecutionStatus(_c: RequestContext,_id: string,status: string) { executionStatus=status; return undefined; },
    } as unknown as import("./repository").AutomationRepository;

    const executor = new AutomationExecutor({ repository, capabilities:registry, id:()=>brandId<"EntityId">("id-"+Math.random()), now:()=> "2026-09-23T00:00:00.000Z" });
    await expect(executor.execute(context, brandId<"EntityId">("e"))).resolves.toBe("failed");
    expect(calls).toEqual(["reserve","fail","release:r1"]);
    expect(refs.get("a1")?.status).toBe("completed");
    expect(refs.get("a1")?.evidenceReference).toContain("automation.compensation");
  });
});
