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
  readonly timeoutMs?: number | undefined;
  readonly budgetUnits?: number | undefined;
}

export interface AIRuntimeUsage {
  readonly inputTokens?: number | undefined;
  readonly outputTokens?: number | undefined;
  readonly imageUnits?: number | undefined;
  readonly audioSeconds?: number | undefined;
  readonly embeddingUnits?: number | undefined;
  readonly providerUnits?: number | undefined;
}

export interface AIRuntimeResult<TOutput = unknown> {
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly status: AIOperationStatus;
  readonly output?: TOutput | undefined;
  readonly providerId?: string | undefined;
  readonly modelId?: string | undefined;
  readonly usage?: AIRuntimeUsage | undefined;
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
  readonly timeoutMs?: number | undefined;
}

export interface AIProviderResponse {
  readonly providerId: string;
  readonly modelId: string;
  readonly output: unknown;
  readonly usage?: AIRuntimeUsage | undefined;
}

export interface AIProviderAdapter {
  execute(request: AIProviderRequest): Promise<AIProviderResponse>;
}

export interface AIEntitlementDecision {
  readonly allowed: boolean;
  readonly reason?: string | undefined;
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
      if (!request.operationId.trim()) throw new Error("AI operationId is required");
      if (!request.operationType.trim()) throw new Error("AI operationType is required");
      if (request.operationVersion < 1) throw new Error("AI operationVersion must be positive");
      if (!request.idempotencyKey.trim()) throw new Error("AI idempotencyKey is required");
      if (!request.promptVersion.trim() || !request.outputSchemaVersion.trim() || !request.policyVersion.trim()) {
        throw new Error("AI prompt, schema and policy versions are required");
      }

      await policy.authorize(request.context, request.operationType);
      const entitlement = await policy.checkEntitlement(request.context, request.operationType);
      if (!entitlement.allowed) return blockedResult(request, entitlement.reason ?? "AI entitlement denied");

      const providerRequest: AIProviderRequest = {
        operationType: request.operationType,
        promptVersion: request.promptVersion,
        input: request.input,
        outputSchemaVersion: request.outputSchemaVersion,
        ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      };
      const response = await provider.execute(providerRequest);

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
          ...(response.usage !== undefined ? { usage: response.usage } : {}),
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
        ...(response.usage !== undefined ? { usage: response.usage } : {}),
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
