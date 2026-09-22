import type { RequestContext } from "@qooqnos/core";
import { DatabaseError } from "@qooqnos/database";
import { BillingRepository } from "./repository";
import type { BillingAIEntitlementDecision, BillingAIEntitlementRequest, BillingAIEntitlementService } from "./contract";

export interface BillingServiceOptions {
  readonly repository: BillingRepository;
  readonly id: () => string;
  readonly now: () => string;
}

export class BillingService implements BillingAIEntitlementService {
  constructor(private readonly options: BillingServiceOptions) {}

  async evaluate(
    input: BillingAIEntitlementRequest,
  ): Promise<BillingAIEntitlementDecision> {
    const businessId = input.businessId;
    if (!businessId) {
      return {
        allowed: false,
        decision: "denied",
        entitlementDecisionId: this.options.id(),
        reason: "Business billing scope is required",
      };
    }

    const subscription = await this.options.repository.getActiveSubscription(input.context, businessId);
    if (!subscription) {
      return {
        allowed: false,
        decision: "denied",
        entitlementDecisionId: this.options.id(),
        reason: "No active Billing subscription",
      };
    }

    const snapshots = await this.options.repository.listEntitlementSnapshots(input.context, subscription.id);
    const snapshot = snapshots.find((item) => item.entitlementKey === input.operationType);
    if (!snapshot) {
      return {
        allowed: false,
        decision: "denied",
        entitlementDecisionId: this.options.id(),
        reason: "No Billing entitlement for operation type",
      };
    }

    if (snapshot.valueType === "boolean") {
      if (snapshot.value !== true) {
        return {
          allowed: false,
          decision: "denied",
          entitlementDecisionId: this.options.id(),
          entitlementKey: snapshot.entitlementKey,
          reason: "Entitlement is disabled",
        };
      }
      return {
        allowed: true,
        decision: "included",
        entitlementDecisionId: this.options.id(),
        entitlementKey: snapshot.entitlementKey,
      };
    }

    const quantity = input.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new DatabaseError("Billing entitlement quantity must be a positive integer");
    }

    if (snapshot.valueType !== "integer") {
      return {
        allowed: true,
        decision: "included",
        entitlementDecisionId: this.options.id(),
        entitlementKey: snapshot.entitlementKey,
      };
    }

    const meterKey = input.operationType;
    const periodKey = buildPeriodKey(subscription.currentPeriodStart, subscription.currentPeriodEnd, this.options.now());
    const quota = await this.options.repository.consumeUsageQuota(input.context, {
      subscription,
      meterKey,
      quantity,
      periodKey,
      sourceEventId: input.idempotencyKey,
      correlationId: input.context.correlationId,
      fallbackLimit: Number(snapshot.value),
      now: this.options.now(),
    });

    if (!quota.allowed) {
      return {
        allowed: false,
        decision: quota.reason ? "temporary_unavailable" : "denied",
        entitlementDecisionId: this.options.id(),
        entitlementKey: snapshot.entitlementKey,
        quotaKey: meterKey,
        quotaLimit: quota.limit ?? Number(snapshot.value),
        quotaRemaining: quota.remaining ?? 0,
        reason: quota.reason ?? "Billing quota exhausted",
      };
    }

    return {
      allowed: true,
      decision: "quota_consumed",
      entitlementDecisionId: this.options.id(),
      entitlementKey: snapshot.entitlementKey,
      quotaKey: meterKey,
      quotaLimit: quota.limit ?? Number(snapshot.value),
      quotaRemaining: quota.remaining ?? undefined,
      reservedUnits: quantity,
    };
  }
}

function buildPeriodKey(
  start: string,
  end: string | null,
  now: string,
): string {
  if (end) return start + "/" + end;
  return start + "/" + now.slice(0, 10);
}
