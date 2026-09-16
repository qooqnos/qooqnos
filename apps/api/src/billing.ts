import type { BillingAIEntitlementService } from "@qooqnos/billing";

/**
 * Safe default until a real Billing implementation is injected into the API composition root.
 * It never grants execution and never fabricates quota, pricing, or credit state.
 */
export function createUnavailableBillingAIEntitlementService(): BillingAIEntitlementService {
  return {
    async evaluate() {
      return {
        allowed: false,
        decision: "temporary_unavailable",
        entitlementDecisionId: `billing-unavailable:${crypto.randomUUID()}`,
        reason: "Billing entitlement service is not configured.",
      };
    },
  };
}
