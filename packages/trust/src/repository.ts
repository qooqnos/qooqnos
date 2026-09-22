import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type ReviewTargetType = "business" | "offering" | "product";

export interface ReviewRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId | null;
  readonly customerId: EntityId;
  readonly ratingValue: number;
  readonly content: string | null;
  readonly moderationState: string;
  readonly businessId: EntityId | null;
  readonly offeringId: EntityId | null;
  readonly productId: EntityId | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class TrustReviewRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async createReview(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly customerId: EntityId;
      readonly ratingValue: number;
      readonly content?: string;
      readonly moderationState?: string;
      readonly businessId?: EntityId;
      readonly offeringId?: EntityId;
      readonly productId?: EntityId;
      readonly now: string;
    },
  ): Promise<ReviewRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const targetCount = (input.businessId ? 1 : 0) + (input.offeringId ? 1 : 0) + (input.productId ? 1 : 0);
    if (targetCount !== 1) throw new DatabaseError("Review must target exactly one canonical typed target");
    if (input.ratingValue < 1 || input.ratingValue > 5) throw new DatabaseError("Review rating must be between 1 and 5");

    await this.database.run(
      "INSERT INTO reviews (id, organization_id, workspace_id, customer_id, rating_value, content, moderation_state, business_id, offering_id, product_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, organizationId, context.workspaceId ?? null, input.customerId, input.ratingValue,
      input.content ?? null, input.moderationState ?? "pending", input.businessId ?? null, input.offeringId ?? null, input.productId ?? null, input.now, input.now,
    );

    return this.getReview(context, input.id);
  }

  async reportReview(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly reviewId: EntityId;
      readonly reporterReference: string;
      readonly reasonCode: string;
      readonly details?: string;
      readonly now: string;
    },
  ) {
    const review = await this.getReview(context, input.reviewId);
    if (!input.reporterReference.trim() || !input.reasonCode.trim()) {
      throw new DatabaseError("Review report reporter and reason are required");
    }
    await this.database.run(
      "INSERT INTO review_reports (id, review_id, reporter_reference, reason_code, details, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)",
      input.id, review.id, input.reporterReference.trim(), input.reasonCode.trim(),
      input.details?.trim() || null, input.now, input.now,
    );
    await this.database.run(
      "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at) VALUES (?, 'review.reported', 1, 'Review', ?, ?, ?, ?, 'pending', 0, ?, ?)",
      input.id + ":reported", review.id, review.organizationId, review.workspaceId,
      JSON.stringify({ reviewId: review.id, reportId: input.id, reasonCode: input.reasonCode.trim() }),
      input.now, input.now,
    );
    return this.database.first(
      "SELECT id, review_id AS reviewId, reporter_reference AS reporterReference, reason_code AS reasonCode, details, status, created_at AS createdAt, updated_at AS updatedAt FROM review_reports WHERE id = ? LIMIT 1",
      input.id,
    );
  }

  async createResponse(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly reviewId: EntityId;
      readonly businessId: EntityId;
      readonly actorReference: string;
      readonly content: string;
      readonly policyVersion: string;
      readonly now: string;
    },
  ) {
    const review = await this.getReview(context, input.reviewId);
    if (!input.content.trim()) throw new DatabaseError("Review response content is required");
    await this.database.run(
      "INSERT INTO review_responses (id, review_id, business_id, actor_reference, content, status, moderation_state, policy_version, content_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'submitted', 'pending', ?, 1, ?, ?)",
      input.id, review.id, input.businessId, input.actorReference.trim(), input.content.trim(), input.policyVersion.trim(), input.now, input.now,
    );
    return this.database.first(
      "SELECT id, review_id AS reviewId, business_id AS businessId, actor_reference AS actorReference, content, status, moderation_state AS moderationState, policy_version AS policyVersion, content_version AS contentVersion, created_at AS createdAt, updated_at AS updatedAt FROM review_responses WHERE id = ? LIMIT 1",
      input.id,
    );
  }

  async createModerationCase(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly reviewId: EntityId;
      readonly reasonCode?: string;
      readonly policyVersion: string;
      readonly assignedTo?: string;
      readonly now: string;
    },
  ) {
    const review = await this.getReview(context, input.reviewId);
    await this.database.run(
      "INSERT INTO review_moderation_cases (id, review_id, status, reason_code, policy_version, assigned_to, opened_at, created_at, updated_at) VALUES (?, ?, 'open', ?, ?, ?, ?, ?, ?)",
      input.id, review.id, input.reasonCode?.trim() || null, input.policyVersion.trim(),
      input.assignedTo?.trim() || null, input.now, input.now, input.now,
    );
    await this.database.run(
      "INSERT OR IGNORE INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at) VALUES (?, 'review.moderation.requested', 1, 'Review', ?, ?, ?, ?, 'pending', 0, ?, ?)",
      input.id + ":moderation-requested", review.id, review.organizationId, review.workspaceId,
      JSON.stringify({ reviewId: review.id, moderationCaseId: input.id, reasonCode: input.reasonCode ?? null }),
      input.now, input.now,
    );
    return this.database.first(
      "SELECT id, review_id AS reviewId, status, reason_code AS reasonCode, policy_version AS policyVersion, assigned_to AS assignedTo, opened_at AS openedAt, resolved_at AS resolvedAt, created_at AS createdAt, updated_at AS updatedAt FROM review_moderation_cases WHERE id = ? LIMIT 1",
      input.id,
    );
  }

  async recordModerationDecision(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly moderationCaseId: EntityId;
      readonly decision: "approve" | "reject" | "remove" | "restrict" | "restore";
      readonly actorReference: string;
      readonly reasonCode: string;
      readonly policyVersion: string;
      readonly decidedAt: string;
      readonly now: string;
    },
  ) {
    const moderationCase = await this.database.first<{ reviewId: EntityId; organizationId: EntityId; workspaceId: EntityId | null }>(
      "SELECT mc.review_id AS reviewId, r.organization_id AS organizationId, r.workspace_id AS workspaceId FROM review_moderation_cases mc INNER JOIN reviews r ON r.id = mc.review_id WHERE mc.id = ? AND r.organization_id = ? AND (r.workspace_id IS NULL OR r.workspace_id = ?) LIMIT 1",
      input.moderationCaseId, this.requireOrganization({ organizationId: context.tenantId }), context.workspaceId ?? null,
    );
    if (!moderationCase) throw new DatabaseError("Review moderation case not found");
    const transitions = {
      approve: { reviewStatus: "published", moderationState: "approved", caseStatus: "resolved" },
      reject: { reviewStatus: "rejected", moderationState: "rejected", caseStatus: "resolved" },
      remove: { reviewStatus: "removed", moderationState: "removed", caseStatus: "resolved" },
      restrict: { reviewStatus: "pending_moderation", moderationState: "restricted", caseStatus: "in_review" },
      restore: { reviewStatus: "published", moderationState: "approved", caseStatus: "resolved" },
    } as const;
    const transition = transitions[input.decision];
    if (!transition) throw new DatabaseError("Unsupported Review moderation decision");
    await this.database.transaction([
      {
        sql: "INSERT INTO review_moderation_decisions (id, moderation_case_id, decision, actor_reference, reason_code, policy_version, decided_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params: [input.id, input.moderationCaseId, input.decision, input.actorReference.trim(), input.reasonCode.trim(), input.policyVersion.trim(), input.decidedAt, input.now],
      },
      {
        sql: "UPDATE review_moderation_cases SET status = ?, resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END, updated_at = ? WHERE id = ?",
        params: [transition.caseStatus, transition.caseStatus, input.decidedAt, input.now, input.moderationCaseId],
      },
      {
        sql: "UPDATE reviews SET status = ?, moderation_state = ?, published_at = CASE WHEN ? = 'published' AND published_at IS NULL THEN ? ELSE published_at END, content_version = content_version + 1, updated_at = ? WHERE id = ?",
        params: [transition.reviewStatus, transition.moderationState, transition.reviewStatus, input.decidedAt, input.now, moderationCase.reviewId],
      },
      {
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at) VALUES (?, 'review.moderated', 1, 'Review', ?, ?, ?, ?, 'pending', 0, ?, ?)",
        params: [
          input.id + ":moderated", moderationCase.reviewId, moderationCase.organizationId, moderationCase.workspaceId,
          JSON.stringify({ reviewId: moderationCase.reviewId, moderationCaseId: input.moderationCaseId, decisionId: input.id, decision: input.decision, policyVersion: input.policyVersion }),
          input.now, input.decidedAt,
        ],
      },
    ]);
    return this.getReview(context, moderationCase.reviewId);
  }

  async recordRiskSignal(
    context: RequestContext,
    input: {
      readonly id: EntityId;
      readonly reviewId: EntityId;
      readonly signalType: string;
      readonly value?: unknown;
      readonly confidence?: number;
      readonly source: string;
      readonly modelVersion?: string;
      readonly policyVersion?: string;
      readonly now: string;
    },
  ): Promise<void> {
    await this.getReview(context, input.reviewId);
    if (!input.signalType.trim() || !input.source.trim()) throw new DatabaseError("Review risk signal type and source are required");
    if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) throw new DatabaseError("Review risk signal confidence must be between 0 and 1");
    await this.database.run(
      "INSERT INTO review_risk_signals (id, review_id, signal_type, value_json, confidence, source, model_version, policy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      input.id, input.reviewId, input.signalType.trim(), input.value === undefined ? null : JSON.stringify(input.value),
      input.confidence ?? null, input.source.trim(), input.modelVersion?.trim() || null, input.policyVersion?.trim() || null, input.now,
    );
  }

  async rebuildReputation(
    context: RequestContext,
    input: { readonly targetType: ReviewTargetType; readonly targetId: EntityId; readonly policyVersion: string; readonly now: string; },
  ) {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const target = await this.database.first<{ workspaceId: EntityId | null }>(
      targetWorkspaceSql(input.targetType), input.targetId, organizationId,
    );
    if (!target) throw new DatabaseError("Reputation target not found");
    const rows = await this.database.all<{ ratingValue: number }>(
      publishedRatingsSql(input.targetType), input.targetId, organizationId,
    );
    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    let ratingSum = 0;
    for (const row of rows) {
      ratingSum += row.ratingValue;
      distribution[String(row.ratingValue)] = (distribution[String(row.ratingValue)] ?? 0) + 1;
    }
    const reportRow = await this.database.first<{ count: number }>(
      "SELECT COUNT(*) AS count FROM review_reports rr INNER JOIN reviews r ON r.id = rr.review_id WHERE rr.status <> 'dismissed' AND r.organization_id = ? AND " + targetPredicateSql(input.targetType),
      organizationId, input.targetId,
    );
    const versionRow = await this.database.first<{ version: number }>(
      "SELECT COALESCE(MAX(version), 0) AS version FROM reputation_versions WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND target_type = ? AND target_id = ?",
      organizationId, target.workspaceId, input.targetType, input.targetId,
    );
    const version = (versionRow?.version ?? 0) + 1;
    const summaryId = input.targetType + ":" + input.targetId;
    const versionId = summaryId + ":" + String(version);
    await this.database.transaction([
      {
        sql: "UPDATE reputation_versions SET status = 'retired' WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND target_type = ? AND target_id = ? AND status = 'active'",
        params: [organizationId, target.workspaceId, input.targetType, input.targetId],
      },
      {
        sql: "INSERT INTO reputation_versions (id, organization_id, workspace_id, target_type, target_id, version, policy_version, status, generated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)",
        params: [versionId, organizationId, target.workspaceId, input.targetType, input.targetId, version, input.policyVersion, input.now, input.now],
      },
      {
        sql: "INSERT INTO reputation_summaries (id, organization_id, workspace_id, target_type, target_id, published_review_count, rating_sum, rating_distribution_json, report_count, projection_version, source_review_cursor, calculated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(organization_id, COALESCE(workspace_id, ''), target_type, target_id) DO UPDATE SET published_review_count = excluded.published_review_count, rating_sum = excluded.rating_sum, rating_distribution_json = excluded.rating_distribution_json, report_count = excluded.report_count, projection_version = excluded.projection_version, source_review_cursor = excluded.source_review_cursor, calculated_at = excluded.calculated_at, updated_at = excluded.updated_at",
        params: [summaryId, organizationId, target.workspaceId, input.targetType, input.targetId, rows.length, ratingSum, JSON.stringify(distribution), reportCount, version, input.now, input.now, input.now, input.now],
      },
      {
        sql: "INSERT INTO outbox_events (id, event_type, event_version, aggregate_type, aggregate_id, organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at) VALUES (?, 'reputation.updated', 1, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)",
        params: [versionId + ":updated", "ReputationSummary", input.targetId, organizationId, target.workspaceId, JSON.stringify({ targetType: input.targetType, targetId: input.targetId, version }), input.now, input.now],
      },
    ]);
    return this.database.first(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, target_type AS targetType, target_id AS targetId, published_review_count AS publishedReviewCount, rating_sum AS ratingSum, rating_distribution_json AS ratingDistributionJson, report_count AS reportCount, projection_version AS projectionVersion, source_review_cursor AS sourceReviewCursor, calculated_at AS calculatedAt, created_at AS createdAt, updated_at AS updatedAt FROM reputation_summaries WHERE organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) AND target_type = ? AND target_id = ? LIMIT 1",
      organizationId, target.workspaceId, input.targetType, input.targetId,
    );
  }

  async moderateReview(
    context: RequestContext,
    id: EntityId,
    moderationState: string,
    now: string,
  ): Promise<ReviewRecord> {
    const current = await this.getReview(context, id);
    await this.database.run(
      "UPDATE reviews SET moderation_state = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?)",
      moderationState.trim(),
      now,
      current.id,
      current.organizationId,
      current.workspaceId ?? context.workspaceId,
    );
    return this.getReview(context, id);
  }

  async getReview(context: RequestContext, id: EntityId): Promise<ReviewRecord> {
    const row = await this.database.first<ReviewRecord>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, customer_id AS customerId, rating_value AS ratingValue, content, moderation_state AS moderationState, business_id AS businessId, offering_id AS offeringId, product_id AS productId, created_at AS createdAt, updated_at AS updatedAt FROM reviews WHERE id = ? AND organization_id = ? AND (workspace_id IS NULL OR workspace_id = ?) LIMIT 1",
      id,
      this.requireOrganization({ organizationId: context.tenantId }),
      context.workspaceId ?? null,
    );
    if (!row) throw new DatabaseError("Review not found");
    return row;
  }
}


