import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { PromotionRepository, type PromotionRecord } from "./repository";

export interface PromotionServiceOptions {
  readonly repository: PromotionRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export interface PromotionEvaluateInput {
  readonly promotionId: EntityId;
  readonly subjectId: EntityId;
  readonly idempotencyKey: string;
  readonly now?: string;
  readonly channel?: string;
  readonly amountMinor?: number;
  readonly businessId?: EntityId;
}

export class PromotionService {
  constructor(private readonly options: PromotionServiceOptions) {}

  async create(context: RequestContext, input: {
    readonly name: string;
    readonly promotionType: string;
    readonly scope: PromotionRecord["scope"];
    readonly businessId?: EntityId;
  }) {
    await this.authorize(context, "promotion.create", true);
    return this.options.repository.createPromotion(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async get(context: RequestContext, id: EntityId) {
    await this.authorize(context, "promotion.read", false);
    return this.options.repository.get(context, id);
  }

  async createVersion(context: RequestContext, input: {
    readonly promotionId: EntityId;
    readonly version: number;
    readonly benefit: Readonly<Record<string, unknown>>;
    readonly eligibilityRules: Readonly<Record<string, unknown>>;
    readonly stackPolicy: Readonly<Record<string, unknown>>;
    readonly effectiveFrom: string;
    readonly effectiveTo?: string;
  }) {
    await this.authorize(context, "promotion.version.manage", true);
    return this.options.repository.createVersion(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async activate(context: RequestContext, promotionId: EntityId, versionId: EntityId) {
    await this.authorize(context, "promotion.activate", true);
    return this.options.repository.activate(context, promotionId, versionId, this.options.now());
  }

  async evaluate(context: RequestContext, input: PromotionEvaluateInput) {
    await this.authorize(context, "promotion.evaluate", false);
    const promotion = await this.options.repository.getRequired(context, input.promotionId);
    const version = await this.options.repository.getActiveVersion(context, promotion.id);
    if (!version) throw new Error("Promotion has no active version");
    const now = input.now ?? this.options.now();
    const reasons: string[] = [];
    let eligible = promotion.status === "active";

    if (Date.parse(now) < Date.parse(version.effectiveFrom)) {
      eligible = false;
      reasons.push("not_started");
    }
    if (version.effectiveTo && Date.parse(now) >= Date.parse(version.effectiveTo)) {
      eligible = false;
      reasons.push("expired");
    }

    const rules = version.eligibilityRules;
    const minimumAmount = numberValue(rules.minimumAmountMinor);
    if (minimumAmount !== undefined && (input.amountMinor ?? 0) < minimumAmount) {
      eligible = false;
      reasons.push("minimum_amount");
    }
    const channels = stringArray(rules.channels);
    if (channels.length && (!input.channel || !channels.includes(input.channel))) {
      eligible = false;
      reasons.push("channel_not_allowed");
    }
    const allowedCustomers = stringArray(rules.customerIds);
    if (allowedCustomers.length && !allowedCustomers.includes(input.subjectId)) {
      eligible = false;
      reasons.push("customer_not_allowed");
    }
    const allowedBusiness = stringArray(rules.businessIds);
    if (allowedBusiness.length && (!input.businessId || !allowedBusiness.includes(input.businessId))) {
      eligible = false;
      reasons.push("business_not_allowed");
    }

    const perCustomerLimit = numberValue(rules.perCustomerLimit);
    if (eligible && perCustomerLimit !== undefined) {
      const redemptionCount = await this.options.repository.countCustomerRedemptions(context, promotion.id, input.subjectId);
      if (redemptionCount >= perCustomerLimit) {
        eligible = false;
        reasons.push("customer_limit");
      }
    }

    return this.options.repository.qualify(context, {
      id: this.options.id(),
      promotionId: promotion.id,
      promotionVersionId: version.id,
      subjectId: input.subjectId,
      decision: eligible ? "qualified" : "rejected",
      reasons: eligible ? ["eligible"] : reasons,
      ...(eligible ? { benefit: version.benefit } : {}),
      idempotencyKey: input.idempotencyKey,
      now,
    });
  }

  async redeem(context: RequestContext, input: {
    readonly qualificationId: EntityId;
    readonly promotionId: EntityId;
    readonly promotionVersionId: EntityId;
    readonly subjectId: EntityId;
    readonly transactionType: string;
    readonly transactionId: EntityId;
    readonly benefitReference: string;
    readonly idempotencyKey: string;
  }) {
    await this.authorize(context, "promotion.redeem", false);
    return this.options.repository.redeem(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  private authorize(context: RequestContext, permission: string, workspace: boolean) {
    return this.options.authorization.assert({
      context,
      permission,
      requireAuthentication: true,
      requireWorkspace: workspace,
    });
  }
}

export const PROMOTION_PERMISSIONS = [
  "promotion.read",
  "promotion.create",
  "promotion.version.manage",
  "promotion.activate",
  "promotion.evaluate",
  "promotion.redeem",
] as const;

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
