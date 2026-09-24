import type { EntityId, RequestContext } from "@qooqnos/core";
import { DatabaseError, D1Database, Repository } from "@qooqnos/database";

export type ApprovalRequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

export interface ApprovalRequestRecord {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly requestedBy: EntityId;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: EntityId;
  readonly reason: string;
  readonly requiredApproverRole: string | null;
  readonly status: ApprovalRequestStatus;
  readonly decidedBy: EntityId | null;
  readonly decisionReason: string | null;
  readonly idempotencyKey: string;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly updatedAt: string;
}

export class ApprovalRepository extends Repository {
  constructor(database: D1Database) { super(database); }

  async create(context: RequestContext, input: {
    readonly id: EntityId;
    readonly requestedBy: EntityId;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: EntityId;
    readonly reason: string;
    readonly requiredApproverRole?: string;
    readonly idempotencyKey: string;
    readonly expiresAt?: string;
    readonly now: string;
  }): Promise<ApprovalRequestRecord> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const existing = await this.database.first<ApprovalRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, requested_by AS requestedBy, action, resource_type AS resourceType, resource_id AS resourceId, reason, required_approver_role AS requiredApproverRole, status, decided_by AS decidedBy, decision_reason AS decisionReason, idempotency_key AS idempotencyKey, expires_at AS expiresAt, created_at AS createdAt, decided_at AS decidedAt, updated_at AS updatedAt FROM approval_requests WHERE organization_id=? AND workspace_id=? AND idempotency_key=? LIMIT 1",
      organizationId, workspaceId, input.idempotencyKey.trim(),
    );
    if (existing) return existing;

    if (!input.action.trim() || !input.resourceType.trim() || !input.reason.trim()) {
      throw new DatabaseError("Approval action, resource type and reason are required");
    }

    await this.database.run(
      "INSERT INTO approval_requests (id, organization_id, workspace_id, requested_by, action, resource_type, resource_id, reason, required_approver_role, status, decided_by, decision_reason, idempotency_key, expires_at, created_at, decided_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?, ?, NULL, ?)",
      input.id, organizationId, workspaceId, input.requestedBy, input.action.trim(), input.resourceType.trim(), input.resourceId,
      input.reason.trim(), input.requiredApproverRole?.trim() || null, input.idempotencyKey.trim(), input.expiresAt ?? null, input.now, input.now,
    );
    return this.get(context, input.id);
  }

  async get(context: RequestContext, id: EntityId): Promise<ApprovalRequestRecord> {
    const row = await this.database.first<ApprovalRow>(
      "SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, requested_by AS requestedBy, action, resource_type AS resourceType, resource_id AS resourceId, reason, required_approver_role AS requiredApproverRole, status, decided_by AS decidedBy, decision_reason AS decisionReason, idempotency_key AS idempotencyKey, expires_at AS expiresAt, created_at AS createdAt, decided_at AS decidedAt, updated_at AS updatedAt FROM approval_requests WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      id, this.requireOrganization({ organizationId: context.tenantId }), this.requireWorkspace({ workspaceId: context.workspaceId }),
    );
    if (!row) throw new DatabaseError("Approval request not found");
    return row;
  }

  async decide(context: RequestContext, input: {
    readonly id: EntityId;
    readonly decidedBy: EntityId;
    readonly status: Extract<ApprovalRequestStatus, "approved" | "rejected">;
    readonly decisionReason: string;
    readonly now: string;
  }): Promise<ApprovalRequestRecord> {
    const current = await this.get(context, input.id);
    if (current.status !== "pending") throw new DatabaseError("Only pending approval requests can be decided");
    if (current.requestedBy === input.decidedBy) throw new DatabaseError("Separation of duties forbids self-approval");

    const result = await this.database.run(
      "UPDATE approval_requests SET status=?, decided_by=?, decision_reason=?, decided_at=?, updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND status='pending' AND requested_by<>?",
      input.status, input.decidedBy, input.decisionReason.trim(), input.now, input.now, input.id,
      current.organizationId, current.workspaceId, input.decidedBy,
    );
    if ((result.meta?.changes ?? 0) !== 1) throw new DatabaseError("Approval request changed concurrently");
    return this.get(context, input.id);
  }
}

type ApprovalRow = ApprovalRequestRecord;

