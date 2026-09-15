import type { RequestContext } from "@qooqnos/core";

export type AIDataClassification = "public" | "internal" | "confidential" | "personal" | "sensitive" | "regulated";
export type AIOperationStatus = "succeeded" | "failed" | "blocked" | "abstained";

export interface AIRuntimeRequest<TInput = unknown> {
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly context: RequestContext;
  readonly idempotencyKey: string;
  readonly input: TInput;
  readonly dataClassification: AIDataClassification;
  readonly promptVersion: string;
  readonly outputSchemaVersion: string;
  readonly policyVersion: string;
  readonly timeoutMs?: number;
  readonly budgetUnits?: number;
}

export interface AIRuntimeUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly imageUnits?: number;
  readonly audioSeconds?: number;
  readonly embeddingUnits?: number;
  readonly providerUnits?: number;
}

export interface AIRuntimeResult<TOutput = unknown> {
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly status: AIOperationStatus;
  readonly output?: TOutput;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly usage?: AIRuntimeUsage;
  readonly safetyDecision: "allowed" | "blocked" | "abstained";
  readonly provenance: "ai_generated" | "ai_extracted" | "system_derived" | "none";
  readonly warnings: readonly string[];
  readonly retryable: boolean;
}

export interface AIProviderRequest {
  readonly operationType: string;
  readonly promptVersion: string;
  readonly input: unknown;
  readonly outputSchemaVersion: string;
  readonly timeoutMs?: number;
}

export interface AIProviderResponse {
  readonly providerId: string;
  readonly modelId: string;
  readonly output: unknown;
  readonly usage?: AIRuntimeUsage;
}

export interface AIProviderAdapter {
  execute(request: AIProviderRequest): Promise<AIProviderResponse>;
}

export interface AIEntitlementDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface AIRuntimePolicy {
  authorize(context: RequestContext, operationType: string): Promise<void>;
  checkEntitlement(context: RequestContext, operationType: string): Promise<AIEntitlementDecision>;
  validateOutput(output: unknown, schemaVersion: string): Promise<void> | void;
  validateSafety(output: unknown, operationType: string): Promise<"allowed" | "blocked" | "abstained"> | "allowed" | "blocked" | "abstained";
}

export interface AIRuntime {
  execute<TOutput = unknown, TInput = unknown>(request: AIRuntimeRequest<TInput>): Promise<AIRuntimeResult<TOutput>>;
}

/** Shared internal AI execution boundary. It does not own domain persistence, billing state, or provider SDKs. */
export function createAIRuntime(provider: AIProviderAdapter, policy: AIRuntimePolicy): AIRuntime {
  return {
    async execute<TOutput, TInput>(request: AIRuntimeRequest<TInput>): Promise<AIRuntimeResult<TOutput>> {
      await policy.authorize(request.context, request.operationType);
      const entitlement = await policy.checkEntitlement(request.context, request.operationType);
      if (!entitlement.allowed) return blockedResult(request, entitlement.reason ?? "AI entitlement denied");

      const response = await provider.execute({
        operationType: request.operationType,
        promptVersion: request.promptVersion,
        input: request.input,
        outputSchemaVersion: request.outputSchemaVersion,
        timeoutMs: request.timeoutMs,
      });

      await policy.validateOutput(response.output, request.outputSchemaVersion);
      const safety = await policy.validateSafety(response.output, request.operationType);
      if (safety !== "allowed") {
        return {
          operationId: request.operationId,
          operationType: request.operationType,
          operationVersion: request.operationVersion,
          status: safety,
          providerId: response.providerId,
          modelId: response.modelId,
          usage: response.usage,
          safetyDecision: safety,
          provenance: "none",
          warnings: [safety === "blocked" ? "AI output was blocked by safety policy" : "AI output requires abstention"],
          retryable: false,
        };
      }

      return {
        operationId: request.operationId,
        operationType: request.operationType,
        operationVersion: request.operationVersion,
        status: "succeeded",
        output: response.output as TOutput,
        providerId: response.providerId,
        modelId: response.modelId,
        usage: response.usage,
        safetyDecision: "allowed",
        provenance: "ai_generated",
        warnings: [],
        retryable: false,
      };
    },
  };
}

function blockedResult<TInput>(request: AIRuntimeRequest<TInput>, reason: string): AIRuntimeResult<never> {
  return {
    operationId: request.operationId,
    operationType: request.operationType,
    operationVersion: request.operationVersion,
    status: "blocked",
    safetyDecision: "blocked",
    provenance: "none",
    warnings: [reason],
    retryable: false,
  };
}
