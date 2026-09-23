import { describe, expect, it } from "vitest";
import { brandId } from "@qooqnos/core";
import type { AiOperationRecord } from "./runtime-repository";
import { processAIRuntimeWork } from "./worker";

function operation(status: string = "started"): AiOperationRecord {
  return {
    id: brandId<"EntityId">("operation-1"),
    organizationId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    actorId: brandId<"EntityId">("user-1"),
    sessionId: brandId<"EntityId">("session-1"),
    operationType: "seller.product.generate",
    operationVersion: 1,
    requestId: "request-1",
    correlationId: "correlation-1",
    idempotencyKey: "idem-1",
    status,
    inputReference: "payload-1",
    outputReference: null,
    workerLeaseUntil: null,
    workerClaimedBy: null,
    workerAttempts: 0,
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
  };
}

describe("processAIRuntimeWork", () => {
  it("requires a resolver and executes only claimed operations", async () => {
    const calls: string[] = [];
    const repository = {
      async listRunnableOperations() {
        return [operation()];
      },
      async claimOperation() {
        calls.push("claim");
        return operation("started");
      },
      async releaseOperationLease() {
        calls.push("release");
      },
      async recordResult() {
        calls.push("recordResult");
      },
    } as never;

    const runtime = {
      async execute(request: unknown) {
        calls.push("execute:" + ((request as { operationType: string }).operationType));
        return {
          operationId: "operation-1",
          operationType: "seller.product.generate",
          operationVersion: 1,
          status: "succeeded",
          safetyDecision: "allowed",
          provenance: "ai_generated",
          warnings: [],
          retryable: false,
        } as const;
      },
    };

    const resolver = {
      async resolve(input: AiOperationRecord) {
        calls.push("resolve:" + input.id);
        return {
          operationId: input.id,
          operationType: input.operationType,
          operationVersion: input.operationVersion,
          context: {} as never,
          idempotencyKey: input.idempotencyKey,
          input: { raw: true },
          dataClassification: "internal" as const,
          promptVersion: "seller@1",
          outputSchemaVersion: "seller@1",
          policyVersion: "seller@1",
        };
      },
    };

    const result = await processAIRuntimeWork({
      repository,
      runtime,
      resolver,
      workerId: "worker-1",
      id: () => brandId<"EntityId">("result-1"),
      now: () => "2026-09-23T00:01:00.000Z",
    });

    expect(result).toEqual({
      seen: 1,
      claimed: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
    });
    expect(calls).toEqual([
      "claim",
      "resolve:operation-1",
      "execute:seller.product.generate",
      "release",
    ]);
  });

  it("persists a resolver failure as failed runtime state", async () => {
    const calls: string[] = [];
    const repository = {
      async listRunnableOperations() {
        return [operation()];
      },
      async claimOperation() {
        return operation("started");
      },
      async releaseOperationLease() {
        calls.push("release");
      },
      async recordResult() {
        calls.push("failed-result");
      },
    } as never;

    const result = await processAIRuntimeWork({
      repository,
      runtime: { async execute() { throw new Error("should not execute"); } },
      resolver: {
        async resolve() {
          throw new Error("input resolver unavailable");
        },
      },
      workerId: "worker-1",
      id: () => brandId<"EntityId">("failure-1"),
      now: () => "2026-09-23T00:01:00.000Z",
    });

    expect(result.failed).toBe(1);
    expect(calls).toEqual(["failed-result", "release"]);
  });
});
