import { describe, expect, it, vi } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { createAIRuntime, type AIRuntimeRequest, type AIProviderAdapter } from "./ai-runtime";
import type { AIEconomicsSink } from "./ai-economics";

function context(): RequestContext {
  return {
    requestId: brandId<"RequestId">("req-1"),
    correlationId: brandId<"CorrelationId">("corr-1"),
    actorId: brandId<"EntityId">("user-1"),
    tenantId: brandId<"EntityId">("tenant-1"),
    workspaceId: brandId<"EntityId">("workspace-1"),
    module: "ai",
    operation: "seller.product.extract",
    locale: "en",
    timezone: "UTC",
  };
}

function request(): AIRuntimeRequest<{ title: string }> {
  return {
    operationId: "op-1",
    operationType: "seller.product.extract",
    operationVersion: 1,
    context: context(),
    idempotencyKey: "idem-1",
    input: { title: "Example" },
    dataClassification: "internal",
    promptVersion: "seller-product-v1",
    outputSchemaVersion: "seller-product-draft-v1",
    policyVersion: "seller-product-policy-v1",
    sessionId: "session-1",
    inputReference: "media-1",
    inputHash: "sha256:abc",
    attemptNumber: 2,
  };
}

function provider(execute: AIProviderAdapter["execute"]): AIProviderAdapter {
  return { execute };
}

function economics(): AIEconomicsSink & {
  operationCreated: ReturnType<typeof vi.fn>;
  operationStatusChanged: ReturnType<typeof vi.fn>;
  entitlementDecisionRecorded: ReturnType<typeof vi.fn>;
  usageMeasured: ReturnType<typeof vi.fn>;
  providerCostRecorded: ReturnType<typeof vi.fn>;
} {
  return {
    operationCreated: vi.fn(),
    operationStatusChanged: vi.fn(),
    entitlementDecisionRecorded: vi.fn(),
    usageMeasured: vi.fn(),
    providerCostRecorded: vi.fn(),
  };
}

