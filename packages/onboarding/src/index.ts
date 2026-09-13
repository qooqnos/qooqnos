import type { EntityId, RequestContext } from "@phoenix/core";
import type { AuditService, OutboxService } from "@phoenix/database";
import type { AuthorizationPolicyRegistry, AuthorizationSubject } from "@phoenix/runtime";

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

export interface OnboardingRepository {
  create(input: {
    readonly id: EntityId;
    readonly organizationId: EntityId;
    readonly workspaceId: EntityId;
    readonly ownerId: EntityId;
    readonly now: string;
  }): Promise<OnboardingProfile>;
  getById(context: RequestContext, id: EntityId): Promise<OnboardingProfile | null>;
  setStatus(context: RequestContext, id: EntityId, status: OnboardingStatus, now: string): Promise<OnboardingProfile>;
}

export interface OnboardingServiceOptions {
  readonly repository: OnboardingRepository;
  readonly authorization: AuthorizationPolicyRegistry;
  readonly resolveSubject: (context: RequestContext, actorId: EntityId) => AuthorizationSubject;
  readonly audit: AuditService;
  readonly outbox: OutboxService;
  readonly id: () => EntityId;
  readonly now: () => string;
}

export class OnboardingService {
  constructor(private readonly options: OnboardingServiceOptions) {}

  async create(context: RequestContext, ownerId: EntityId): Promise<OnboardingProfile> {
    const organizationId = requireContext(context.tenantId, "tenant");
    const workspaceId = requireContext(context.workspaceId, "workspace");
    const actorId = requireContext(context.actorId, "actor");
    this.authorize(context, "onboarding.create", actorId);
    const profile = await this.options.repository.create({
      id: this.options.id(), organizationId, workspaceId, ownerId, now: this.options.now(),
    });
    await this.record(context, profile, "onboarding.created");
    return profile;
  }

  async submit(context: RequestContext, id: EntityId, actorId: EntityId): Promise<OnboardingProfile> {
    return this.transition(context, id, actorId, "draft", "submitted", "onboarding.submit", "onboarding.submitted");
  }

  async verify(context: RequestContext, id: EntityId, actorId: EntityId): Promise<OnboardingProfile> {
    return this.transition(context, id, actorId, "submitted", "verified", "onboarding.verify", "onboarding.verified");
  }

  async reject(context: RequestContext, id: EntityId, actorId: EntityId): Promise<OnboardingProfile> {
    return this.transition(context, id, actorId, "submitted", "rejected", "onboarding.reject", "onboarding.rejected");
  }

  private async transition(
    context: RequestContext, id: EntityId, actorId: EntityId, expected: OnboardingStatus,
    next: OnboardingStatus, permission: string, eventType: string,
  ): Promise<OnboardingProfile> {
    const current = await this.options.repository.getById(context, id);
    if (!current) throw new Error("Onboarding profile not found");
    this.authorize(context, permission, actorId, current);
    if (current.status !== expected) throw new Error(`Invalid onboarding transition: ${current.status} -> ${next}`);
    const profile = await this.options.repository.setStatus(context, id, next, this.options.now());
    await this.record(context, profile, eventType);
    return profile;
  }

  private authorize(context: RequestContext, permission: string, actorId: EntityId, resource?: OnboardingProfile): void {
    const subject = this.options.resolveSubject(context, actorId);
    if (subject.actorId !== actorId) throw new Error("Authorization subject actor mismatch");
    this.options.authorization.assert({
      context, permission, requireAuthentication: true, requireWorkspace: true,
      subject,
      resource: resource ? { tenantId: resource.organizationId, workspaceId: resource.workspaceId, ownerId: resource.ownerId } : undefined,
    });
  }

  private async record(context: RequestContext, profile: OnboardingProfile, eventType: string): Promise<void> {
    await this.options.audit.append({
      id: this.options.id(), actorId: context.actorId, organizationId: profile.organizationId,
      workspaceId: profile.workspaceId, action: eventType, targetType: "onboarding_profile",
      targetId: profile.id, outcome: "success", requestId: context.requestId,
      correlationId: context.correlationId, createdAt: profile.updatedAt,
    });
    await this.options.outbox.enqueue({
      id: this.options.id(), eventType, eventVersion: 1, aggregateType: "onboarding_profile",
      aggregateId: profile.id, organizationId: profile.organizationId, workspaceId: profile.workspaceId,
      payloadJson: JSON.stringify({ id: profile.id, status: profile.status }),
      availableAt: profile.updatedAt, occurredAt: profile.updatedAt,
    });
  }
}

function requireContext(value: EntityId | undefined, name: string): EntityId {
  if (!value) throw new Error(`${name} context is required`);
  return value;
}

export * from "./repository";
export * from "./authorization";
export * from "./manifest";
