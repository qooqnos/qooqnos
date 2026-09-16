import {
  createAIRuntimeWithGovernance,
  createAIProviderGovernanceRegistry,
  createAIProviderRegistry,
  createCloudflareAIProvider,
  type AIEconomicsSink,
  type AIRoutingPolicy,
  type AIRuntime,
  type AIRuntimePolicy,
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

export function createApiAIRuntime(
  env: ApiEnv,
  policy: AIRuntimePolicy,
  economics?: AIEconomicsSink,
): AIRuntime {
  const modelId = env.AI_SELLER_EXTRACT_MODEL_ID?.trim();
  if (!modelId) throw new Error("AI_SELLER_EXTRACT_MODEL_ID is not configured");

  const modelVersion = env.AI_SELLER_EXTRACT_MODEL_VERSION?.trim() || "1";
  const providerId = "cloudflare-workers-ai";
  const provider = {
    async execute(request: Parameters<ReturnType<typeof createCloudflareAIProvider>["execute"]>[0]) {
      const adapter = createCloudflareAIProvider(requireAI(env), {
        providerId,
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

  const providers = createAIProviderRegistry([
    {
      providerId,
      models: [modelId],
      adapter: provider,
    },
  ]);

  const governance = createAIProviderGovernanceRegistry();
  governance.registerProvider({
    providerId,
    adapterVersion: "1",
    lifecycle: "active",
    health: "healthy",
    supportedOperationTypes: ["seller.product.extract"],
    supportedClassifications: ["public", "internal"],
    regions: ["US"],
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
    regions: ["US"],
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
