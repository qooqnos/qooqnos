import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { CapabilityRegistry } from "@qooqnos/runtime";
import { AutomationExecutor } from "./executor";

const context: RequestContext = {
  requestId: brandId<"RequestId">("req-1"),
  correlationId: brandId<"CorrelationId">("corr-1"),
  actorId: brandId<"EntityId">("user-1"),
  tenantId: brandId<"EntityId">("tenant-1"),
  workspaceId: brandId<"EntityId">("workspace-1"),
  module: "automation",
  operation: "automation.execution.manage",
  locale: "en",
  timezone: "UTC",
};

describe("AutomationExecutor", () => {
  it("invokes registered capability once and completes the execution", async () => {
    let invocations = 0;
    const capabilities = new CapabilityRegistry();
    capabilities.register({
      id: "catalog.refresh",
      async handler() {
        invocations += 1;
        return { ok: true };
      },
    });

    type StepState = {
      readonly id: string;
      readonly executionId: string;
      readonly stepId: string;
      status: "pending" | "running" | "completed" | "failed";
      readonly sequence: number;
      outputReference: string | null;
    };

    type RepositoryStub = {
      getExecution: () => Promise<{
        id: string;
        workflowId: string;
        workflowVersionId: string;
        triggerId: string;
        organizationId: string;
        workspaceId: string;
        businessId: string | null;
        status: string;
        inputReference: string | null;
        correlationId: string;
        traceId: string;
        startedAt: string | null;
        completedAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      listActions: () => Promise<readonly [{
        id: ReturnType<typeof brandId<"EntityId">>;
        capability: string;
        inputMappingJson: string;
        sequence: number;
      }]>;
      getStepExecution: (_ctx: RequestContext, _executionId: string, stepId: string) => Promise<StepState | null>;
      createStepExecution: (_ctx: RequestContext, input: { id: string; executionId: string; stepId: string; sequence: number; now: string }) => Promise<StepState>;
      updateStepExecution: (_ctx: RequestContext, input: { id: string; status: StepState["status"]; outputReference?: string; inputReference?: string; startedAt?: string; completedAt?: string; now: string }) => Promise<void>;
      createExecutionAttempt: () => Promise<void>;
      completeExecutionAttempt: () => Promise<void>;
      recordExecutionError: () => Promise<void>;
      setExecutionStatus: (_ctx: RequestContext, _id: string, status: string, now?: string) => Promise<undefined>;
    };

    const existingSteps = new Map<string, StepState>();
    let executionStatus = "running";

    const repository = {
      async getExecution() {
        return {
          id: "execution-1",
          workflowId: "workflow-1",
          workflowVersionId: "version-1",
          triggerId: "trigger-1",
          organizationId: "tenant-1",
          workspaceId: "workspace-1",
          businessId: null,
          status: executionStatus,
          inputReference: null,
          correlationId: "corr-1",
          traceId: "trace-1",
          startedAt: null,
          completedAt: null,
          createdAt: "2026-09-23T00:00:00.000Z",
          updatedAt: "2026-09-23T00:00:00.000Z",
        };
      },
      async listActions() {
        return [{
          id: brandId<"EntityId">("action-1"),
          capability: "catalog.refresh",
          inputMappingJson: JSON.stringify({ scope: "all" }),
          sequence: 0,
        }];
      },
      async getStepExecution(_ctx: RequestContext, _executionId: string, stepId: string) {
        return existingSteps.get(stepId) ?? null;
      },
      async createStepExecution(_ctx: RequestContext, input: { id: string; executionId: string; stepId: string; sequence: number }) {
        const row: StepState = { id: input.id, executionId: input.executionId, stepId: input.stepId, status: "pending", sequence: input.sequence, outputReference: null };
        existingSteps.set(input.stepId, row);
        return row;
      },
      async updateStepExecution(_ctx: RequestContext, input: { id: string; status: StepState["status"]; outputReference?: string }) {
        const row = [...existingSteps.values()].find((entry) => entry.id === input.id);
        if (row) {
          row.status = input.status;
          row.outputReference = input.outputReference ?? row.outputReference;
        }
      },
      async createExecutionAttempt() {},
      async completeExecutionAttempt() {},
      async recordExecutionError() { throw new Error("unexpected error"); },
      async setExecutionStatus(_ctx: RequestContext, _id: string, status: string) {
        executionStatus = status;
        return undefined;
      },
    } as unknown as import("./repository").AutomationRepository;

    const executor = new AutomationExecutor({
      repository,
      capabilities,
      id: () => brandId<"EntityId">(crypto.randomUUID()),
      now: () => "2026-09-23T00:00:00.000Z",
    });

    await expect(executor.execute(context, brandId<"EntityId">("execution-1"))).resolves.toBe("completed");
    await expect(executor.execute(context, brandId<"EntityId">("execution-1"))).resolves.toBe("completed");
    expect(invocations).toBe(1);
  });

  it("rejects duplicate capability registration", () => {
    const registry = new CapabilityRegistry();
    const definition = { id: "booking.confirm", handler: async () => true };
    registry.register(definition);
    expect(() => registry.register(definition)).toThrow("already registered");
  });
});
