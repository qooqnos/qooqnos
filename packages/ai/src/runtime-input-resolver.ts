import type { RequestContext } from "@qooqnos/core";
import type { AIRuntimeRequest } from "@qooqnos/runtime";
import type { AiOperationRecord } from "./runtime-repository";
import { SELLER_AI_OPERATION_TYPES, type SellerProductInputRecord, type SellerProductSessionRepository } from "./seller-product-service";

export interface SellerProductAIRuntimeInputResolverOptions {
  readonly repository: SellerProductSessionRepository;
  readonly promptVersion?: string;
  readonly outputSchemaVersion?: string;
  readonly policyVersion?: string;
  readonly dataClassification?: AIRuntimeRequest["dataClassification"];
}

export function createSellerProductAIRuntimeInputResolver(
  options: SellerProductAIRuntimeInputResolverOptions,
): {
  readonly resolve: (
    operation: AiOperationRecord,
    context: RequestContext,
  ) => Promise<AIRuntimeRequest>;
} {
  const promptVersion = options.promptVersion ?? "seller-product-v1";
  const outputSchemaVersion = options.outputSchemaVersion ?? "seller-product-draft-v1";
  const policyVersion = options.policyVersion ?? "seller-product-policy-v1";
  const dataClassification = options.dataClassification ?? "internal";

  return {
    async resolve(operation, context): Promise<AIRuntimeRequest> {
      if (operation.operationType !== SELLER_AI_OPERATION_TYPES.extract) {
        throw new Error(`No durable AI input resolver is registered for operation type: ${operation.operationType}`);
      }
      if (!operation.sessionId) {
        throw new Error("Seller AI operation is missing its session id");
      }

      const session = await options.repository.getSession(context, operation.sessionId);
      if (!session) {
        throw new Error("Seller AI session for durable AI operation was not found");
      }

      const inputs = await options.repository.getInputs(context, operation.sessionId);
      if (inputs.length === 0) {
        throw new Error("Seller AI session has no persisted inputs");
      }

      return {
        operationId: operation.id,
        operationType: operation.operationType,
        operationVersion: operation.operationVersion,
        context,
        ...(session.businessId ? { businessId: session.businessId } : {}),
        idempotencyKey: operation.idempotencyKey,
        input: {
          sessionId: operation.sessionId,
          inputs,
        },
        dataClassification,
        promptVersion,
        outputSchemaVersion,
        policyVersion,
        sessionId: operation.sessionId,
        ...(operation.inputReference ? { inputReference: operation.inputReference } : {}),
      };
    },
  };
}

