import type { EntityId, RequestContext } from "@qooqnos/core";

export type BillingEntitlementDecision =
  | "included"
  | "quota_consumed"
  | "credit_consumed"
  | "chargeable"
  | "hybrid"
  | "denied"
  | "temporary_unavailable";

export interface BillingAIEntitlementRequest {
  readonly context: RequestContext;
  readonly operationId: string;
  readonly operationType: string;
  readonly operationVersion: number;
  readonly businessId?: EntityId | undefined;
  readonly idempotencyKey: string;
  readonly quantity?: number | undefined;
  readonly budgetUnits?: number | undefined;
}

export interface BillingAIEntitlementDecision {
  readonly allowed: boolean;
  readonly decision: BillingEntitlementDecision;
  readonly entitlementDecisionId: string;
  readonly entitlementKey?: string | undefined;
  readonly quotaKey?: string | undefined;
  readonly quotaLimit?: number | undefined;
  readonly quotaRemaining?: number | undefined;
  readonly creditAccountId?: EntityId | undefined;
  readonly pricingVersion?: string | undefined;
  readonly meterId?: string | undefined;
  readonly reservedUnits?: number | undefined;
  readonly chargeableUnits?: number | undefined;
  readonly reason?: string | undefined;
}

/** Billing is the authoritative boundary for AI entitlement, quota, credits and pricing decisions. */
export interface BillingAIEntitlementService {
  evaluate(input: BillingAIEntitlementRequest): Promise<BillingAIEntitlementDecision>;
}

export const BILLING_MODULE_ID = "billing" as const;
export const BILLING_AI_ENTITLEMENT_CONTRACT_VERSION = 1 as const;
