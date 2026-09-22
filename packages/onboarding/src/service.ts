import type { EntityId, RequestContext } from "@qooqnos/core";
import { AuditService, DatabaseError, OutboxService } from "@qooqnos/database";
import type { AuthorizationService, AuthorizationSubject } from "@qooqnos/runtime";
import type { OnboardingProfile, OnboardingRepository, OnboardingStatus } from "./contract";

export interface OnboardingServiceOptions {
  readonly repository: OnboardingRepository;
  readonly authorization: AuthorizationService;
  readonly resolveSubject: () => AuthorizationSubject;
  readonly audit: AuditService;
  readonly outbox: OutboxService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class OnboardingService {
  constructor(private readonly options: OnboardingServiceOptions) {}

  async submit(context: RequestContext, profileId: EntityId, actorId: EntityId): Promise<OnboardingProfile> {
    return this.transition(context, profileId, actorId, "draft", "submitted", "onboarding.submit");
  }

  async verify(context: RequestContext, profileId: EntityId, actorId: EntityId): Promise<OnboardingProfile> {
    return this.transition(context, profileId, actorId, "submitted", "verified", "onboarding.verify");
  }

  async reject(context: RequestContext, profileId: EntityId, actorId: EntityId): Promise<OnboardingProfile> {
    return this.transition(context, profileId, actorId, "submitted", "rejected", "onboarding.reject");
  }

  private async transition(
    context: RequestContext,
    profileId: EntityId,
    actorId: EntityId,
    expectedStatus: OnboardingStatus,
    status: OnboardingStatus,
    permission: string,
  ): Promise<OnboardingProfile> {
    const subject = this.options.resolveSubject();
    if (subject.actorId !== actorId) throw new DatabaseError("Authorization subject actor mismatch");

    const profile = await this.options.repository.getById(context, profileId);
    if (!profile) throw new DatabaseError("Onboarding profile not found");
    if (profile.ownerId !== actorId) throw new DatabaseError("Onboarding actor does not own the profile");
    if (profile.status !== expectedStatus) {
      throw new DatabaseError(`Invalid onboarding transition: expected ${expectedStatus}, found ${profile.status}`);
    }

    await this.options.authorization.assert({
      context,
      permission,
      resource: {
        tenantId: profile.organizationId,
        workspaceId: profile.workspaceId,
        ownerId: profile.ownerId,
      },
      requireAuthentication: true,
      requireWorkspace: true,
    });

    const now = this.options.now();

    return this.options.repository.setStatusAndRecord(context, profileId, {
      expectedStatus,
      status,
      now,
      audit: {
        sql: `INSERT INTO audit_events
              (id, actor_id, organization_id, workspace_id, action, target_type, target_id,
               outcome, request_id, correlation_id, metadata_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          this.options.id(),
          actorId,
          profile.organizationId,
          profile.workspaceId,
          permission,
          "onboarding_profile",
          profile.id,
          "succeeded",
          context.requestId,
          context.correlationId,
          JSON.stringify({ fromStatus: expectedStatus, toStatus: status }),
          now,
        ],
      },
      outbox: {
        sql: `INSERT INTO outbox_events
              (id, event_type, event_version, aggregate_type, aggregate_id,
               organization_id, workspace_id, payload_json, status, attempts, available_at, occurred_at, published_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, NULL)`,
        params: [
          this.options.id(),
          `onboarding.${status}`,
          1,
          "onboarding_profile",
          profile.id,
          profile.organizationId,
          profile.workspaceId,
          JSON.stringify({
            onboardingProfileId: profile.id,
            ownerId: actorId,
            fromStatus: expectedStatus,
            toStatus: status,
          }),
          now,
          now,
        ],
      },
    });
  }
}
