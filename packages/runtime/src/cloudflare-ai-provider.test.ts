import { describe, expect, it, vi } from "vitest";
import { createCloudflareAIProvider, type CloudflareAIBinding } from "./cloudflare-ai-provider";

describe("createCloudflareAIProvider", () => {
  it("delegates an explicit model to the real binding and preserves output", async () => {
    const run = vi.fn(async () => ({ response: { title: "Result" }, usage: { input_tokens: 11, output_tokens: 7 } }));
    const provider = createCloudflareAIProvider({ run } as CloudflareAIBinding, {
      providerId: "cloudflare",
      buildInput: (request) => ({ prompt: JSON.stringify(request.input) }),
    });

    const result = await provider.execute({
      operationType: "seller.product.extract",
      promptVersion: "v1",
      input: { name: "Example" },
      outputSchemaVersion: "v1",
      modelId: "@cf/example/model",
    });

    expect(run).toHaveBeenCalledWith("@cf/example/model", { prompt: JSON.stringify({ name: "Example" }) }, undefined);
    expect(result).toMatchObject({ providerId: "cloudflare", modelId: "@cf/example/model", output: { title: "Result" } });
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
  });

  it("supports an AI Gateway binding option", async () => {
    const run = vi.fn(async () => ({ response: "ok" }));
    const provider = createCloudflareAIProvider({ run }, {
      gatewayId: "default",
      buildInput: (request) => request.input,
    });

    await provider.execute({ operationType: "ai.generate", promptVersion: "v1", input: { prompt: "hi" }, outputSchemaVersion: "v1", modelId: "model-1" });
    expect(run).toHaveBeenCalledWith("model-1", { prompt: "hi" }, { gateway: { id: "default" } });
  });

  it("fails closed when no model is selected", async () => {
    const provider = createCloudflareAIProvider({ run: vi.fn() }, { buildInput: () => ({}) });
    await expect(provider.execute({ operationType: "ai.generate", promptVersion: "v1", input: {}, outputSchemaVersion: "v1" })).rejects.toThrow(
      "requires an explicit modelId",
    );
  });
});