function targetWorkspaceSql(targetType: ReviewTargetType): string {
  if (targetType === "business") return "SELECT workspace_id AS workspaceId FROM businesses WHERE id = ? AND organization_id = ? LIMIT 1";
  if (targetType === "offering") return "SELECT b.workspace_id AS workspaceId FROM offerings o INNER JOIN businesses b ON b.id = o.business_id WHERE o.id = ? AND b.organization_id = ? LIMIT 1";
  return "SELECT b.workspace_id AS workspaceId FROM products p INNER JOIN businesses b ON b.id = p.business_id WHERE p.id = ? AND b.organization_id = ? LIMIT 1";
}

function publishedRatingsSql(targetType: ReviewTargetType): string {
  if (targetType === "business") return "SELECT rating_value AS ratingValue FROM reviews WHERE business_id = ? AND organization_id = ? AND status = 'published' ORDER BY created_at ASC, id ASC";
  if (targetType === "offering") return "SELECT rating_value AS ratingValue FROM reviews WHERE offering_id = ? AND organization_id = ? AND status = 'published' ORDER BY created_at ASC, id ASC";
  return "SELECT rating_value AS ratingValue FROM reviews WHERE product_id = ? AND organization_id = ? AND status = 'published' ORDER BY created_at ASC, id ASC";
}

function targetPredicateSql(targetType: ReviewTargetType): string {
  if (targetType === "business") return "r.business_id = ?";
  if (targetType === "offering") return "r.offering_id = ?";
  return "r.product_id = ?";
}
