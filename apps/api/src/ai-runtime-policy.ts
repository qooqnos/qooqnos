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
        operationId: request.operationId,
        operationType: request.operationType,
        operationVersion: request.operationVersion,
        idempotencyKey: request.idempotencyKey,
        ...(request.budgetUnits !== undefined ? { budgetUnits: request.budgetUnits } : {}),
      });

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
