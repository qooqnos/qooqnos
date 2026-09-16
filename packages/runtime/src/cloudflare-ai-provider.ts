import type { AIProviderAdapter, AIProviderRequest, AIProviderResponse } from "./ai-runtime";

export interface CloudflareAIResult {
  readonly response: unknown;
  readonly usage?: {
    readonly inputTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
  };
}

export interface CloudflareAIInputBuilder {
  build(request: AIProviderRequest): unknown;
}

export interface CloudflareAIBinding {
  run<T = unknown>(model: string, input: unknown, options?: Record<string, unknown>): Promise<T>;
}

export interface CloudflareAIProviderOptions {
  readonly providerId?: string;
  readonly gatewayId?: string | undefined;
  readonly buildInput: CloudflareAIInputBuilder["build"];
}

/** Adapter for the real Cloudflare Workers AI binding. It owns no policy, billing, retry, or domain state. */
export function createCloudflareAIProvider(
  binding: CloudflareAIBinding,
  options: CloudflareAIProviderOptions,
): AIProviderAdapter {
  return {
    async execute(request): Promise<AIProviderResponse> {
      if (!request.modelId?.trim()) throw new Error("Cloudflare AI provider requires an explicit modelId");

      const input = options.buildInput(request);
      const runOptions = options.gatewayId === undefined ? undefined : { gateway: { id: options.gatewayId } };
      const raw = await binding.run<unknown>(request.modelId, input, runOptions);
      const result = normalizeResult(raw);

      return {
        providerId: options.providerId ?? "cloudflare-workers-ai",
        modelId: request.modelId,
        output: result.response,
        ...(result.usage !== undefined
          ? {
              usage: {
                ...(result.usage.inputTokens !== undefined ? { inputTokens: result.usage.inputTokens } : {}),
                ...(result.usage.outputTokens !== undefined ? { outputTokens: result.usage.outputTokens } : {}),
              },
            }
          : {}),
      };
    },
  };
}

function normalizeResult(raw: unknown): CloudflareAIResult {
  if (raw === null || typeof raw !== "object") return { response: raw };
  const record = raw as Record<string, unknown>;
  const usage = record.usage;
  if (usage === null || typeof usage !== "object") return { response: raw };
  const usageRecord = usage as Record<string, unknown>;
  const inputTokens = readNonNegativeNumber(usageRecord.input_tokens ?? usageRecord.inputTokens);
  const outputTokens = readNonNegativeNumber(usageRecord.output_tokens ?? usageRecord.outputTokens);
  if (inputTokens === undefined && outputTokens === undefined) return { response: raw };
  return {
    response: record.response ?? raw,
    usage: {
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    },
  };
}

function readNonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
