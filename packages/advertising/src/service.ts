import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { AdvertisingRepository } from "./repository";

export interface AdvertisingServiceOptions {
  readonly repository: AdvertisingRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class AdvertisingService {
  constructor(private readonly options: AdvertisingServiceOptions) {}

  async createAccount(context: RequestContext, input: { readonly businessId: EntityId; readonly currency: string }) {
    await this.authorize(context, "advertising.create_account", true);
    return this.options.repository.createAccount(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createCampaign(context: RequestContext, input: {
    readonly advertisingAccountId: EntityId;
    readonly name: string;
    readonly objective: string;
  }) {
    await this.authorize(context, "advertising.campaign.manage", true);
    return this.options.repository.createCampaign(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createCampaignVersion(context: RequestContext, input: {
    readonly campaignId: EntityId;
    readonly version: number;
    readonly targetingRules: Readonly<Record<string, unknown>>;
    readonly placementRules: Readonly<Record<string, unknown>>;
    readonly pacingPolicy: Readonly<Record<string, unknown>>;
    readonly effectiveFrom: string;
    readonly effectiveTo?: string;
  }) {
    await this.authorize(context, "advertising.campaign.manage", true);
    return this.options.repository.createCampaignVersion(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async activateCampaign(context: RequestContext, campaignId: EntityId, versionId: EntityId) {
    await this.authorize(context, "advertising.campaign.activate", true);
    return this.options.repository.activateCampaign(context, campaignId, versionId, this.options.now());
  }

  async createAd(context: RequestContext, input: {
    readonly campaignVersionId: EntityId;
    readonly subjectType: string;
    readonly subjectId: EntityId;
    readonly creativeReference: string;
    readonly moderationStatus: string;
  }) {
    await this.authorize(context, "advertising.ad.manage", true);
    return this.options.repository.createAd(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async createBudget(context: RequestContext, input: {
    readonly campaignId: EntityId;
    readonly totalLimitMinor?: number;
    readonly dailyLimitMinor?: number;
    readonly currency: string;
  }) {
    await this.authorize(context, "advertising.budget.manage", true);
    return this.options.repository.createBudget(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async decideDelivery(context: RequestContext, input: {
    readonly adId: EntityId;
    readonly placementId: EntityId;
    readonly decision: "served" | "rejected";
    readonly reason?: string;
    readonly policyVersion: string;
    readonly deduplicationKey: string;
  }) {
    await this.authorize(context, "advertising.deliver", false);
    const ad = await this.options.repository.getAd(context, input.adId);
    if (input.decision === "served") {
      if (ad.status !== "active") {
        throw new Error("Only active ads can be served");
      }
      if (ad.moderationStatus !== "approved") {
        throw new Error("Ad moderation approval is required before delivery");
      }
    }
    return this.options.repository.decideDelivery(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async recordImpression(context: RequestContext, input: {
    readonly deliveryDecisionId: EntityId;
    readonly contextReference?: string;
    readonly deduplicationKey: string;
  }) {
    await this.authorize(context, "advertising.deliver", false);
    return this.options.repository.recordImpression(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async recordClick(context: RequestContext, input: {
    readonly impressionId: EntityId;
    readonly deduplicationKey: string;
  }) {
    await this.authorize(context, "advertising.deliver", false);
    return this.options.repository.recordClick(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async report(context: RequestContext, campaignId: EntityId) {
    await this.authorize(context, "advertising.report.read", false);
    return this.options.repository.report(context, campaignId);
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

export const ADVERTISING_PERMISSIONS = [
  "advertising.account.read",
  "advertising.create_account",
  "advertising.campaign.read",
  "advertising.campaign.manage",
  "advertising.campaign.activate",
  "advertising.ad.read",
  "advertising.ad.manage",
  "advertising.budget.manage",
  "advertising.report.read",
  "advertising.deliver",
] as const;
