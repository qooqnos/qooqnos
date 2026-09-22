import type { EntityId, RequestContext } from "@qooqnos/core";
import type { TransactionStatement } from "@qooqnos/database";

export type OnboardingStatus = "draft" | "submitted" | "verified" | "rejected";

export interface OnboardingProfile {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly ownerId: EntityId;
  readonly status: OnboardingStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OnboardingTransitionTransaction {
  readonly expectedStatus: OnboardingStatus;
  readonly status: OnboardingStatus;
  readonly now: string;
  readonly audit: TransactionStatement;
  readonly outbox: TransactionStatement;
}

export interface OnboardingCreateInput {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly ownerId: EntityId;
  readonly now: string;
}

export interface OnboardingRepository {
  create(input: OnboardingCreateInput): Promise<OnboardingProfile>;
  getById(context: RequestContext, id: EntityId): Promise<OnboardingProfile | null>;
  setStatus(context: RequestContext, id: EntityId, status: OnboardingStatus, now: string): Promise<OnboardingProfile>;
  setStatusAndRecord(
    context: RequestContext,
    id: EntityId,
    transition: OnboardingTransitionTransaction,
  ): Promise<OnboardingProfile>;
}
