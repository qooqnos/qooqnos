import type { EntityId, RequestContext } from "@qooqnos/core";
import { AiRuntimeRepository, type AiOperationRecord } from "./runtime-repository";
import type { AIRuntimeRequest, AIRuntimeClient } from "./types";

export interface AIRuntimeInputResolver {
  resolve(
    operation: AiOperationRecord,
    context: RequestContext,
  ): Promise<AIRuntimeRequest>;
}

export interface AIRuntimeWorkerOptions {
  readonly repository: AiRuntimeRepository;
  readonly runtime: AIRuntimeClient;
  readonly resolver: AIRuntimeInputResolver;
  readonly workerId: string;
  readonly id: () => EntityId;
  readonly now: () => string;
  readonly leaseMs?: number;
}

export interface AIRuntimeWorkerResult {
  readonly seen: number;
  readonly claimed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped: number;
}

export async function processAIRuntimeWork(
  options: AIRuntimeWorkerOptions,
  limit = 10,
): Promise<AIRuntimeWorkerResult> {
  const now = options.now();
  const leaseMs = options.leaseMs ?? 60_000;
  const leaseUntil = new Date(Date.parse(now) + leaseMs).toISOString();
  const runnable = await options.repository.listRunnableOperations(now, limit);

  let claimedCount = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of runnable) {
    const claimed = await options.repository.claimOperation(
      candidate.id,
      options.workerId,
      now,
      leaseUntil,
    );
    if (!claimed) {
      skipped += 1;
      continue;
    }
    claimedCount += 1;

    const context = createWorkerContext(claimed);

    try {
      const request = await options.resolver.resolve(claimed, context);
      const result = await options.runtime.execute(request);

      if (result.status === "succeeded" || result.status === "abstained" || result.status === "blocked") {
        succeeded += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      try {
        await options.repository.recordResult(context, {
          id: options.id(),
          operationId: claimed.id,
          status: "failed",
          errorClassification: error instanceof Error ? error.name : "unknown",
          warnings: [
            error instanceof Error
              ? error.message
              : "AI Runtime worker execution failed",
          ],
          now: options.now(),
        });
      } catch {
        // Preserve the original failure. The lease still expires and can be reclaimed.
      }
    } finally {
      await options.repository.releaseOperationLease(
        context,
        claimed.id,
        options.workerId,
        options.now(),
      );
    }
  }

  return {
    seen: runnable.length,
    claimed: claimedCount,
    succeeded,
    failed,
    skipped,
  };
}

function createWorkerContext(operation: AiOperationRecord): RequestContext {
  return {
    requestId: operation.requestId as EntityId,
    correlationId: operation.correlationId as EntityId,
    ...(operation.actorId ? { actorId: operation.actorId } : {}),
    tenantId: operation.organizationId,
    ...(operation.workspaceId ? { workspaceId: operation.workspaceId } : {}),
    module: "ai",
    operation: "ai.worker.execute",
    locale: "en",
    timezone: "UTC",
    authenticated: true,
  };
}
