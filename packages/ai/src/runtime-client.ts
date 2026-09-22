import type { AIRequest, AIResult } from "./types";

export interface AIRuntimeClient {
  execute<TOutput>(request: AIRequest): Promise<AIResult<TOutput>>;
}

/** Adapter contract: feature capabilities depend on the canonical AI Runtime, never on provider SDKs. */
export function createAIRuntimeClient(execute: AIRuntimeClient["execute"]): AIRuntimeClient {
  return { execute };
}

import { brandId, type EntityId } from "@qooqnos/core";
import type { AiRuntimeRepository } from "./runtime-repository";

export function createPersistentAIRuntimeClient(
  runtime: AIRuntimeClient,
  repository: AiRuntimeRepository,
  options: {
    readonly id: () => EntityId;
    readonly now: () => string;
  },
): AIRuntimeClient {
  return {
    async execute<TOutput>(request: AIRequest): Promise<AIResult<TOutput>> {
      const now = options.now();
      const operationTypeId = await repository.ensureOperationType(
        request.context,
        {
          operationType: request.operationType,
          version: request.operationVersion,
          now,
        },
        options.id(),
      );

      const operation = await repository.createOperation(request.context, {
        id: brandId<"EntityId">(request.operationId),
        operationTypeId,
        operationType: request.operationType,
        operationVersion: request.operationVersion,
        requestId: request.context.requestId,
        correlationId: request.context.correlationId,
        idempotencyKey: request.idempotencyKey,
        ...(request.inputReference !== undefined ? { inputReference: request.inputReference } : {}),
        ...(request.inputHash !== undefined ? { inputHash: request.inputHash } : {}),
        now,
      });

      if (operation.status === "succeeded" || operation.status === "blocked" || operation.status === "abstained") {
        return runtime.execute<TOutput>(request);
      }

      await repository.setOperationStatus(request.context, operation.id, "started", now);

      try {
        const result = await runtime.execute<TOutput>(request);
        await repository.recordResult(request.context, {
          id: options.id(),
          operationId: operation.id,
          status: result.status,
          schemaVersionReference: request.outputSchemaVersion,
          safetyOutcome: result.safetyDecision,
          provenance: [result.provenance],
          warnings: result.warnings,
          now: options.now(),
        });
        if (result.usage) {
          const providerUnits =
            result.usage.providerUnits
            ?? result.usage.inputTokens
            ?? result.usage.outputTokens
            ?? result.usage.embeddingUnits
            ?? result.usage.imageUnits
            ?? result.usage.audioSeconds
            ?? 0;
          await repository.recordUsage(request.context, {
            id: options.id(),
            operationId: operation.id,
            operationType: request.operationType,
            operationVersion: request.operationVersion,
            meterUnit: "provider_unit",
            quantity: Math.max(0, Math.trunc(providerUnits)),
            idempotencyKey: request.idempotencyKey,
            now: options.now(),
          });
        }
        return result;
      } catch (error) {
        await repository.recordResult(request.context, {
          id: options.id(),
          operationId: operation.id,
          status: "failed",
          errorClassification: error instanceof Error ? error.name : "unknown",
          warnings: [error instanceof Error ? error.message : "AI Runtime execution failed"],
          now: options.now(),
        }).catch(() => undefined);
        throw error;
      }
    },
  };
}
