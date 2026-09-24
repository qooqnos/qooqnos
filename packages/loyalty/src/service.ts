import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { LoyaltyRepository } from "./repository";

export interface LoyaltyServiceOptions {
  readonly repository: LoyaltyRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class LoyaltyService {
  constructor(private readonly options: LoyaltyServiceOptions) {}

  async createProgram(context: RequestContext, input: { readonly name: string; readonly businessId?: EntityId }) {
    await this.authorize(context, "loyalty.program.manage", true);
    return this.options.repository.createProgram(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createProgramVersion(context: RequestContext, input: {
    readonly programId: EntityId;
    readonly version: number;
    readonly rules: Readonly<Record<string, unknown>>;
  }) {
    await this.authorize(context, "loyalty.program.manage", true);
    return this.options.repository.createProgramVersion(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async activateProgram(context: RequestContext, programId: EntityId, versionId: EntityId) {
    await this.authorize(context, "loyalty.program.manage", true);
    return this.options.repository.activateProgram(context, programId, versionId, this.options.now());
  }

  async enrollMember(context: RequestContext, programId: EntityId, customerId: EntityId) {
    await this.authorize(context, "loyalty.membership.manage", true);
    return this.options.repository.enroll(context, {
      id: this.options.id(),
      programId,
      customerId,
      now: this.options.now(),
    });
  }

  async getMembership(context: RequestContext, id: EntityId) {
    await this.authorize(context, "loyalty.membership.read", false);
    return {
      membership: await this.options.repository.getMembership(context, id),
      balance: await this.options.repository.balance(context, id),
    };
  }

  async postLedger(context: RequestContext, input: {
    readonly membershipId: EntityId;
    readonly entryType: "earn" | "adjustment" | "expire" | "reverse";
    readonly pointsDelta: number;
    readonly referenceType?: string;
    readonly referenceId?: string;
    readonly idempotencyKey: string;
    readonly provenance?: Readonly<Record<string, unknown>>;
  }) {
    await this.authorize(context, "loyalty.adjust", true);
    if (!Number.isSafeInteger(input.pointsDelta) || input.pointsDelta === 0) throw new Error("pointsDelta must be a non-zero integer");
    return this.options.repository.postLedger(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async listLedger(context: RequestContext, membershipId: EntityId) {
    await this.authorize(context, "loyalty.ledger.read", false);
    return this.options.repository.listLedger(context, membershipId);
  }

  async createReward(context: RequestContext, input: {
    readonly programId: EntityId;
    readonly name: string;
    readonly pointsCost: number;
    readonly rewardReference: string;
  }) {
    await this.authorize(context, "loyalty.reward.manage", true);
    return this.options.repository.createReward(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async listRewards(context: RequestContext, programId: EntityId) {
    await this.authorize(context, "loyalty.reward.read", false);
    return this.options.repository.listRewards(context, programId);
  }

  async redeemReward(context: RequestContext, input: {
    readonly rewardId: EntityId;
    readonly membershipId: EntityId;
    readonly benefitReference: string;
    readonly idempotencyKey: string;
  }) {
    await this.authorize(context, "loyalty.reward.redeem", false);
    return this.options.repository.redeemReward(context, {
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

export const LOYALTY_PERMISSIONS = [
  "loyalty.program.read",
  "loyalty.program.manage",
  "loyalty.membership.read",
  "loyalty.membership.manage",
  "loyalty.ledger.read",
  "loyalty.adjust",
  "loyalty.reward.read",
  "loyalty.reward.manage",
  "loyalty.reward.redeem",
  "loyalty.tier.read",
  "loyalty.tier.manage",
  "loyalty.referral.read",
  "loyalty.referral.manage",
  "loyalty.policy.manage",
] as const;
