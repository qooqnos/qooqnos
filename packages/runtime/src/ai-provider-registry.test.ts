import { describe, expect, it, vi } from "vitest";
import { createAIProviderRegistry, AIProviderUnavailableError } from "./ai-provider-registry";

describe("createAIProviderRegistry", () => {
  it("resolves an explicitly requested provider and model", async () => {
    const execute = vi.fn(async () => ({ providerId: "provider-a", modelId: "model-1", output: { ok: true } }));
    const registry = createAIProviderRegistry([
      { providerId: "provider-a", models: ["model-1", "model-2"], adapter: { execute } },
    ]);

    const result = await registry.execute(
      { operationType: "ai.extract", promptVersion: "v1", input: {}, outputSchemaVersion: "v1" },
      { providerId: "provider-a", modelId: "model-1" },
    );

    expect(result).toMatchObject({ providerId: "provider-a", modelId: "model-1" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("fails closed when a requested provider or model is unavailable", () => {
    const registry = createAIProviderRegistry([
      { providerId: "provider-a", models: ["model-1"], adapter: { execute: async () => ({ providerId: "provider-a", modelId: "model-1", output: {} }) } },
    ]);

    expect(() => registry.resolve({ providerId: "provider-b" })).toThrow(AIProviderUnavailableError);
    expect(() => registry.resolve({ providerId: "provider-a", modelId: "model-9" })).toThrow(
      "No AI provider is registered for provider-a/model-9",
    );
  });

  it("rejects duplicate provider registrations", () => {
    const registry = createAIProviderRegistry([
      { providerId: "provider-a", models: ["model-1"], adapter: { execute: async () => ({ providerId: "provider-a", modelId: "model-1", output: {} }) } },
    ]);

    expect(() => registry.register({ providerId: "provider-a", models: ["model-2"], adapter: { execute: async () => ({ providerId: "provider-a", modelId: "model-2", output: {} }) } })).toThrow(
      "AI provider provider-a is already registered",
    );
  });
});
