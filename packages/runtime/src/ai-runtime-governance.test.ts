import { describe, expect, it, vi } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { createAIRuntimeWithGovernance, type AIRuntimeRequest } from "./ai-runtime";
import { createAIProviderGovernanceRegistry, type AIModelProfile, type AIProviderProfile, type AIRoutingPolicy } from "./ai-provider-governance";
import { createAIProviderRegistry } from "./ai-provider-registry";

const providerProfile: AIProviderProfile = {
  providerId: "cloudflare",
  adapterVersion: "1",
  lifecycle: "active",
  health: "healthy",
  supportedOperationTypes: ["seller.product.extract"],
  supportedClassifications: ["internal"],
  regions: ["US"],
  approved: true,
  version: "2026-01",
};

const modelProfile: AIModelProfile = {
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
};

const routingPolicy: AIRoutingPolicy = {
  policyId: "seller-extract",
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

describe("AI runtime governance boundary", () => {
  it("routes only through a governance-approved provider and model", async () => {
    const execute = vi.fn(async (input: { modelId: string }) => ({
      providerId: "cloudflare",
      modelId: input.modelId,
      output: { title: "Validated" },
    }));
    const providers = createAIProviderRegistry([
      {
        providerId: "cloudflare",
        models: ["seller-extract-primary", "unapproved-model"],
        adapter: {
          async execute(providerRequest) {
            if (providerRequest.modelId === undefined) throw new Error("Provider modelId is required");
            return execute({ modelId: providerRequest.modelId });
          },
        },
      },
    ]);
    const governance = createAIProviderGovernanceRegistry({ id: () => "routing-1" });
    governance.registerProvider(providerProfile);
    governance.registerModel(modelProfile);
    const runtime = createAIRuntimeWithGovernance(
      providers,
      governance,
      {
        async authorize() {},
        async checkEntitlement() { return { allowed: true, decision: "included" as const }; },
        validateOutput() {},
        async validateSafety() { return "allowed" as const; },
      },
      routingPolicy,
    );

    const result = await runtime.execute(request());

    expect(result.status).toBe("succeeded");
    expect(result.providerId).toBe("cloudflare");
    expect(result.modelId).toBe("seller-extract-primary");
    expect(execute).toHaveBeenCalledWith({ modelId: "seller-extract-primary" });
  });

  it("rejects an explicitly requested model that governance does not approve", async () => {
    const execute = vi.fn(async () => ({ providerId: "cloudflare", modelId: "unapproved-model", output: {} }));
    const providers = createAIProviderRegistry([
      { providerId: "cloudflare", models: ["seller-extract-primary", "unapproved-model"], adapter: { execute } },
    ]);
    const governance = createAIProviderGovernanceRegistry();
    governance.registerProvider(providerProfile);
    governance.registerModel(modelProfile);
    const runtime = createAIRuntimeWithGovernance(
      providers,
      governance,
      {
        async authorize() {},
        async checkEntitlement() { return { allowed: true, decision: "included" as const }; },
        validateOutput() {},
        async validateSafety() { return "allowed" as const; },
      },
      routingPolicy,
    );

    await expect(runtime.execute({ ...request(), modelId: "unapproved-model" })).rejects.toThrow("No eligible AI provider/model remains");
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed when a provider returns an identity different from the governance decision", async () => {
    const execute = vi.fn(async () => ({
      providerId: "cloudflare",
      modelId: "different-model",
      output: { title: "Untrusted" },
    }));
    const providers = createAIProviderRegistry([
      {
        providerId: "cloudflare",
        models: ["seller-extract-primary"],
        adapter: { execute },
      },
    ]);
    const governance = createAIProviderGovernanceRegistry();
    governance.registerProvider(providerProfile);
    governance.registerModel(modelProfile);
    const runtime = createAIRuntimeWithGovernance(
      providers,
      governance,
      {
        async authorize() {},
        async checkEntitlement() { return { allowed: true, decision: "included" as const }; },
        validateOutput() {},
        async validateSafety() { return "allowed" as const; },
      },
      routingPolicy,
    );

    await expect(runtime.execute(request())).rejects.toThrow("AI provider response identity mismatch");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
