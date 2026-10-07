import { AiWalletService } from "@qooqnos/billing";
import type { EntityId } from "@qooqnos/core";
import type { D1Database } from "@qooqnos/database";
import {
  createAIRuntimeWithGovernance,
  createAIProviderGovernanceRegistry,
  createAIProviderRegistry,
  createArvanAIProvider,
  createCloudflareAIProvider,
  type AIEconomicsSink,
  type AIRoutingPolicy,
  type AIRuntime,
  type AIRuntimePolicy,
  type AIProviderAdapter,
  type AIProviderRequest,
} from "@qooqnos/runtime";
import type { ApiEnv } from "./env";
import { requireAI } from "./env";

const SELLER_EXTRACT_ROUTING_POLICY: AIRoutingPolicy = {
  policyId: "seller-ai.extract",
  version: "1",
  operationTypes: ["seller.product.extract"],
  minimumHealth: ["healthy"],
  allowFallback: true,
};

const CLOUDFLARE_PROVIDER_ID = "cloudflare-workers-ai";
const ARVAN_PROVIDER_ID = "arvan-aiaas";

export function createApiAIRuntime(
  env: ApiEnv,
  policy: AIRuntimePolicy,
  economics?: AIEconomicsSink,
  aiWallet?: AiWalletService,
): AIRuntime {
  const modelId = env.AI_SELLER_EXTRACT_MODEL_ID?.trim();
  if (!modelId) throw new Error("AI_SELLER_EXTRACT_MODEL_ID is not configured");

  const modelVersion = env.AI_SELLER_EXTRACT_MODEL_VERSION?.trim() || "1";
  const providerId = resolveProviderId(env);
  const provider = createProvider(env, providerId, aiWallet);

  const providers = createAIProviderRegistry([
    {
      providerId,
      models: [modelId],
      adapter: provider,
    },
  ]);

  const governance = createAIProviderGovernanceRegistry();
  const region = providerId === ARVAN_PROVIDER_ID
    ? env.ARVAN_AI_REGION?.trim() || "IR"
    : "US";

  governance.registerProvider({
    providerId,
    adapterVersion: "1",
    lifecycle: "active",
    health: "healthy",
    supportedOperationTypes: ["seller.product.extract"],
    supportedClassifications: ["public", "internal"],
    regions: [region],
    approved: true,
    version: "1",
  });

  governance.registerModel({
    modelId,
    providerId,
    providerModelId: modelId,
    version: modelVersion,
    lifecycle: "active",
    approved: true,
    supportedOperationTypes: ["seller.product.extract"],
    supportedClassifications: ["public", "internal"],
    structuredOutput: false,
    toolCalling: false,
    regions: [region],
    routingPriority: 100,
  });

  return createAIRuntimeWithGovernance(
    providers,
    governance,
    policy,
    SELLER_EXTRACT_ROUTING_POLICY,
    undefined,
    economics,
  );
}

export function resolveProviderId(env: ApiEnv): string {
  const explicit = env.AI_PROVIDER_ID?.trim();
  if (explicit) return explicit;

  const hasArvan = Boolean(env.ARVAN_AI_ENDPOINT?.trim() && env.ARVAN_AI_API_KEY?.trim());
  return hasArvan ? ARVAN_PROVIDER_ID : CLOUDFLARE_PROVIDER_ID;
}

