import { describe, expect, it, vi } from "vitest";
import { createArvanAIProvider } from "./arvan-ai-provider";

describe("createArvanAIProvider", () => {
  it("calls the Arvan AI chat completions endpoint with apikey authentication", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    const provider = createArvanAIProvider({
      endpoint: "https://example.arvan.test/endpoint/",
      apiKey: "secret",
      fetchImpl: fetchMock,
      maxTokens: 512,
      temperature: 0.2,
    });

    const result = await provider.execute({
      operationType: "seller.product.extract",
      promptVersion: "seller-product-v1",
      input: { rawText: "کفش چرمی" },
      outputSchemaVersion: "seller-product-draft-v1",
      modelId: "DeepSeek-R1-qwen-7b-awq",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://example.arvan.test/endpoint/chat/completions");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("apikey secret");

    const body = JSON.parse(String(init?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      max_tokens: number;
      temperature: number;
    };
    expect(body.model).toBe("DeepSeek-R1-qwen-7b-awq");
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[1]?.content).toContain("کفش چرمی");
    expect(body.max_tokens).toBe(512);
    expect(body.temperature).toBe(0.2);

    expect(result.providerId).toBe("arvan-aiaas");
    expect(result.modelId).toBe("DeepSeek-R1-qwen-7b-awq");
    expect(result.output).toEqual({ ok: true });
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 5 });
    expect(result.cost?.latencyMs).toEqual(expect.any(Number));
  });

  it("accepts a custom message builder and parses fenced JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: "```json\\n{\"title\":\"کالا\"}\\n```" } }],
      }), { status: 200 }),
    );

    const provider = createArvanAIProvider({
      endpoint: "https://example.arvan.test/endpoint",
      apiKey: "secret",
      fetchImpl: fetchMock,
      buildMessages: () => [
        { role: "system", content: "custom" },
        { role: "user", content: "input" },
      ],
    });

    const result = await provider.execute({
      operationType: "ai.generate",
      promptVersion: "v1",
      input: { ignored: true },
      outputSchemaVersion: "v1",
      modelId: "model-1",
    });

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages).toEqual([
      { role: "system", content: "custom" },
      { role: "user", content: "input" },
    ]);
    expect(result.output).toEqual({ title: "کالا" });
  });

  it("surfaces provider HTTP failures", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 }),
    );

    const provider = createArvanAIProvider({
      endpoint: "https://example.arvan.test/endpoint",
      apiKey: "secret",
      fetchImpl: fetchMock,
    });

    await expect(provider.execute({
      operationType: "ai.generate",
      promptVersion: "v1",
      input: {},
      outputSchemaVersion: "v1",
      modelId: "model-1",
    })).rejects.toThrow("Arvan AI request failed (429): rate limited");
  });
});
