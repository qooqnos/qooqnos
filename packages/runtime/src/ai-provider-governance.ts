import type { RequestContext } from "@qooqnos/core";
import type { AIRuntimeRequest, AIDataClassification } from "./ai-runtime";

export type AIProviderLifecycle = "proposed" | "evaluated" | "approved" | "active" | "restricted" | "deprecated" | "retired";
export type AIHealthState = "healthy" | "degraded" | "rate_limited" | "unavailable" | "maintenance" | "unknown";

export interface AIProviderProfile {
  readonly providerId: string;
  readonly adapterVersion: string;
  readonly lifecycle: AIProviderLifecycle;
  readonly health: AIHealthState;
  readonly supportedOperationTypes: readonly string[];
  readonly supportedClassifications: readonly AIDataClassification[];
  readonly regions: readonly string[];
  readonly approved: boolean;
  readonly fallbackGroup?: string | undefined;
  readonly version: string;
}

export interface AIModelProfile {
  readonly modelId: string;
  readonly providerId: string;
  readonly providerModelId: string;
  readonly version: string;
  readonly lifecycle: AIProviderLifecycle;
  readonly approved: boolean;
  readonly supportedOperationTypes: readonly string[];
  readonly supportedClassifications: readonly AIDataClassification[];
  readonly structuredOutput: boolean;
  readonly toolCalling: boolean;
  readonly regions: readonly string[];
  readonly routingPriority: number;
  readonly fallbackGroup?: string | undefined;
}

export interface AIRoutingPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly operationTypes: readonly string[];
  readonly requiredRegions?: readonly string[] | undefined;
  readonly minimumHealth: readonly AIHealthState[];
  readonly allowFallback: boolean;
}

export interface AIRoutingRequirements {
  readonly operationType: string;
  readonly dataClassification: AIDataClassification;
  readonly region?: string | undefined;
  readonly requiresStructuredOutput?: boolean | undefined;
  readonly requiresToolCalling?: boolean | undefined;
}

export interface AIEligibilityResult {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

export interface AIRoutingDecision {
  readonly routingDecisionId: string;
  readonly operationId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly selectedProviderId: string;
  readonly selectedModelId: string;
  readonly providerVersion: string;
  readonly modelVersion: string;
  readonly fallbackGroup?: string | undefined;
  readonly recordedAt: string;
}

export interface AIProviderGovernanceRegistry {
  registerProvider(provider: AIProviderProfile): void;
  registerModel(model: AIModelProfile): void;
  getProvider(providerId: string): AIProviderProfile | undefined;
  getModel(modelId: string): AIModelProfile | undefined;
  select(request: AIRuntimeRequest, requirements: AIRoutingRequirements, policy: AIRoutingPolicy): AIRoutingDecision;
}

export class AIModelGovernanceError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[]) {
    super(message);
    this.name = "AIModelGovernanceError";
    this.reasons = reasons;
  }
}

export function createAIProviderGovernanceRegistry(options?: {
  readonly now?: () => string;
  readonly id?: () => string;
}): AIProviderGovernanceRegistry {
  const providers = new Map<string, AIProviderProfile>();
  const models = new Map<string, AIModelProfile>();
  const now = options?.now ?? (() => new Date().toISOString());
  const id = options?.id ?? (() => crypto.randomUUID());

  return {
    registerProvider(provider) {
      validateProvider(provider);
      if (providers.has(provider.providerId)) throw new Error(`AI provider ${provider.providerId} is already registered`);
      providers.set(provider.providerId, provider);
    },
    registerModel(model) {
      validateModel(model);
      if (models.has(model.modelId)) throw new Error(`AI model ${model.modelId} is already registered`);
      if (!providers.has(model.providerId)) throw new Error(`AI provider ${model.providerId} must be registered before model ${model.modelId}`);
      models.set(model.modelId, model);
    },
    getProvider(providerId) {
      return providers.get(providerId);
    },
    getModel(modelId) {
      return models.get(modelId);
    },
    select(request, requirements, policy) {
      const candidates = [...models.values()]
        .map((model) => ({ model, provider: providers.get(model.providerId) }))
        .filter((entry): entry is { model: AIModelProfile; provider: AIProviderProfile } => entry.provider !== undefined)
        .filter((entry) => request.providerId === undefined || entry.provider.providerId === request.providerId)
        .filter((entry) => request.modelId === undefined || entry.model.modelId === request.modelId)
        .filter(() => policy.operationTypes.length === 0 || policy.operationTypes.includes(requirements.operationType))
        .map((entry) => ({ ...entry, eligibility: evaluateEligibility(entry.provider, entry.model, requirements, policy) }))
        .filter((entry) => entry.eligibility.eligible)
        .sort((left, right) => right.model.routingPriority - left.model.routingPriority);

      const selected = candidates[0];
      if (!selected) {
        throw new AIModelGovernanceError("No eligible AI provider/model remains", collectIneligibleReasons([...models.values()], providers, requirements, policy, request));
      }

      return {
        routingDecisionId: id(),
        operationId: request.operationId,
        policyId: policy.policyId,
        policyVersion: policy.version,
        selectedProviderId: selected.provider.providerId,
        selectedModelId: selected.model.modelId,
        providerVersion: selected.provider.version,
        modelVersion: selected.model.version,
        ...(selected.model.fallbackGroup !== undefined ? { fallbackGroup: selected.model.fallbackGroup } : {}),
        recordedAt: now(),
      };
    },
  };
}

