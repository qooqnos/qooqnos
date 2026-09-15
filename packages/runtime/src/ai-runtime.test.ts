import { describe, expect, it, vi } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import { createAIRuntime, type AIRuntimeRequest } from "./ai-runtime";

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
  };
}

describe("createAIRuntime", () => {
  it("requires authorization before the provider is invoked", async () => {
    const execute = vi.fn(async () => ({ providerId: "test", modelId: "model", output: {} }));
    const authorize = vi.fn(async () => { throw new Error("AI permission denied"); });

    const runtime = createAIRuntime(execute, {
      authorize,
      async checkEntitlement() { return { allowed: true }; },
      validateOutput() {},
      async validateSafety() { return "allowed"; },
    });

    await expect(runtime.execute(request())).rejects.toThrow("AI permission denied");
    expect(authorize).toHaveBeenCalledWith(context(), "seller.product.extract");
    expect(execute).not.toHaveBeenCalled();
  });

  it("blocks before provider execution when entitlement is denied", async () => {
    const execute = vi.fn(async () => ({ providerId: "test", modelId: "model", output: {} }));

    const runtime = createAIRuntime(execute, {
      async authorize() {},
      async checkEntitlement() { return { allowed: false, reason: "quota exhausted" }; },
      validateOutput() {},
      async validateSafety() { return "allowed"; },
    });

    const result = await runtime.execute(request());

    expect(result.status).toBe("blocked");
    expect(result.warnings).toEqual(["quota exhausted"]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("validates provider output and returns only safety-approved output", async () => {
    const validateOutput = vi.fn();
    const validateSafety = vi.fn(async () => "allowed" as const);
    const execute = vi.fn(async () => ({
      providerId: "test-provider",
      modelId: "test-model",
      output: { title: "Validated" },
    }));

    const runtime = createAIRuntime(execute, {
      async authorize() {},
      async checkEntitlement() { return { allowed: true }; },
      validateOutput,
      validateSafety,
    });

    const result = await runtime.execute<{ title: string }>(request());

    expect(validateOutput).toHaveBeenCalledWith({ title: "Validated" }, "seller-product-draft-v1");
    expect(validateSafety).toHaveBeenCalledWith({ title: "Validated" }, "seller.product.extract");
    expect(result).toMatchObject({
      status: "succeeded",
      output: { title: "Validated" },
      providerId: "test-provider",
      modelId: "test-model",
      safetyDecision: "allowed",
      provenance: "ai_generated",
    });
  });

  it("does not expose output when safety requires abstention", async () => {
    const runtime = createAIRuntime(
      async () => ({ providerId: "test-provider", modelId: "test-model", output: { title: "Unsafe" } }),
      {
        async authorize() {},
        async checkEntitlement() { return { allowed: true }; },
        validateOutput() {},
        async validateSafety() { return "abstained"; },
      },
    );

    const result = await runtime.execute(request());

    expect(result.status).toBe("abstained");
    expect(result.output).toBeUndefined();
    expect(result.provenance).toBe("none");
    expect(result.safetyDecision).toBe("abstained");
  });
});
