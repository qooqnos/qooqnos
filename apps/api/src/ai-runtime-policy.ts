import { AiWalletService, estimateAiInputTokens } from "@qooqnos/billing";
import type { BillingAIEntitlementService } from "@qooqnos/billing";
import type { RequestContext } from "@qooqnos/core";
import type {
  AIEconomicsSink,
  AIEntitlementDecision,
  AIRuntimePolicy,
  AIRuntimeRequest,
} from "@qooqnos/runtime";
import type { AuthorizationService } from "@qooqnos/runtime";

export interface SellerProductAIRuntimePolicyOptions {
  readonly authorization: AuthorizationService;
  readonly billing: BillingAIEntitlementService;
  readonly validateOutput: AIRuntimePolicy["validateOutput"];
  readonly validateSafety: AIRuntimePolicy["validateSafety"];
  readonly aiWallet?: AiWalletService | undefined;
  readonly aiProviderId?: string | undefined;
  readonly aiModelId?: string | undefined;
}

/**
 * API adapter between the canonical Seller AI Runtime and authoritative platform boundaries.
 * Billing owns entitlement/quota/credit/pricing decisions; API only translates the contract.
 */
export function createSellerProductAIRuntimePolicy(
  options: SellerProductAIRuntimePolicyOptions,
): AIRuntimePolicy {
  return {
    async authorize(context: RequestContext) {
      await options.authorization.assert({
        context,
        permission: "ai.seller_product.generate_draft",
        requireAuthentication: true,
        requireWorkspace: true,
      });
    },

    async checkEntitlement(request: AIRuntimeRequest): Promise<AIEntitlementDecision> {
      const decision = await options.billing.evaluate({
        context: request.context,
        ...(request.businessId !== undefined ? { businessId: request.businessId } : {}),
        operationId: request.operationId,
        operationType: request.operationType,
        operationVersion: request.operationVersion,
        idempotencyKey: request.idempotencyKey,
        ...(request.budgetUnits !== undefined ? { budgetUnits: request.budgetUnits } : {}),
      });

      if (decision.allowed
        && options.aiWallet
        && options.aiProviderId === "arvan-aiaas"
        && options.aiModelId) {
        const preflight = await options.aiWallet.preflightArvan(request.context, {
          modelId: options.aiModelId,
          estimatedInputTokens: estimateAiInputTokens(request.input),
        });
        if (!preflight.allowed) {
          return {
            allowed: false,
            decision: "denied",
            entitlementDecisionId: decision.entitlementDecisionId,
            entitlementKey: decision.entitlementKey,
            pricingVersion: decision.pricingVersion,
            reason: preflight.reason ?? "AI wallet funding is insufficient",
          };
        }
      }

      return {
        allowed: decision.allowed,
        decision: decision.decision,
        entitlementDecisionId: decision.entitlementDecisionId,
        entitlementKey: decision.entitlementKey,
        ...(decision.pricingVersion !== undefined ? { policyVersion: decision.pricingVersion } : {}),
        ...(decision.meterId !== undefined ? { meterKey: decision.meterId } : {}),
        ...(decision.reservedUnits !== undefined ? { reservedQuantity: decision.reservedUnits } : {}),
        ...(decision.pricingVersion !== undefined ? { pricingReference: decision.pricingVersion } : {}),
        ...(decision.reason !== undefined ? { reason: decision.reason } : {}),
      };
    },

    validateOutput: options.validateOutput,
    validateSafety: options.validateSafety,
  };
}

export type SellerProductAIRuntimePolicyFactory = (
  options: SellerProductAIRuntimePolicyOptions,
) => AIRuntimePolicy;

export type SellerProductAIEconomics = AIEconomicsSink;
