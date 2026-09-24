import type { EntityId, RequestContext } from "@qooqnos/core";
import { ApprovalRepository, type ApprovalRequestRecord } from "@qooqnos/database";
import type { AuthorizationService } from "./authorization-service";

export class ApprovalService {
  constructor(
    private readonly options: {
      readonly repository: ApprovalRepository;
      readonly authorization: AuthorizationService;
      readonly id: () => EntityId;
      readonly now: () => string;
    },
  ) {}

  async create(context: RequestContext, input: {
    readonly requestedBy: EntityId;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: EntityId;
    readonly reason: string;
    readonly requiredApproverRole?: string;
    readonly idempotencyKey: string;
    readonly expiresAt?: string;
  }): Promise<ApprovalRequestRecord> {
    await this.options.authorization.assert({
      context,
      permission: "authorization.approval.create",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.create(context, {
      ...input,
      id: this.options.id(),
      now: this.options.now(),
    });
  }

  async get(context: RequestContext, id: EntityId): Promise<ApprovalRequestRecord> {
    await this.options.authorization.assert({
      context,
      permission: "authorization.approval.read",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.get(context, id);
  }

  async approve(context: RequestContext, id: EntityId, decidedBy: EntityId, reason: string): Promise<ApprovalRequestRecord> {
    await this.options.authorization.assert({
      context,
      permission: "authorization.approval.approve",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.decide(context, {
      id,
      decidedBy,
      status: "approved",
      decisionReason: reason,
      now: this.options.now(),
    });
  }

  async reject(context: RequestContext, id: EntityId, decidedBy: EntityId, reason: string): Promise<ApprovalRequestRecord> {
    await this.options.authorization.assert({
      context,
      permission: "authorization.approval.reject",
      requireAuthentication: true,
      requireWorkspace: true,
    });
    return this.options.repository.decide(context, {
      id,
      decidedBy,
      status: "rejected",
      decisionReason: reason,
      now: this.options.now(),
    });
  }
}

export const AUTHORIZATION_APPROVAL_PERMISSIONS = [
  "authorization.approval.create",
  "authorization.approval.read",
  "authorization.approval.approve",
  "authorization.approval.reject",
] as const;
