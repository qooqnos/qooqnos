import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type PromotionStatus = "draft" | "scheduled" | "active" | "paused" | "expired" | "retired";
export type PromotionVersionStatus = "draft" | "scheduled" | "active" | "retired";
export type PromotionDecision = "qualified" | "rejected";

export interface PromotionRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly businessId: EntityId | null;
  readonly name: string;
  readonly promotionType: string;
  readonly scope: "platform" | "organization" | "workspace" | "business" | "location" | "campaign";
  readonly status: PromotionStatus;
  readonly currentVersionId: EntityId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PromotionVersionRecord {
  readonly id: EntityId;
  readonly promotionId: EntityId;
  readonly version: number;
  readonly benefit: Readonly<Record<string, unknown>>;
  readonly eligibilityRules: Readonly<Record<string, unknown>>;
  readonly stackPolicy: Readonly<Record<string, unknown>>;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: PromotionVersionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QualificationRecord {
  readonly id: EntityId;
  readonly promotionId: EntityId;
  readonly promotionVersionId: EntityId;
  readonly subjectId: EntityId;
  readonly decision: PromotionDecision;
  readonly reasons: readonly string[];
  readonly benefit: Readonly<Record<string, unknown>> | null;
  readonly idempotencyKey: string;
  readonly evaluatedAt: string;
  readonly createdAt: string;
}

export interface RedemptionRecord {
  readonly id: EntityId;
  readonly promotionId: EntityId;
  readonly promotionVersionId: EntityId;
  readonly qualificationId: EntityId;
  readonly subjectId: EntityId;
  readonly transactionType: string;
  readonly transactionId: EntityId;
  readonly benefitReference: string;
  readonly status: "redeemed" | "revoked";
  readonly idempotencyKey: string;
  readonly redeemedAt: string;
  readonly createdAt: string;
}

export class PromotionRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createPromotion(context: RequestContext, input: {
    readonly id: EntityId;
    readonly businessId?: EntityId;
    readonly name: string;
    readonly promotionType: string;
    readonly scope: PromotionRecord["scope"];
    readonly now: string;
  }): Promise<PromotionRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    if (!input.name.trim() || !input.promotionType.trim()) throw new DatabaseError("Promotion name/type are required");
    await this.database.run(
      "INSERT INTO promotions (id, organization_id, workspace_id, business_id, name, promotion_type, scope, status, current_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?)",
      input.id, organizationId, workspaceId, input.businessId ?? null, input.name.trim(), input.promotionType.trim(), input.scope, input.now, input.now,
    );
    return this.getRequired(context, input.id);
  }

  async get(context: RequestContext, id: EntityId): Promise<PromotionRecord | null> {
    return this.database.first<PromotionRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, business_id AS businessId, name, promotion_type AS promotionType, scope, status, current_version_id AS currentVersionId, created_at AS createdAt, updated_at AS updatedAt FROM promotions WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
  }

  async getRequired(context: RequestContext, id: EntityId): Promise<PromotionRecord> {
    const record = await this.get(context, id);
    if (!record) throw new DatabaseError("Promotion not found");
    return record;
  }

  async createVersion(context: RequestContext, input: {
    readonly id: EntityId;
    readonly promotionId: EntityId;
    readonly version: number;
    readonly benefit: Readonly<Record<string, unknown>>;
    readonly eligibilityRules: Readonly<Record<string, unknown>>;
    readonly stackPolicy: Readonly<Record<string, unknown>>;
    readonly effectiveFrom: string;
    readonly effectiveTo?: string;
    readonly now: string;
  }): Promise<PromotionVersionRecord> {
    await this.getRequired(context, input.promotionId);
    if (!Number.isSafeInteger(input.version) || input.version < 1) throw new DatabaseError("Promotion version must be positive");
    await this.database.run(
      "INSERT INTO promotion_versions (id, promotion_id, version, benefit_json, eligibility_rules_json, stack_policy_json, effective_from, effective_to, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
      input.id, input.promotionId, input.version, JSON.stringify(input.benefit), JSON.stringify(input.eligibilityRules),
      JSON.stringify(input.stackPolicy), input.effectiveFrom, input.effectiveTo ?? null, input.now, input.now,
    );
    return this.getVersion(context, input.id);
  }

  async getVersion(context: RequestContext, id: EntityId): Promise<PromotionVersionRecord> {
    const row = await this.database.first<PromotionVersionRow>(
      "SELECT pv.id, pv.promotion_id AS promotionId, pv.version, pv.benefit_json AS benefitJson, pv.eligibility_rules_json AS eligibilityRulesJson, pv.stack_policy_json AS stackPolicyJson, pv.effective_from AS effectiveFrom, pv.effective_to AS effectiveTo, pv.status, pv.created_at AS createdAt, pv.updated_at AS updatedAt FROM promotion_versions pv INNER JOIN promotions p ON p.id=pv.promotion_id WHERE pv.id=? AND p.organization_id=? AND p.workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Promotion version not found");
    return hydrateVersion(row);
  }

  async activate(context: RequestContext, promotionId: EntityId, versionId: EntityId, now: string): Promise<PromotionRecord> {
    const promotion = await this.getRequired(context, promotionId);
    const version = await this.getVersion(context, versionId);
    if (version.promotionId !== promotion.id) throw new DatabaseError("Promotion version does not belong to promotion");
    await this.database.transaction([
      {
        sql: "UPDATE promotion_versions SET status='retired', updated_at=? WHERE promotion_id=? AND status='active' AND id<>?",
        params: [now, promotionId, versionId],
      },
      {
        sql: "UPDATE promotion_versions SET status='active', updated_at=? WHERE id=? AND promotion_id=?",
        params: [now, versionId, promotionId],
      },
      {
        sql: "UPDATE promotions SET status='active', current_version_id=?, updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
        params: [versionId, now, promotionId, promotion.organizationId, promotion.workspaceId],
      },
    ]);
    return this.getRequired(context, promotionId);
  }

  async getActiveVersion(context: RequestContext, promotionId: EntityId): Promise<PromotionVersionRecord | null> {
    const row = await this.database.first<PromotionVersionRow>(
      "SELECT pv.id, pv.promotion_id AS promotionId, pv.version, pv.benefit_json AS benefitJson, pv.eligibility_rules_json AS eligibilityRulesJson, pv.stack_policy_json AS stackPolicyJson, pv.effective_from AS effectiveFrom, pv.effective_to AS effectiveTo, pv.status, pv.created_at AS createdAt, pv.updated_at AS updatedAt FROM promotion_versions pv INNER JOIN promotions p ON p.id=pv.promotion_id WHERE pv.promotion_id=? AND pv.status='active' AND p.organization_id=? AND p.workspace_id=? LIMIT 1",
      promotionId, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    return row ? hydrateVersion(row) : null;
  }

  async countCustomerRedemptions(context: RequestContext, promotionId: EntityId, subjectId: EntityId): Promise<number> {
    const row = await this.database.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM promotion_redemptions WHERE promotion_id=? AND subject_id=? AND status='redeemed' AND organization_id=? AND workspace_id=?",
      promotionId, subjectId, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    return row?.count ?? 0;
  }

  async qualify(context: RequestContext, input: {
    readonly id: EntityId;
    readonly promotionId: EntityId;
    readonly promotionVersionId: EntityId;
    readonly subjectId: EntityId;
    readonly decision: PromotionDecision;
    readonly reasons: readonly string[];
    readonly benefit?: Readonly<Record<string, unknown>>;
    readonly idempotencyKey: string;
    readonly now: string;
  }): Promise<QualificationRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const existing = await this.database.first<QualificationRow>(
      "SELECT id,promotion_id AS promotionId,promotion_version_id AS promotionVersionId,subject_id AS subjectId,decision,reasons_json AS reasonsJson,benefit_json AS benefitJson,idempotency_key AS idempotencyKey,evaluated_at AS evaluatedAt,created_at AS createdAt FROM promotion_qualifications WHERE organization_id=? AND workspace_id=? AND idempotency_key=? LIMIT 1",
      organizationId, workspaceId, input.idempotencyKey.trim(),
    );
    if (existing) return hydrateQualification(existing);
    await this.database.run(
      "INSERT INTO promotion_qualifications (id, organization_id, workspace_id, promotion_id, promotion_version_id, subject_id, decision, reasons_json, benefit_json, idempotency_key, evaluated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, organizationId, workspaceId, input.promotionId, input.promotionVersionId, input.subjectId, input.decision,
      JSON.stringify(input.reasons), input.benefit ? JSON.stringify(input.benefit) : null, input.idempotencyKey.trim(), input.now, input.now,
    );
    return this.database.first<QualificationRow>(
      "SELECT id,promotion_id AS promotionId,promotion_version_id AS promotionVersionId,subject_id AS subjectId,decision,reasons_json AS reasonsJson,benefit_json AS benefitJson,idempotency_key AS idempotencyKey,evaluated_at AS evaluatedAt,created_at AS createdAt FROM promotion_qualifications WHERE id=? LIMIT 1",
      input.id,
    ).then((row) => {
      if (!row) throw new DatabaseError("Promotion qualification not found after creation");
      return hydrateQualification(row);
    });
  }

  async redeem(context: RequestContext, input: {
    readonly id: EntityId;
    readonly qualificationId: EntityId;
    readonly promotionId: EntityId;
    readonly promotionVersionId: EntityId;
    readonly subjectId: EntityId;
    readonly transactionType: string;
    readonly transactionId: EntityId;
    readonly benefitReference: string;
    readonly idempotencyKey: string;
    readonly now: string;
  }): Promise<RedemptionRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const existing = await this.database.first<RedemptionRow>(
      "SELECT id,promotion_id AS promotionId,promotion_version_id AS promotionVersionId,qualification_id AS qualificationId,subject_id AS subjectId,transaction_type AS transactionType,transaction_id AS transactionId,benefit_reference AS benefitReference,status,idempotency_key AS idempotencyKey,redeemed_at AS redeemedAt,created_at AS createdAt FROM promotion_redemptions WHERE organization_id=? AND workspace_id=? AND idempotency_key=? LIMIT 1",
      organizationId, workspaceId, input.idempotencyKey.trim(),
    );
    if (existing) return hydrateRedemption(existing);
    const qualification = await this.database.first<QualificationRow>(
      "SELECT id,promotion_id AS promotionId,promotion_version_id AS promotionVersionId,subject_id AS subjectId,decision,reasons_json AS reasonsJson,benefit_json AS benefitJson,idempotency_key AS idempotencyKey,evaluated_at AS evaluatedAt,created_at AS createdAt FROM promotion_qualifications WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      input.qualificationId, organizationId, workspaceId,
    );
    if (!qualification || qualification.decision !== "qualified") throw new DatabaseError("Only qualified promotions can be redeemed");
    await this.database.run(
      "INSERT INTO promotion_redemptions (id, organization_id, workspace_id, promotion_id, promotion_version_id, qualification_id, subject_id, transaction_type, transaction_id, benefit_reference, status, idempotency_key, redeemed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'redeemed', ?, ?, ?)",
      input.id, organizationId, workspaceId, input.promotionId, input.promotionVersionId, input.qualificationId, input.subjectId,
      input.transactionType.trim(), input.transactionId, input.benefitReference.trim(), input.idempotencyKey.trim(), input.now, input.now,
    );
    const row = await this.database.first<RedemptionRow>(
      "SELECT id,promotion_id AS promotionId,promotion_version_id AS promotionVersionId,qualification_id AS qualificationId,subject_id AS subjectId,transaction_type AS transactionType,transaction_id AS transactionId,benefit_reference AS benefitReference,status,idempotency_key AS idempotencyKey,redeemed_at AS redeemedAt,created_at AS createdAt FROM promotion_redemptions WHERE id=? LIMIT 1",
      input.id,
    );
    if (!row) throw new DatabaseError("Promotion redemption not found after creation");
    return hydrateRedemption(row);
  }
}

