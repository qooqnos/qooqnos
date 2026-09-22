import type { EntityId, RequestContext } from "@qooqnos/core";
import { VerificationRepository } from "@qooqnos/database";
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
    return this.options.verification.completeReview(context,reviewId,outcome,this.options.now(),this.options.now(),escalationReason);
  }

  async createReview(
    context: RequestContext,
    input: {
      readonly customerId: EntityId;
      readonly ratingValue: number;
      readonly content?: string;
      readonly moderationState?: string;
  readonly business_id: EntityId | undefined;
  readonly offering_id: EntityId | undefined;
  readonly booking_id: EntityId | undefined;
  readonly appointment_id: EntityId | undefined;
  readonly service_id: EntityId | undefined;
  readonly product_id: EntityId | undefined;
  readonly location_id: EntityId | undefined;
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
  "trust.verification.read",
  "trust.verification.manage",
] as const;
