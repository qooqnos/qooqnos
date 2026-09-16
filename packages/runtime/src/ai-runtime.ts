import type { RequestContext } from "@qooqnos/core";
import {
  createOperationIdentity,
  usageMeasurements,
  type AIEconomicsSink,
  type AIEntitlementDecision,
  type AIOperationLifecycleStatus,
  type AIProviderCostTelemetry,
} from "./ai-economics";
import type { AIProviderRegistry } from "./ai-provider-registry";
import type {
  AIProviderGovernanceRegistry,
  AIRoutingPolicy,
  AIRoutingRequirements,
} from "./ai-provider-governance";

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
  readonly sessionId?: string | undefined;
  readonly inputReference?: string | undefined;
  readonly inputHash?: string | undefined;
  readonly attemptNumber?: number | undefined;
  readonly providerId?: string | undefined;
  readonly modelId?: string | undefined;
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
  readonly providerId?: string | undefined;
  readonly modelId?: string | undefined;
  readonly timeoutMs?: number | undefined;
}

export interface AIProviderCost {
  readonly inputUnits?: number | undefined;
  readonly outputUnits?: number | undefined;
  readonly estimatedProviderCost?: number | undefined;
  readonly costCurrency?: string | undefined;
  readonly costEstimationVersion?: string | undefined;
  readonly latencyMs?: number | undefined;
}

export interface AIProviderResponse {
  readonly providerId: string;
  readonly modelId: string;
  readonly output: unknown;
  readonly usage?: AIRuntimeUsage | undefined;
  readonly cost?: AIProviderCost | undefined;
}

export interface AIProviderAdapter {
  execute(request: AIProviderRequest): Promise<AIProviderResponse>;
}

export type { AIEntitlementDecision };

export interface AIRuntimePolicy {
  authorize(context: RequestContext, operationType: string): Promise<void>;
  checkEntitlement(context: RequestContext, operationType: string): Promise<AIEntitlementDecision>;
  validateOutput(output: unknown, schemaVersion: string): Promise<void> | void;
  validateSafety(output: unknown, operationType: string): Promise<"allowed" | "blocked" | "abstained"> | "allowed" | "blocked" | "abstained";
}

export interface AIRuntime {
  execute<TOutput = unknown, TInput = unknown>(request: AIRuntimeRequest<TInput>): Promise<AIRuntimeResult<TOutput>>;
}

export function createAIRuntime(
  provider: AIProviderAdapter,
  policy: AIRuntimePolicy,
  economics?: AIEconomicsSink,
): AIRuntime {
  return buildRuntime((request) => provider.execute(request), policy, economics);
}

export function createAIRuntimeWithRegistry(
  registry: AIProviderRegistry,
  policy: AIRuntimePolicy,
  economics?: AIEconomicsSink,
): AIRuntime {
  return buildRuntime((request) => registry.execute(request, {
    ...(request.providerId !== undefined ? { providerId: request.providerId } : {}),
    ...(request.modelId !== undefined ? { modelId: request.modelId } : {}),
  }), policy, economics);
}

export function createAIRuntimeWithGovernance(
  providers: AIProviderRegistry,
  governance: AIProviderGovernanceRegistry,
  policy: AIRuntimePolicy,
  routingPolicy: AIRoutingPolicy,
  requirements?: (request: AIRuntimeRequest) => AIRoutingRequirements,
  economics?: AIEconomicsSink,
): AIRuntime {
  return buildRuntime((request) => {
    const routingRequirements = requirements?.(request) ?? defaultRoutingRequirements(request);
    const decision = governance.select(request, routingRequirements, routingPolicy);
    const routingRecordedAt = new Date().toISOString();
    void economics?.routingDecisionRecorded?.({
      routingDecisionId: decision.routingDecisionId,
      operationId: decision.operationId,
      policyId: decision.policyId,
      policyVersion: decision.policyVersion,
      providerId: decision.selectedProviderId,
      modelId: decision.selectedModelId,
      providerVersion: decision.providerVersion,
      modelVersion: decision.modelVersion,
      ...(decision.fallbackGroup !== undefined ? { fallbackGroup: decision.fallbackGroup } : {}),
      occurredAt: routingRecordedAt,
    });
    return providers.execute(request, {
      providerId: decision.selectedProviderId,
      modelId: decision.selectedModelId,
    });
  }, policy, economics);
}

function defaultRoutingRequirements(request: AIRuntimeRequest): AIRoutingRequirements {
  return {
    operationType: request.operationType,
    dataClassification: request.dataClassification,
  };
}