function createProvider(env: ApiEnv, providerId: string, aiWallet?: AiWalletService): AIProviderAdapter {
  if (providerId === ARVAN_PROVIDER_ID) {
    const endpoint = env.ARVAN_AI_ENDPOINT?.trim();
    const apiKey = env.ARVAN_AI_API_KEY?.trim();
    if (!endpoint) throw new Error("ARVAN_AI_ENDPOINT is not configured");
    if (!apiKey) throw new Error("ARVAN_AI_API_KEY is not configured");

    const maxTokens = parsePositiveInteger(env.ARVAN_AI_MAX_TOKENS);
    const temperature = parseFiniteNumber(env.ARVAN_AI_TEMPERATURE);

    const provider = createArvanAIProvider({
      endpoint,
      apiKey,
      providerId: ARVAN_PROVIDER_ID,
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
    });
    if (!aiWallet) throw new Error("Arvan AI requires a configured AI wallet");
    return createWalletAwareArvanProvider(provider, aiWallet, maxTokens ?? 3000);
  }

  if (providerId === CLOUDFLARE_PROVIDER_ID) {
    return {
      async execute(request: AIProviderRequest) {
        const adapter = createCloudflareAIProvider(requireAI(env), {
          providerId: CLOUDFLARE_PROVIDER_ID,
          ...(env.AI_GATEWAY_ID?.trim() ? { gatewayId: env.AI_GATEWAY_ID.trim() } : {}),
          buildInput: (providerRequest) => ({
            operationType: providerRequest.operationType,
            promptVersion: providerRequest.promptVersion,
            input: providerRequest.input,
            outputSchemaVersion: providerRequest.outputSchemaVersion,
          }),
        });
        return adapter.execute(request);
      },
    };
  }

  throw new Error(`Unsupported AI_PROVIDER_ID: ${providerId}`);
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseFiniteNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}


export function createApiAiWalletService(
  env: ApiEnv,
  database: D1Database,
  id: () => EntityId,
  now: () => string,
): AiWalletService | undefined {
  if (resolveProviderId(env) !== ARVAN_PROVIDER_ID) return undefined;
  const modelId = env.AI_SELLER_EXTRACT_MODEL_ID?.trim();
  if (!modelId) throw new Error("AI_SELLER_EXTRACT_MODEL_ID is not configured");
  const inputPrice = parsePositiveInteger(env.ARVAN_AI_INPUT_PRICE_PER_1M_IRR);
  const outputPrice = parsePositiveInteger(env.ARVAN_AI_OUTPUT_PRICE_PER_1M_IRR);
  if (inputPrice === undefined || outputPrice === undefined) {
    throw new Error("Arvan AI input/output token pricing must be configured before AI execution");
  }
  const markupBps = parseNonNegativeInteger(env.ARVAN_AI_MARKUP_BPS) ?? 5000;
  return new AiWalletService({
    database,
    id,
    now,
    pricing: {
      providerId: ARVAN_PROVIDER_ID,
      modelId,
      currency: "IRR",
      inputAmountPerMillionMinor: inputPrice,
      outputAmountPerMillionMinor: outputPrice,
      markupBps,
      pricingVersion: "arvan-config-v1",
    },
    defaultOutputTokenReserve: parsePositiveInteger(env.ARVAN_AI_MAX_TOKENS) ?? 3000,
  });
}

function createWalletAwareArvanProvider(
  provider: AIProviderAdapter,
  wallet: AiWalletService,
  defaultOutputTokenReserve: number,
): AIProviderAdapter {
  return {
    async execute(request: AIProviderRequest) {
      if (!request.context || !request.operationId || !request.idempotencyKey || !request.modelId) {
        throw new Error("AI wallet billing context is missing from provider request");
      }
      const reservation = await wallet.reserveArvan(request.context, {
        operationId: request.operationId,
        idempotencyKey: request.idempotencyKey,
        modelId: request.modelId,
        estimatedInputTokens: estimateAiInputTokens(request.input),
        estimatedOutputTokens: defaultOutputTokenReserve,
      });
      let settled = false;
      try {
        const response = await provider.execute(request);
        const inputTokens = response.usage?.inputTokens;
        const outputTokens = response.usage?.outputTokens;
        if (inputTokens === undefined || outputTokens === undefined) {
          throw new Error("Arvan AI response did not include token usage required for wallet settlement");
        }
        await wallet.settleArvan(
          request.context,
          reservation,
          { inputTokens, outputTokens },
          request.operationId,
          request.idempotencyKey,
        );
        settled = true;
        return response;
      } catch (error) {
        if (!settled) {
          await wallet.releaseArvan(
            request.context,
            reservation,
            request.operationId,
            request.idempotencyKey,
            error instanceof Error ? error.message : "AI execution failed",
          ).catch(() => undefined);
        }
        throw error;
      }
    },
  };
}

function estimateAiInputTokens(input: unknown): number {
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  const bytes = serialized ? new TextEncoder().encode(serialized).byteLength : 0;
  return Math.max(1, Math.ceil(bytes / 3) + 512);
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