export function evaluateEligibility(
  provider: AIProviderProfile,
  model: AIModelProfile,
  requirements: AIRoutingRequirements,
  policy: AIRoutingPolicy,
): AIEligibilityResult {
  const reasons: string[] = [];
  if (!provider.approved || provider.lifecycle !== "active") reasons.push("provider_not_active_and_approved");
  if (!model.approved || model.lifecycle !== "active") reasons.push("model_not_active_and_approved");
  if (!provider.supportedOperationTypes.includes(requirements.operationType)) reasons.push("provider_operation_not_supported");
  if (!model.supportedOperationTypes.includes(requirements.operationType)) reasons.push("model_operation_not_supported");
  if (!provider.supportedClassifications.includes(requirements.dataClassification)) reasons.push("provider_classification_not_supported");
  if (!model.supportedClassifications.includes(requirements.dataClassification)) reasons.push("model_classification_not_supported");
  if (policy.minimumHealth.length > 0 && !policy.minimumHealth.includes(provider.health)) reasons.push("provider_health_ineligible");
  if (requirements.requiresStructuredOutput === true && !model.structuredOutput) reasons.push("structured_output_required");
  if (requirements.requiresToolCalling === true && !model.toolCalling) reasons.push("tool_calling_required");
  if (policy.requiredRegions && requirements.region && !policy.requiredRegions.includes(requirements.region)) reasons.push("requested_region_not_allowed_by_policy");
  if (requirements.region && !provider.regions.includes(requirements.region)) reasons.push("provider_region_not_supported");
  if (requirements.region && !model.regions.includes(requirements.region)) reasons.push("model_region_not_supported");
  return { eligible: reasons.length === 0, reasons };
}

function collectIneligibleReasons(
  models: readonly AIModelProfile[],
  providers: ReadonlyMap<string, AIProviderProfile>,
  requirements: AIRoutingRequirements,
  policy: AIRoutingPolicy,
  request: AIRuntimeRequest,
): string[] {
  const reasons = new Set<string>();
  for (const model of models) {
    if (request.modelId !== undefined && model.modelId !== request.modelId) continue;
    if (request.providerId !== undefined && model.providerId !== request.providerId) continue;
    const provider = providers.get(model.providerId);
    if (!provider) {
      reasons.add("provider_not_registered");
      continue;
    }
    for (const reason of evaluateEligibility(provider, model, requirements, policy).reasons) reasons.add(reason);
  }
  if (reasons.size === 0) {
    if (request.providerId !== undefined) reasons.add("requested_provider_not_registered_or_eligible");
    if (request.modelId !== undefined) reasons.add("requested_model_not_registered_or_eligible");
  }
  return [...reasons];
}

function validateProvider(provider: AIProviderProfile): void {
  if (!provider.providerId.trim()) throw new Error("AI providerId is required");
  if (!provider.adapterVersion.trim() || !provider.version.trim()) throw new Error("AI provider versions are required");
}

function validateModel(model: AIModelProfile): void {
  if (!model.modelId.trim() || !model.providerModelId.trim()) throw new Error("AI model identifiers are required");
  if (!model.version.trim()) throw new Error("AI model version is required");
}
