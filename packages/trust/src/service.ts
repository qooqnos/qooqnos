import type { EntityId, RequestContext } from "@qooqnos/core";
import type { AuthorizationService } from "@qooqnos/runtime";
import { TrustReviewRepository, type ReviewTargetType } from "./repository";

export interface TrustServiceOptions {
  readonly repository: TrustReviewRepository;
  readonly authorization: AuthorizationService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class TrustService {
  constructor(private readonly options: TrustServiceOptions) {}

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