describe("createAIRuntime", () => {
  it("requires authorization before the provider is invoked", async () => {
    const execute = vi.fn(async () => ({ providerId: "test", modelId: "model", output: {} }));
    const authorize = vi.fn(async () => { throw new Error("AI permission denied"); });
    const economicSink = economics();

    const runtime = createAIRuntime(provider(execute), {
      authorize,
      async checkEntitlement() { return { allowed: true }; },
      validateOutput() {},
      async validateSafety() { return "allowed" as const; },
    }, economicSink);

    await expect(runtime.execute(request())).rejects.toThrow("AI permission denied");
    expect(authorize).toHaveBeenCalledWith(context(), "seller.product.extract");
    expect(execute).not.toHaveBeenCalled();
    expect(economicSink.operationCreated).not.toHaveBeenCalled();
  });

  it("creates the operation identity before the entitlement decision", async () => {
    const execute = vi.fn(async () => ({ providerId: "test", modelId: "model", output: {} }));
    const economicSink = economics();
    const runtime = createAIRuntime(provider(execute), {
      async authorize() {},
      async checkEntitlement() { return { allowed: false, decision: "denied", reason: "quota exhausted" }; },
      validateOutput() {},
      async validateSafety() { return "allowed" as const; },
    }, economicSink);

    const result = await runtime.execute(request());

    expect(result.status).toBe("blocked");
    expect(economicSink.operationCreated).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "op-1",
      sessionId: "session-1",
      inputReference: "media-1",
      inputHash: "sha256:abc",
      attemptNumber: 2,
    }));
    expect(economicSink.entitlementDecisionRecorded).toHaveBeenCalledWith("op-1", expect.objectContaining({
      allowed: false,
      decision: "denied",
    }));
    expect(economicSink.operationStatusChanged).toHaveBeenLastCalledWith("op-1", "blocked_by_entitlement");
    expect(execute).not.toHaveBeenCalled();
  });

  it("blocks before provider execution when entitlement is denied", async () => {
    const execute = vi.fn(async () => ({ providerId: "test", modelId: "model", output: {} }));
    const economicSink = economics();

    const runtime = createAIRuntime(provider(execute), {
      async authorize() {},
      async checkEntitlement() { return { allowed: false, decision: "temporary_unavailable", reason: "billing unavailable" }; },
      validateOutput() {},
      async validateSafety() { return "allowed" as const; },
    }, economicSink);

    const result = await runtime.execute(request());

    expect(result.status).toBe("blocked");
    expect(result.retryable).toBe(true);
    expect(result.warnings).toEqual(["billing unavailable"]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("records measured usage and provider cost independently from customer pricing", async () => {
    const economicSink = economics();
    const execute = vi.fn(async () => ({
      providerId: "test-provider",
      modelId: "test-model",
      output: { title: "Validated" },
      usage: { inputTokens: 10, outputTokens: 5, imageUnits: 2, providerUnits: 17 },
      cost: {
        inputUnits: 10,
        outputUnits: 5,
        estimatedProviderCost: 0.0042,
        costCurrency: "USD",
        costEstimationVersion: "test-v1",
        latencyMs: 42,
      },
    }));
    const runtime = createAIRuntime(provider(execute), {
      async authorize() {},
      async checkEntitlement() {
        return {
          allowed: true,
          decision: "included",
          entitlementDecisionId: "ent-1",
          entitlementKey: "seller-ai.extract",
          meterKey: "ai.operation",
        };
      },
      validateOutput() {},
      async validateSafety() { return "allowed" as const; },
    }, economicSink);

    const result = await runtime.execute<{ title: string }>(request());

    expect(result.status).toBe("succeeded");
    expect(economicSink.operationStatusChanged).toHaveBeenCalledWith("op-1", "entitlement_checked");
    expect(economicSink.operationStatusChanged).toHaveBeenCalledWith("op-1", "running");
    expect(economicSink.operationStatusChanged).toHaveBeenCalledWith("op-1", "succeeded");
    expect(economicSink.usageMeasured).toHaveBeenCalledTimes(4);
    expect(economicSink.usageMeasured).toHaveBeenCalledWith(expect.objectContaining({
      meterKey: "ai.input_tokens",
      quantity: 10,
      unit: "tokens",
      entitlementDecisionId: "ent-1",
    }));
    expect(economicSink.usageMeasured).toHaveBeenCalledWith(expect.objectContaining({
      meterKey: "ai.output_tokens",
      quantity: 5,
    }));
    expect(economicSink.providerCostRecorded).toHaveBeenCalledWith(expect.objectContaining({
      operationId: "op-1",
      providerId: "test-provider",
      modelId: "test-model",
      estimatedProviderCost: 0.0042,
      costCurrency: "USD",
    }));
  });

  it("does not expose output when safety requires abstention", async () => {
    const economicSink = economics();
    const runtime = createAIRuntime(
      provider(async () => ({ providerId: "test-provider", modelId: "test-model", output: { title: "Unsafe" } })),
      {
        async authorize() {},
        async checkEntitlement() { return { allowed: true, decision: "included" as const }; },
        validateOutput() {},
        async validateSafety() { return "abstained" as const; },
      },
      economicSink,
    );

    const result = await runtime.execute(request());

    expect(result.status).toBe("abstained");
    expect(result.output).toBeUndefined();
    expect(result.provenance).toBe("none");
    expect(result.safetyDecision).toBe("abstained");
    expect(economicSink.operationStatusChanged).toHaveBeenLastCalledWith("op-1", "abstained");
  });

  it("marks provider failures as failed in the economic lifecycle", async () => {
    const economicSink = economics();
    const runtime = createAIRuntime(
      provider(async () => { throw new Error("provider unavailable"); }),
      {
        async authorize() {},
        async checkEntitlement() { return { allowed: true, decision: "included" as const }; },
        validateOutput() {},
        async validateSafety() { return "allowed" as const; },
      },
      economicSink,
    );

    await expect(runtime.execute(request())).rejects.toThrow("provider unavailable");
    expect(economicSink.operationStatusChanged).toHaveBeenLastCalledWith("op-1", "failed");
  });
});
