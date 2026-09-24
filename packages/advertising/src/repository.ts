import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type AdvertisingCampaignStatus = "draft" | "reviewing" | "active" | "paused" | "completed" | "rejected";
export type AdvertisingAdStatus = "draft" | "reviewing" | "approved" | "active" | "paused" | "expired" | "rejected";

export interface AdvertisingAccountRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly businessId: EntityId;
  readonly currency: string;
  readonly status: "active" | "suspended" | "closed";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdvertisingCampaignRecord {
  readonly id: EntityId;
  readonly advertisingAccountId: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly name: string;
  readonly objective: string;
  readonly status: AdvertisingCampaignStatus;
  readonly currentVersionId: EntityId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdvertisingCampaignVersionRecord {
  readonly id: EntityId;
  readonly campaignId: EntityId;
  readonly version: number;
  readonly targetingRules: Readonly<Record<string, unknown>>;
  readonly placementRules: Readonly<Record<string, unknown>>;
  readonly pacingPolicy: Readonly<Record<string, unknown>>;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: "draft" | "active" | "retired";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdvertisingAdRecord {
  readonly id: EntityId;
  readonly campaignVersionId: EntityId;
  readonly subjectType: string;
  readonly subjectId: EntityId;
  readonly creativeReference: string;
  readonly moderationStatus: string;
  readonly status: AdvertisingAdStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdvertisingBudgetRecord {
  readonly id: EntityId;
  readonly campaignId: EntityId;
  readonly totalLimitMinor: number | null;
  readonly dailyLimitMinor: number | null;
  readonly currency: string;
  readonly status: "active" | "paused" | "exhausted";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DeliveryDecisionRecord {
  readonly id: EntityId;
  readonly adId: EntityId;
  readonly placementId: EntityId;
  readonly decision: "served" | "rejected";
  readonly reason: string | null;
  readonly policyVersion: string;
  readonly decidedAt: string;
  readonly deduplicationKey: string;
  readonly createdAt: string;
}

export interface AdvertisingReport {
  readonly campaign: AdvertisingCampaignRecord;
  readonly impressions: number;
  readonly clicks: number;
  readonly delivered: number;
  readonly rejected: number;
}

export class AdvertisingRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createAccount(context: RequestContext, input: {
    readonly id: EntityId;
    readonly businessId: EntityId;
    readonly currency: string;
    readonly now: string;
  }): Promise<AdvertisingAccountRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    await this.database.run(
      "INSERT INTO advertising_accounts (id, organization_id, workspace_id, business_id, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
      input.id, organizationId, workspaceId, input.businessId, input.currency.trim().toUpperCase(), input.now, input.now,
    );
    return this.getAccount(context, input.id);
  }

  async getAccount(context: RequestContext, id: EntityId): Promise<AdvertisingAccountRecord> {
    const row = await this.database.first<AdvertisingAccountRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, currency, status, created_at AS createdAt, updated_at AS updatedAt FROM advertising_accounts WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Advertising account not found");
    return row;
  }

  async createCampaign(context: RequestContext, input: {
    readonly id: EntityId;
    readonly advertisingAccountId: EntityId;
    readonly name: string;
    readonly objective: string;
    readonly now: string;
  }): Promise<AdvertisingCampaignRecord> {
    const account = await this.getAccount(context, input.advertisingAccountId);
    if (!input.name.trim() || !input.objective.trim()) throw new DatabaseError("Advertising campaign name/objective are required");
    await this.database.run(
      "INSERT INTO advertising_campaigns (id, advertising_account_id, organization_id, workspace_id, name, objective, status, current_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?)",
      input.id, account.id, account.organizationId, account.workspaceId, input.name.trim(), input.objective.trim(), input.now, input.now,
    );
    return this.getCampaign(context, input.id);
  }

  async getCampaign(context: RequestContext, id: EntityId): Promise<AdvertisingCampaignRecord> {
    const row = await this.database.first<AdvertisingCampaignRecord>(
      "SELECT id, advertising_account_id AS advertisingAccountId, organization_id AS organizationId, workspace_id AS workspaceId, name, objective, status, current_version_id AS currentVersionId, created_at AS createdAt, updated_at AS updatedAt FROM advertising_campaigns WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Advertising campaign not found");
    return row;
  }

  async createCampaignVersion(context: RequestContext, input: {
    readonly id: EntityId;
    readonly campaignId: EntityId;
    readonly version: number;
    readonly targetingRules: Readonly<Record<string, unknown>>;
    readonly placementRules: Readonly<Record<string, unknown>>;
    readonly pacingPolicy: Readonly<Record<string, unknown>>;
    readonly effectiveFrom: string;
    readonly effectiveTo?: string;
    readonly now: string;
  }): Promise<AdvertisingCampaignVersionRecord> {
    await this.getCampaign(context, input.campaignId);
    await this.database.run(
      "INSERT INTO advertising_campaign_versions (id, campaign_id, version, targeting_rules_json, placement_rules_json, pacing_policy_json, effective_from, effective_to, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
      input.id, input.campaignId, input.version, JSON.stringify(input.targetingRules), JSON.stringify(input.placementRules),
      JSON.stringify(input.pacingPolicy), input.effectiveFrom, input.effectiveTo ?? null, input.now, input.now,
    );
    return this.getCampaignVersion(context, input.id);
  }

  async getCampaignVersion(context: RequestContext, id: EntityId): Promise<AdvertisingCampaignVersionRecord> {
    const row = await this.database.first<AdvertisingCampaignVersionRow>(
      "SELECT cv.id, cv.campaign_id AS campaignId, cv.version, cv.targeting_rules_json AS targetingRulesJson, cv.placement_rules_json AS placementRulesJson, cv.pacing_policy_json AS pacingPolicyJson, cv.effective_from AS effectiveFrom, cv.effective_to AS effectiveTo, cv.status, cv.created_at AS createdAt, cv.updated_at AS updatedAt FROM advertising_campaign_versions cv INNER JOIN advertising_campaigns c ON c.id=cv.campaign_id WHERE cv.id=? AND c.organization_id=? AND c.workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Advertising campaign version not found");
    return {
      id: row.id,
      campaignId: row.campaignId,
      version: row.version,
      targetingRules: parseJson(row.targetingRulesJson),
      placementRules: parseJson(row.placementRulesJson),
      pacingPolicy: parseJson(row.pacingPolicyJson),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async activateCampaign(context: RequestContext, campaignId: EntityId, versionId: EntityId, now: string): Promise<AdvertisingCampaignRecord> {
    const campaign = await this.getCampaign(context, campaignId);
    const version = await this.getCampaignVersion(context, versionId);
    if (version.campaignId !== campaign.id) throw new DatabaseError("Advertising version does not belong to campaign");
    await this.database.transaction([
      { sql: "UPDATE advertising_campaign_versions SET status='retired', updated_at=? WHERE campaign_id=? AND status='active' AND id<>?", params: [now, campaignId, versionId] },
      { sql: "UPDATE advertising_campaign_versions SET status='active', updated_at=? WHERE id=? AND campaign_id=?", params: [now, versionId, campaignId] },
      { sql: "UPDATE advertising_campaigns SET status='active', current_version_id=?, updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?", params: [versionId, now, campaignId, campaign.organizationId, campaign.workspaceId] },
    ]);
    return this.getCampaign(context, campaignId);
  }

  async createAd(context: RequestContext, input: {
    readonly id: EntityId;
    readonly campaignVersionId: EntityId;
    readonly subjectType: string;
    readonly subjectId: EntityId;
    readonly creativeReference: string;
    readonly moderationStatus: string;
    readonly now: string;
  }): Promise<AdvertisingAdRecord> {
    await this.getCampaignVersion(context, input.campaignVersionId);
    await this.database.run(
      "INSERT INTO advertising_ads (id, campaign_version_id, subject_type, subject_id, creative_reference, moderation_status, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
      input.id, input.campaignVersionId, input.subjectType.trim(), input.subjectId, input.creativeReference.trim(), input.moderationStatus.trim(), input.now, input.now,
    );
    return this.getAd(context, input.id);
  }

  async getAd(context: RequestContext, id: EntityId): Promise<AdvertisingAdRecord> {
    const row = await this.database.first<AdvertisingAdRecord>(
      "SELECT a.id, a.campaign_version_id AS campaignVersionId, a.subject_type AS subjectType, a.subject_id AS subjectId, a.creative_reference AS creativeReference, a.moderation_status AS moderationStatus, a.status, a.created_at AS createdAt, a.updated_at AS updatedAt FROM advertising_ads a INNER JOIN advertising_campaign_versions cv ON cv.id=a.campaign_version_id INNER JOIN advertising_campaigns c ON c.id=cv.campaign_id WHERE a.id=? AND c.organization_id=? AND c.workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Advertising ad not found");
    return row;
  }

  async createBudget(context: RequestContext, input: {
    readonly id: EntityId;
    readonly campaignId: EntityId;
    readonly totalLimitMinor?: number;
    readonly dailyLimitMinor?: number;
    readonly currency: string;
    readonly now: string;
  }): Promise<AdvertisingBudgetRecord> {
    await this.getCampaign(context, input.campaignId);
    await this.database.run(
      "INSERT INTO advertising_budgets (id, campaign_id, total_limit_minor, daily_limit_minor, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
      input.id, input.campaignId, input.totalLimitMinor ?? null, input.dailyLimitMinor ?? null, input.currency.trim().toUpperCase(), input.now, input.now,
    );
    return this.getBudget(context, input.id);
  }

  async getBudget(context: RequestContext, id: EntityId): Promise<AdvertisingBudgetRecord> {
    const row = await this.database.first<AdvertisingBudgetRecord>(
      "SELECT id, campaign_id AS campaignId, total_limit_minor AS totalLimitMinor, daily_limit_minor AS dailyLimitMinor, currency, status, created_at AS createdAt, updated_at AS updatedAt FROM advertising_budgets WHERE id=? AND EXISTS (SELECT 1 FROM advertising_campaigns c WHERE c.id=advertising_budgets.campaign_id AND c.organization_id=? AND c.workspace_id=?) LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Advertising budget not found");
    return row;
  }

  async decideDelivery(context: RequestContext, input: {
    readonly id: EntityId;
    readonly adId: EntityId;
    readonly placementId: EntityId;
    readonly decision: "served" | "rejected";
    readonly reason?: string;
    readonly policyVersion: string;
    readonly deduplicationKey: string;
    readonly now: string;
  }): Promise<DeliveryDecisionRecord> {
    await this.getAd(context, input.adId);
    const existing = await this.database.first<DeliveryDecisionRecord>(
      "SELECT id, ad_id AS adId, placement_id AS placementId, decision, reason, policy_version AS policyVersion, decided_at AS decidedAt, deduplication_key AS deduplicationKey, created_at AS createdAt FROM advertising_delivery_decisions WHERE organization_id=? AND workspace_id=? AND deduplication_key=? LIMIT 1",
      this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }), input.deduplicationKey.trim(),
    );
    if (existing) return existing;
    await this.database.run(
      "INSERT INTO advertising_delivery_decisions (id, organization_id, workspace_id, ad_id, placement_id, decision, reason, policy_version, decided_at, deduplication_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }), input.adId, input.placementId,
      input.decision, input.reason?.trim() || null, input.policyVersion.trim(), input.now, input.deduplicationKey.trim(), input.now,
    );
    return this.database.first<DeliveryDecisionRecord>(
      "SELECT id, ad_id AS adId, placement_id AS placementId, decision, reason, policy_version AS policyVersion, decided_at AS decidedAt, deduplication_key AS deduplicationKey, created_at AS createdAt FROM advertising_delivery_decisions WHERE id=? LIMIT 1",
      input.id,
    ).then((row) => {
      if (!row) throw new DatabaseError("Advertising delivery decision not found after creation");
      return row;
    });
  }

  async recordImpression(context: RequestContext, input: { readonly id: EntityId; readonly deliveryDecisionId: EntityId; readonly contextReference?: string; readonly deduplicationKey: string; readonly now: string }) {
    const decision = await this.database.first<{ adId: EntityId; organizationId: EntityId; workspaceId: EntityId }>(
      "SELECT ad_id AS adId, organization_id AS organizationId, workspace_id AS workspaceId FROM advertising_delivery_decisions WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      input.deliveryDecisionId, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!decision) throw new DatabaseError("Advertising delivery decision not found");
    const existing = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM advertising_impressions WHERE organization_id=? AND workspace_id=? AND deduplication_key=? LIMIT 1",
      decision.organizationId, decision.workspaceId, input.deduplicationKey.trim(),
    );
    if (existing) return { id: existing.id, deliveryDecisionId: input.deliveryDecisionId };
    await this.database.run(
      "INSERT INTO advertising_impressions (id, organization_id, workspace_id, delivery_decision_id, context_reference, deduplication_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      input.id, decision.organizationId, decision.workspaceId, input.deliveryDecisionId, input.contextReference?.trim() || null, input.deduplicationKey.trim(), input.now,
    );
    return { id: input.id, deliveryDecisionId: input.deliveryDecisionId };
  }

  async recordClick(context: RequestContext, input: { readonly id: EntityId; readonly impressionId: EntityId; readonly deduplicationKey: string; readonly now: string }) {
    const impression = await this.database.first<{ id: EntityId; organizationId: EntityId; workspaceId: EntityId }>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId FROM advertising_impressions WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      input.impressionId, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!impression) throw new DatabaseError("Advertising impression not found");
    const existing = await this.database.first<{ id: EntityId }>(
      "SELECT id FROM advertising_clicks WHERE organization_id=? AND workspace_id=? AND deduplication_key=? LIMIT 1",
      impression.organizationId, impression.workspaceId, input.deduplicationKey.trim(),
    );
    if (existing) return { id: existing.id, impressionId: input.impressionId };
    await this.database.run(
      "INSERT INTO advertising_clicks (id, organization_id, workspace_id, impression_id, deduplication_key, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      input.id, impression.organizationId, impression.workspaceId, input.impressionId, input.deduplicationKey.trim(), input.now,
    );
    return { id: input.id, impressionId: input.impressionId };
  }

  async report(context: RequestContext, campaignId: EntityId): Promise<AdvertisingReport> {
    const campaign = await this.getCampaign(context, campaignId);
    const delivered = await this.database.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM advertising_delivery_decisions d INNER JOIN advertising_ads a ON a.id=d.ad_id INNER JOIN advertising_campaign_versions cv ON cv.id=a.campaign_version_id WHERE cv.campaign_id=? AND d.decision='served' AND d.organization_id=? AND d.workspace_id=?",
      campaignId, campaign.organizationId, campaign.workspaceId,
    );
    const rejected = await this.database.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM advertising_delivery_decisions d INNER JOIN advertising_ads a ON a.id=d.ad_id INNER JOIN advertising_campaign_versions cv ON cv.id=a.campaign_version_id WHERE cv.campaign_id=? AND d.decision='rejected' AND d.organization_id=? AND d.workspace_id=?",
      campaignId, campaign.organizationId, campaign.workspaceId,
    );
    const impressions = await this.database.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM advertising_impressions i INNER JOIN advertising_delivery_decisions d ON d.id=i.delivery_decision_id INNER JOIN advertising_ads a ON a.id=d.ad_id INNER JOIN advertising_campaign_versions cv ON cv.id=a.campaign_version_id WHERE cv.campaign_id=? AND i.organization_id=? AND i.workspace_id=?",
      campaignId, campaign.organizationId, campaign.workspaceId,
    );
    const clicks = await this.database.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM advertising_clicks cl INNER JOIN advertising_impressions i ON i.id=cl.impression_id INNER JOIN advertising_delivery_decisions d ON d.id=i.delivery_decision_id INNER JOIN advertising_ads a ON a.id=d.ad_id INNER JOIN advertising_campaign_versions cv ON cv.id=a.campaign_version_id WHERE cv.campaign_id=? AND cl.organization_id=? AND cl.workspace_id=?",
      campaignId, campaign.organizationId, campaign.workspaceId,
    );
    return {
      campaign,
      delivered: Number(delivered?.count ?? 0),
      rejected: Number(rejected?.count ?? 0),
      impressions: Number(impressions?.count ?? 0),
      clicks: Number(clicks?.count ?? 0),
    };
  }
}

interface AdvertisingCampaignVersionRow {
  readonly id: EntityId; readonly campaignId: EntityId; readonly version: number;
  readonly targetingRulesJson: string; readonly placementRulesJson: string; readonly pacingPolicyJson: string;
  readonly effectiveFrom: string; readonly effectiveTo: string | null;
  readonly status: "draft" | "active" | "retired"; readonly createdAt: string; readonly updatedAt: string;
}
function parseJson(value: string): Readonly<Record<string, unknown>> {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new DatabaseError("Stored advertising JSON is invalid");
  return parsed as Readonly<Record<string, unknown>>;
}