interface PromotionVersionRow {
  readonly id: EntityId;
  readonly promotionId: EntityId;
  readonly version: number;
  readonly benefitJson: string;
  readonly eligibilityRulesJson: string;
  readonly stackPolicyJson: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: PromotionVersionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface QualificationRow {
  readonly id: EntityId;
  readonly promotionId: EntityId;
  readonly promotionVersionId: EntityId;
  readonly subjectId: EntityId;
  readonly decision: PromotionDecision;
  readonly reasonsJson: string;
  readonly benefitJson: string | null;
  readonly idempotencyKey: string;
  readonly evaluatedAt: string;
  readonly createdAt: string;
}

interface RedemptionRow {
  readonly id: EntityId;
  readonly promotionId: EntityId;
  readonly promotionVersionId: EntityId;
  readonly qualificationId: EntityId;
  readonly subjectId: EntityId;
  readonly transactionType: string;
  readonly transactionId: EntityId;
  readonly benefitReference: string;
  readonly status: "redeemed" | "revoked";
  readonly idempotencyKey: string;
  readonly redeemedAt: string;
  readonly createdAt: string;
}

function hydrateVersion(row: PromotionVersionRow): PromotionVersionRecord {
  return {
    id: row.id,
    promotionId: row.promotionId,
    version: row.version,
    benefit: parseJson(row.benefitJson),
    eligibilityRules: parseJson(row.eligibilityRulesJson),
    stackPolicy: parseJson(row.stackPolicyJson),
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hydrateQualification(row: QualificationRow): QualificationRecord {
  return {
    ...row,
    reasons: parseJsonArray(row.reasonsJson),
    benefit: row.benefitJson ? parseJson(row.benefitJson) : null,
  };
}

function hydrateRedemption(row: RedemptionRow): RedemptionRecord { return row; }
function parseJson(value: string): Readonly<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
    return parsed as Readonly<Record<string, unknown>>;
  } catch { throw new DatabaseError("Stored promotion JSON is invalid"); }
}
function parseJsonArray(value: string): readonly string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) throw new Error("invalid array");
    return parsed as readonly string[];
  } catch { throw new DatabaseError("Stored promotion reasons are invalid"); }
}