function buildRuntime(
  executeProvider: (request: AIProviderRequest) => Promise<AIProviderResponse>,
  policy: AIRuntimePolicy,
  economics: AIEconomicsSink | undefined,
): AIRuntime {
  return {
    async execute<TOutput, TInput>(request: AIRuntimeRequest<TInput>): Promise<AIRuntimeResult<TOutput>> {
      validateRequest(request);
      await policy.authorize(request.context, request.operationType);

      const identity = createOperationIdentity(request);
      await economics?.operationCreated(identity);

      const entitlement = await policy.checkEntitlement(request.context, request.operationType);
      await economics?.entitlementDecisionRecorded(request.operationId, entitlement);
      await economics?.operationStatusChanged(
        request.operationId,
        entitlement.allowed ? "entitlement_checked" : "blocked_by_entitlement",
      );

      if (!entitlement.allowed) {
        return blockedResult(
          request,
          entitlement.reason ?? "AI entitlement denied",
          entitlement.decision === "temporary_unavailable",
        );
      }

      await economics?.operationStatusChanged(request.operationId, "running");

      try {
        const startedAt = Date.now();
        const providerRequest: AIProviderRequest = {
          operationType: request.operationType,
          promptVersion: request.promptVersion,
          input: request.input,
          outputSchemaVersion: request.outputSchemaVersion,
          ...(request.providerId !== undefined ? { providerId: request.providerId } : {}),
          ...(request.modelId !== undefined ? { modelId: request.modelId } : {}),
          ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
        };
        const response = await executeProvider(providerRequest);

        await recordEconomics(
          economics,
          request,
          response,
          response.cost !== undefined
            ? {
                operationId: request.operationId,
                providerId: response.providerId,
                modelId: response.modelId,
                ...response.cost,
                ...(response.cost.latencyMs === undefined ? { latencyMs: Date.now() - startedAt } : {}),
                occurredAt: new Date().toISOString(),
              }
            : undefined,
          entitlement,
        );

        await policy.validateOutput(response.output, request.outputSchemaVersion);
        const safety = await policy.validateSafety(response.output, request.operationType);
        if (safety !== "allowed") {
          const lifecycleStatus: AIOperationLifecycleStatus = safety === "blocked" ? "blocked_by_safety" : "abstained";
          await economics?.operationStatusChanged(request.operationId, lifecycleStatus);
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

        await economics?.operationStatusChanged(request.operationId, "succeeded");
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
      } catch (error) {
        await economics?.operationStatusChanged(request.operationId, "failed");
        throw error;
      }
    },
  };
}

async function recordEconomics(
  economics: AIEconomicsSink | undefined,
  request: AIRuntimeRequest,
  response: AIProviderResponse,
  cost: AIProviderCostTelemetry | undefined,
  entitlement: AIEntitlementDecision,
): Promise<void> {
  if (economics === undefined) return;
  const occurredAt = new Date().toISOString();
  if (response.usage !== undefined) {
    const measurements = usageMeasurements(
      request.operationId,
      request.operationType,
      request.idempotencyKey,
      response.usage,
      entitlement.entitlementDecisionId,
      occurredAt,
    );
    for (const measurement of measurements) await economics.usageMeasured(measurement);
  }
  if (cost !== undefined) await economics.providerCostRecorded(cost);
}

function validateRequest(request: AIRuntimeRequest): void {
  if (!request.operationId.trim()) throw new Error("AI operationId is required");
  if (!request.operationType.trim()) throw new Error("AI operationType is required");
  if (request.operationVersion < 1) throw new Error("AI operationVersion must be positive");
  if (!request.idempotencyKey.trim()) throw new Error("AI idempotencyKey is required");
  if (request.attemptNumber !== undefined && request.attemptNumber < 1) throw new Error("AI attemptNumber must be positive");
  if (!request.promptVersion.trim() || !request.outputSchemaVersion.trim() || !request.policyVersion.trim()) {
    throw new Error("AI prompt, schema and policy versions are required");
  }
}

function blockedResult<TInput>(request: AIRuntimeRequest<TInput>, reason: string, retryable: boolean): AIRuntimeResult<never> {
  return {
    operationId: request.operationId,
    operationType: request.operationType,
    operationVersion: request.operationVersion,
    status: "blocked",
    safetyDecision: "blocked",
    provenance: "none",
    warnings: [reason],
    retryable,
  };
}
