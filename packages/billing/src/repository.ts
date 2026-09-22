import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export interface BillingPlanRecord {
  readonly id: EntityId;
  readonly planKey: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: "draft" | "active" | "retired";
}

export interface BillingPriceRecord {
  readonly id: EntityId;
  readonly planId: EntityId;
  readonly currency: string;
  readonly amountMinor: number;
  readonly billingInterval: "monthly" | "yearly" | "one_time";
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly providerPriceReference: string | null;
}

export interface BillingSubscriptionRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId;
  readonly planId: EntityId;
  readonly billingPriceId: EntityId;
  readonly status: "trialing" | "active" | "past_due" | "grace_period" | "suspended" | "cancelled" | "expired";
  readonly startsAt: string;
  readonly trialEndsAt: string | null;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string | null;
  readonly graceUntil: string | null;
  readonly cancelledAt: string | null;
  readonly expiresAt: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BillingEntitlementSnapshotRecord {
  readonly id: EntityId;
  readonly subscriptionId: EntityId;
  readonly entitlementKey: string;
  readonly valueType: "integer" | "number" | "boolean" | "text" | "json";
  readonly value: unknown;
  readonly sourcePlanId: EntityId;
  readonly sourcePlanVersion: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}

export class BillingRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async createPlan(
    input: {
      readonly id: EntityId;
      readonly planKey: string;
      readonly name: string;
      readonly description?: string | undefined;
      readonly status?: "draft" | "active" | "retired";
      readonly now: string;
    },
  ): Promise<BillingPlanRecord> {
    await this.database.run(
      "INSERT INTO billing_plans (id, plan_key, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.planKey.trim(),
      input.name.trim(),
      input.description?.trim() || null,
      input.status ?? "draft",
      input.now,
      input.now,
    );
    const plan = await this.getPlan(input.id);
    if (!plan) throw new DatabaseError("Billing plan not found after creation");
    return plan;
  }

  async getPlan(id: EntityId): Promise<BillingPlanRecord | null> {
    return this.database.first<BillingPlanRecord>(
      "SELECT id, plan_key AS planKey, name, description, status FROM billing_plans WHERE id = ? LIMIT 1",
      id,
    );
  }

  async createPrice(
    input: {
      readonly id: EntityId;
      readonly planId: EntityId;
      readonly currency: string;
      readonly amountMinor: number;
      readonly billingInterval: BillingPriceRecord["billingInterval"];
      readonly effectiveFrom: string;
      readonly effectiveTo?: string | undefined;
      readonly taxTreatmentReference?: string | undefined;
      readonly providerPriceReference?: string | undefined;
      readonly now: string;
    },
  ): Promise<BillingPriceRecord> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
      throw new DatabaseError("Billing price must be a non-negative integer minor-unit value");
    }
    await this.database.run(
      "INSERT INTO billing_prices (id, plan_id, currency, amount_minor, billing_interval, effective_from, effective_to, tax_treatment_reference, provider_price_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      input.planId,
      normalizeCurrency(input.currency),
      input.amountMinor,
      input.billingInterval,
      input.effectiveFrom,
      input.effectiveTo ?? null,
      input.taxTreatmentReference ?? null,
      input.providerPriceReference ?? null,
      input.now,
      input.now,
    );
    const row = await this.database.first<BillingPriceRecord>(
      "SELECT id, plan_id AS planId, currency, amount_minor AS amountMinor, billing_interval AS billingInterval, effective_from AS effectiveFrom, effective_to AS effectiveTo, provider_price_reference AS providerPriceReference FROM billing_prices WHERE id = ? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Billing price not found after creation");
    return row;
  }

  async setPlanEntitlement(
    input: {
      readonly id: EntityId;
      readonly planId: EntityId;
      readonly entitlementKey: string;
      readonly value: unknown;
      readonly now: string;
    },
  ): Promise<void> {
    if (!input.entitlementKey.trim()) throw new DatabaseError("Billing entitlement key is required");
    const valueType =
      typeof input.value === "boolean"
        ? "boolean"
        : typeof input.value === "number"
          ? Number.isInteger(input.value) ? "integer" : "number"
          : typeof input.value === "string"
            ? "text"
            : "json";
    await this.database.run(
      "INSERT INTO billing_plan_entitlements (id, plan_id, entitlement_key, value_type, value_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
      input.id,
      input.planId,
      input.entitlementKey.trim(),
      valueType,
      JSON.stringify(input.value),
      input.now,
      input.now,
    );
  }

  async createSubscription(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly businessId: EntityId;
      readonly planId: EntityId;
      readonly billingPriceId: EntityId;
      readonly status?: BillingSubscriptionRecord["status"];
      readonly startsAt: string;
      readonly trialEndsAt?: string | undefined;
      readonly currentPeriodStart: string;
      readonly currentPeriodEnd?: string | undefined;
      readonly now: string;
    },
  ): Promise<BillingSubscriptionRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = context.workspaceId ?? null;
    await this.database.run(
      "INSERT INTO billing_subscriptions (id, organization_id, workspace_id, business_id, plan_id, billing_price_id, status, starts_at, trial_ends_at, current_period_start, current_period_end, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
      input.id,
      organizationId,
      workspaceId,
      input.businessId,
      input.planId,
      input.billingPriceId,
      input.status ?? "trialing",
      input.startsAt,
      input.trialEndsAt ?? null,
      input.currentPeriodStart,
      input.currentPeriodEnd ?? null,
      input.now,
      input.now,
    );
    const subscription = await this.getSubscription(context, input.id);
    if (!subscription) throw new DatabaseError("Billing subscription not found after creation");
    return subscription;
  }

  async getSubscription(context: RequestContext, id: EntityId): Promise<BillingSubscriptionRecord | null> {
    return this.database.first<BillingSubscriptionRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, plan_id AS planId, billing_price_id AS billingPriceId, status, starts_at AS startsAt, trial_ends_at AS trialEndsAt, current_period_start AS currentPeriodStart, current_period_end AS currentPeriodEnd, grace_until AS graceUntil, cancelled_at AS cancelledAt, expires_at AS expiresAt, version, created_at AS createdAt, updated_at AS updatedAt FROM billing_subscriptions WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
  }

  async getActiveSubscription(
    context: RequestContext,
    businessId: EntityId,
  ): Promise<BillingSubscriptionRecord | null> {
    return this.database.first<BillingSubscriptionRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, plan_id AS planId, billing_price_id AS billingPriceId, status, starts_at AS startsAt, trial_ends_at AS trialEndsAt, current_period_start AS currentPeriodStart, current_period_end AS currentPeriodEnd, grace_until AS graceUntil, cancelled_at AS cancelledAt, expires_at AS expiresAt, version, created_at AS createdAt, updated_at AS updatedAt FROM billing_subscriptions WHERE business_id = ? AND organization_id = ? AND status IN ('trialing','active','past_due','grace_period','suspended') AND (workspace_id IS NULL OR workspace_id = ?) ORDER BY version DESC, created_at DESC LIMIT 1",
      businessId,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
  }

  async transitionSubscription(
    context: RequestContext,
    id: EntityId,
    status: BillingSubscriptionRecord["status"],
    occurredAt: string,
    now: string,
    correlationId: string,
  ): Promise<BillingSubscriptionRecord> {
    const current = await this.getSubscription(context, id);
    if (!current) throw new DatabaseError("Billing subscription not found");
    if (current.status === status) return current;

    await this.database.transaction([
      {
        sql: "UPDATE billing_subscriptions SET status = ?, version = version + 1, cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END, expires_at = CASE WHEN ? = 'expired' THEN ? ELSE expires_at END, updated_at = ? WHERE id = ?",
        params: [status, status, occurredAt, status, occurredAt, now, id],
      },
      {
        sql: "INSERT INTO billing_subscription_events (id, subscription_id, from_status, to_status, event_type, source, actor_reference, occurred_at, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [id + ":" + occurredAt, id, current.status, status, "subscription.status.changed", "billing", context.actorId ?? null, occurredAt, correlationId, now],
      },
    ]);
    const updated = await this.getSubscription(context, id);
    if (!updated) throw new DatabaseError("Billing subscription not found after transition");
    return updated;
  }

  async materializeEntitlements(
    context: RequestContext,
    subscriptionId: EntityId,
    now: string,
  ): Promise<readonly BillingEntitlementSnapshotRecord[]> {
    const subscription = await this.getSubscription(context, subscriptionId);
    if (!subscription) throw new DatabaseError("Billing subscription not found");

    const planEntitlements = await this.database.all<{
      readonly id: EntityId;
      readonly entitlementKey: string;
      readonly valueType: BillingEntitlementSnapshotRecord["valueType"];
      readonly valueJson: string;
      readonly version: number;
    }>(
      "SELECT id, entitlement_key AS entitlementKey, value_type AS valueType, value_json AS valueJson, version FROM billing_plan_entitlements WHERE plan_id = ? ORDER BY entitlement_key, version DESC",
      subscription.planId,
    );

    await this.database.transaction(
      planEntitlements.map((entitlement) => ({
        sql: "INSERT OR IGNORE INTO billing_entitlement_snapshots (id, subscription_id, entitlement_key, value_type, value_json, source_plan_id, source_plan_version, effective_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params: [
          subscriptionId + ":" + entitlement.entitlementKey + ":" + entitlement.version,
          subscriptionId,
          entitlement.entitlementKey,
          entitlement.valueType,
          entitlement.valueJson,
          subscription.planId,
          entitlement.version,
          now,
        ],
      })),
    );

    return this.listEntitlementSnapshots(context, subscriptionId);
  }

  async listEntitlementSnapshots(
    context: RequestContext,
    subscriptionId: EntityId,
  ): Promise<readonly BillingEntitlementSnapshotRecord[]> {
    const subscription = await this.getSubscription(context, subscriptionId);
    if (!subscription) throw new DatabaseError("Billing subscription not found");
    const rows = await this.database.all<BillingEntitlementSnapshotRow>(
      "SELECT id, subscription_id AS subscriptionId, entitlement_key AS entitlementKey, value_type AS valueType, value_json AS valueJson, source_plan_id AS sourcePlanId, source_plan_version AS sourcePlanVersion, effective_from AS effectiveFrom, effective_to AS effectiveTo FROM billing_entitlement_snapshots WHERE subscription_id = ? AND (effective_to IS NULL OR effective_to > CURRENT_TIMESTAMP) ORDER BY entitlement_key, effective_from DESC",
      subscriptionId,
    );
    return rows.map(parseEntitlementSnapshot);
  }

  async consumeUsageQuota(
    context: RequestContext,
    input: {
      readonly subscription: BillingSubscriptionRecord;
      readonly meterKey: string;
      readonly quantity: number;
      readonly periodKey: string;
      readonly sourceEventId: string;
      readonly correlationId: string;
      readonly now: string;
    },
  ): Promise<{ allowed: boolean; limit: number | null; remaining: number | null }> {
    if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
      throw new DatabaseError("Billing usage quantity must be a positive integer");
    }

    const existingUsage = await this.database.first<{ quantity: number; meterId: EntityId }>(
      "SELECT quantity, meter_id AS meterId FROM billing_usage_events WHERE source_event_id = ? AND organization_id = ? LIMIT 1",
      input.sourceEventId,
      input.subscription.organizationId,
    );
    if (existingUsage) {
      const meter = await this.database.first<{ hardLimit: number | null }>(
        "SELECT hard_limit AS hardLimit FROM billing_usage_meters WHERE id = ? LIMIT 1",
        existingUsage.meterId,
      );
      const counter = await this.database.first<{ quantity: number }>(
        "SELECT quantity FROM billing_usage_counters WHERE id = ? LIMIT 1",
        input.subscription.id + ":" + existingUsage.meterId + ":" + input.periodKey,
      );
      return {
        allowed: true,
        limit: meter?.hardLimit ?? null,
        remaining: meter?.hardLimit === null || meter?.hardLimit === undefined
          ? null
          : Math.max(0, meter.hardLimit - (counter?.quantity ?? 0)),
      };
    }

    const meter = await this.database.first<{ id: EntityId; hardLimit: number | null }>(
      "SELECT id, hard_limit AS hardLimit FROM billing_usage_meters WHERE meter_key = ? AND status = 'active' LIMIT 1",
      input.meterKey,
    );
    if (!meter) return { allowed: true, limit: null, remaining: null };

    const counterId = input.subscription.id + ":" + meter.id + ":" + input.periodKey;
    await this.database.run(
      "INSERT OR IGNORE INTO billing_usage_counters (id, organization_id, workspace_id, business_id, meter_id, period_key, quantity, version, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)",
      counterId,
      input.subscription.organizationId,
      input.subscription.workspaceId,
      input.subscription.businessId,
      meter.id,
      input.periodKey,
      input.now,
    );

    if (meter.hardLimit === null) {
      await this.database.run(
        "UPDATE billing_usage_counters SET quantity = quantity + ?, version = version + 1, updated_at = ? WHERE id = ?",
        input.quantity,
        input.now,
        counterId,
      );
      return { allowed: true, limit: null, remaining: null };
    }

    const update = await this.database.run(
      "UPDATE billing_usage_counters SET quantity = quantity + ?, version = version + 1, updated_at = ? WHERE id = ? AND quantity + ? <= ?",
      input.quantity,
      input.now,
      counterId,
      input.quantity,
      meter.hardLimit,
    );
    if ((update.meta?.changes ?? 0) !== 1) {
      const current = await this.database.first<{ quantity: number }>(
        "SELECT quantity FROM billing_usage_counters WHERE id = ? LIMIT 1",
        counterId,
      );
      return {
        allowed: false,
        limit: meter.hardLimit,
        remaining: Math.max(0, (meter.hardLimit ?? 0) - (current?.quantity ?? 0)),
      };
    }

    await this.database.run(
      "INSERT OR IGNORE INTO billing_usage_events (id, organization_id, workspace_id, business_id, meter_id, source_event_id, quantity, occurred_at, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      counterId + ":" + input.sourceEventId,
      input.subscription.organizationId,
      input.subscription.workspaceId,
      input.subscription.businessId,
      meter.id,
      input.sourceEventId,
      input.quantity,
      input.now,
      input.correlationId,
      input.now,
    );

    return {
      allowed: true,
      limit: meter.hardLimit,
      remaining: Math.max(0, meter.hardLimit - ((await this.getUsageCounter(counterId)) ?? 0)),
    };
  }

  private async getUsageCounter(id: string): Promise<number | null> {
    const row = await this.database.first<{ quantity: number }>(
      "SELECT quantity FROM billing_usage_counters WHERE id = ? LIMIT 1",
      id,
    );
    return row?.quantity ?? null;
  }

  private async getUsageCounterForSource(
    context: RequestContext,
    meterId: EntityId,
    sourceEventId: string,
  ): Promise<number | null> {
    const row = await this.database.first<{ quantity: number }>(
      "SELECT quantity FROM billing_usage_events WHERE meter_id = ? AND source_event_id = ? AND organization_id = ? LIMIT 1",
      meterId,
      sourceEventId,
      this.requireOrganization({ organizationId: context.tenantId }),
    );
    return row?.quantity ?? null;
  }

  async recordProviderReference(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly businessId?: EntityId | undefined;
      readonly provider: string;
      readonly referenceType: string;
      readonly externalReference: string;
      readonly status: string;
      readonly metadata?: Readonly<Record<string, unknown>> | undefined;
      readonly now: string;
    },
  ): Promise<void> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    await this.database.run(
      "INSERT INTO billing_provider_refs (id, organization_id, workspace_id, business_id, provider, reference_type, external_reference, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id,
      organizationId,
      context.workspaceId ?? null,
      input.businessId ?? null,
      input.provider.trim(),
      input.referenceType.trim(),
      input.externalReference.trim(),
      input.status.trim(),
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.now,
      input.now,
    );
  }
}

interface BillingEntitlementSnapshotRow {
  readonly id: EntityId;
  readonly subscriptionId: EntityId;
  readonly entitlementKey: string;
  readonly valueType: BillingEntitlementSnapshotRecord["valueType"];
  readonly valueJson: string;
  readonly sourcePlanId: EntityId;
  readonly sourcePlanVersion: number;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
}

function parseEntitlementSnapshot(row: BillingEntitlementSnapshotRow): BillingEntitlementSnapshotRecord {
  let value: unknown;
  try {
    value = JSON.parse(row.valueJson);
  } catch {
    throw new DatabaseError("Stored Billing entitlement value is invalid");
  }
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    entitlementKey: row.entitlementKey,
    valueType: row.valueType,
    value,
    sourcePlanId: row.sourcePlanId,
    sourcePlanVersion: row.sourcePlanVersion,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  };
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new DatabaseError("Billing currency must be a 3-letter ISO currency code");
  return normalized;
}
