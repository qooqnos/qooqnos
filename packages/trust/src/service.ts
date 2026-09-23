import type { EntityId, RequestContext } from "@qooqnos/core";
import { VerificationRepository } from "@qooqnos/database";
import { DatabaseError } from "@qooqnos/database";
import type { AuthorizationService } from "@qooqnos/runtime";
import { TrustReviewRepository, type ReviewTargetType } from "./repository";

export interface TrustServiceOptions {
  readonly repository: TrustReviewRepository;
  readonly verification: VerificationRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class TrustService {
  constructor(private readonly options: TrustServiceOptions) {}

  async createVerificationCase(context: RequestContext, input: {
    readonly businessId?: EntityId;
    readonly subjectType: "business"|"user"|"professional_credential"|"location"|"ownership_claim"|"other";
    readonly subjectId: EntityId;
    readonly policyId: string;
    readonly policyVersion: string;
    readonly riskClass: string;
  }) {
    await this.options.authorization.assert({context,permission:"trust.verification.manage",requireAuthentication:true,requireWorkspace:false});
    if (!context.tenantId) throw new DatabaseError("Trust organization scope is required");
    return this.options.verification.createCase(context,{
      id:this.options.id(),
      organizationId:context.tenantId,
      workspaceId:context.workspaceId,
      subjectType:input.subjectType,
      subjectId:input.subjectId,
      policyId:input.policyId,
      policyVersion:input.policyVersion,
      riskClass:input.riskClass,
      now:this.options.now(),
    });
  }

  async assignVerificationReview(context: RequestContext, input: { readonly caseId: EntityId; readonly reviewerId: string }) {
    await this.options.authorization.assert({context,permission:"trust.verification.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.verification.assignReview(context,{
      id:this.options.id(),
      caseId:input.caseId,
      reviewerId:input.reviewerId,
      assignedAt:this.options.now(),
      now:this.options.now(),
    });
  }

  async completeVerificationReview(context: RequestContext, reviewId: EntityId, outcome: string, escalationReason?: string) {
    await this.options.authorization.assert({context,permission:"trust.verification.manage",requireAuthentication:true,requireWorkspace:false});
    return this.options.verification.updateReview(
      context,
      reviewId,
      "completed",
      this.options.now(),
      outcome,
      escalationReason,
    );
  }

  async openGenericModerationCase(
    context: RequestContext,
    input: {
      readonly subjectType: string;
      readonly subjectId: EntityId;
      readonly sourceType: string;
      readonly sourceId: EntityId;
      readonly policyId: string;
      readonly policyVersion: string;
      readonly riskLevel: "low" | "medium" | "high" | "critical";
    },
  ) {
    await this.options.authorization.assert({
      context,
      permission: "trust.moderation.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createGenericModerationCase(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async transitionGenericModerationCase(
    context: RequestContext,
    id: EntityId,
    status: "open" | "reviewing" | "decided" | "actioned" | "closed" | "escalated",
  ) {
    await this.options.authorization.assert({
      context,
      permission: "trust.moderation.manage",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.transitionGenericModerationCase(
      context,
      id,
      status,
      this.options.now(),
    );
  }

  async reportReview(
    context: RequestContext,
    input: { readonly reviewId: EntityId; readonly reporterReference: string; readonly reasonCode: string; readonly details?: string },
  ) {
    await this.options.authorization.assert({ context, permission: "trust.review.report", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.reportReview(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async respondToReview(
    context: RequestContext,
    input: { readonly reviewId: EntityId; readonly businessId: EntityId; readonly actorReference: string; readonly content: string; readonly policyVersion: string },
  ) {
    await this.options.authorization.assert({ context, permission: "trust.review.respond", requireAuthentication: true, requireWorkspace: true });
    return this.options.repository.createResponse(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async openModerationCase(
    context: RequestContext,
    input: { readonly reviewId: EntityId; readonly reasonCode?: string; readonly policyVersion: string; readonly assignedTo?: string },
  ) {
    await this.options.authorization.assert({ context, permission: "trust.review.moderate", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.createModerationCase(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async recordModerationDecision(
    context: RequestContext,
    input: {
      readonly moderationCaseId: EntityId;
      readonly decision: "approve" | "reject" | "remove" | "restrict" | "restore";
      readonly actorReference: string;
      readonly reasonCode: string;
      readonly policyVersion: string;
    },
  ) {
    await this.options.authorization.assert({ context, permission: "trust.review.moderate", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.recordModerationDecision(context, {
      ...input,
      id: this.options.id(),
      decidedAt: this.options.now(),
      now: this.options.now(),
    });
  }

  async recordRiskSignal(
    context: RequestContext,
    input: {
      readonly reviewId: EntityId;
      readonly signalType: string;
      readonly value?: unknown;
      readonly confidence?: number;
      readonly source: string;
      readonly modelVersion?: string;
      readonly policyVersion?: string;
    },
  ) {
    await this.options.authorization.assert({ context, permission: "trust.review.moderate", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.recordRiskSignal(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async rebuildReputation(
    context: RequestContext,
    input: { readonly targetType: ReviewTargetType; readonly targetId: EntityId; readonly policyVersion: string },
  ) {
    await this.options.authorization.assert({ context, permission: "trust.reputation.rebuild", requireAuthentication: true, requireWorkspace: false });
    return this.options.repository.rebuildReputation(context, {
      ...input,
      now: this.options.now(),
    });
  }

  async moderateReview(context: RequestContext, id: EntityId, moderationState: string) {
    await this.options.authorization.assert({
      context,
      permission: "trust.review.moderate",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.moderateReview(context,id,moderationState,this.options.now());
  }

  async createReview(
    context: RequestContext,
    input: {
      readonly customerId: EntityId;
      readonly ratingValue: number;
      readonly content?: string;
      readonly moderationState?: string;
      readonly businessId?: EntityId;
      readonly offeringId?: EntityId;
      readonly productId?: EntityId;
    },
  ) {
    await this.options.authorization.assert({
      context,
      permission: "trust.review.create",
      requireAuthentication: true,
      requireWorkspace: false,
    });
    return this.options.repository.createReview(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }
}

export const TRUST_PERMISSIONS = [
  "trust.review.read",
  "trust.review.create",
  "trust.review.moderate",
  "trust.review.report",
  "trust.review.respond",
  "trust.moderation.manage",
  "trust.reputation.read",
  "trust.reputation.rebuild",
  "trust.verification.read",
  "trust.verification.manage",
] as const;
