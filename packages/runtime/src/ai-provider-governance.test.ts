import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { createAIProviderGovernanceRegistry, evaluateEligibility, type AIRoutingPolicy, type AIProviderProfile, type AIModelProfile } from "./ai-provider-governance";
import type { AIRuntimeRequest } from "./ai-runtime";

const provider: AIProviderProfile = {
  providerId: "cloudflare",
  adapterVersion: "1",
  lifecycle: "active",
  health: "healthy",
  supportedOperationTypes: ["seller.product.extract"],
  supportedClassifications: ["internal"],
  regions: ["US"],
  approved: true,
  fallbackGroup: "seller-extract",
  version: "2026-01",
};

const model: AIModelProfile = {
  modelId: "seller-extract-primary",
  providerId: "cloudflare",
  providerModelId: "@cf/example/model",
  version: "1",
  lifecycle: "active",
  approved: true,
  supportedOperationTypes: ["seller.product.extract"],
  supportedClassifications: ["internal"],
  structuredOutput: true,
  toolCalling: false,
  regions: ["US"],
  routingPriority: 100,
  fallbackGroup: "seller-extract",
};

const policy: AIRoutingPolicy = {
  policyId: "seller-extract-routing",
  version: "1",
  operationTypes: ["seller.product.extract"],
  minimumHealth: ["healthy"],
  allowFallback: true,
};

function request(): AIRuntimeRequest {
  const context: RequestContext = {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    module: "ai",
    operation: "seller.product.extract",
    locale: "en",
    timezone: "UTC",
  };
  return {
    operationId: "op-1",
    operationType: "seller.product.extract",
    operationVersion: 1,
    context,
    idempotencyKey: "idem-1",
    input: { title: "Example" },
    dataClassification: "internal",
    promptVersion: "v1",
    outputSchemaVersion: "v1",
    policyVersion: "v1",
  };
}

describe("AI provider/model governance", () => {
  it("registers approved providers and models and records an immutable selection reference", () => {
    const registry = createAIProviderGovernanceRegistry({ id: () => "routing-1", now: () => "2026-09-16T00:00:00.000Z" });
    registry.registerProvider(provider);
    registry.registerModel(model);

    const decision = registry.select(request(), {
      operationType: "seller.product.extract",
      dataClassification: "internal",
      region: "US",
      requiresStructuredOutput: true,
    }, policy);

    expect(decision).toEqual({
      routingDecisionId: "routing-1",
      operationId: "op-1",
      policyId: "seller-extract-routing",
      policyVersion: "1",
      selectedProviderId: "cloudflare",
      selectedModelId: "seller-extract-primary",
      providerVersion: "2026-01",
      modelVersion: "1",
      fallbackGroup: "seller-extract",
      recordedAt: "2026-09-16T00:00:00.000Z",
    });
  });

  it("eliminates models that do not satisfy hard capability or residency constraints", () => {
    const result = evaluateEligibility(provider, model, {
      operationType: "seller.product.extract",
      dataClassification: "internal",
      region: "EU",
      requiresStructuredOutput: true,
      requiresToolCalling: true,
    }, policy);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      "model_region_not_supported",
      "provider_region_not_supported",
      "tool_calling_required",
    ]));
  });

  it("fails closed when no candidate is eligible", () => {
    const registry = createAIProviderGovernanceRegistry();
    registry.registerProvider({ ...provider, approved: false });
    registry.registerModel(model);

    expect(() => registry.select(request(), {
      operationType: "seller.product.extract",
      dataClassification: "internal",
      region: "US",
      requiresStructuredOutput: true,
    }, policy)).toThrow("No eligible AI provider/model remains");
  });
});
