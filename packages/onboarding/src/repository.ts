import type { EntityId, RequestContext } from "@phoenix/core";
import { D1Database, DatabaseError, Repository, type TransactionStatement } from "@phoenix/database";
import type { OnboardingProfile, OnboardingRepository, OnboardingStatus } from "./index";

export interface OnboardingCreateTransaction {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly workspaceId: EntityId;
  readonly ownerId: EntityId;
  readonly now: string;
  readonly audit: TransactionStatement;
  readonly outbox: TransactionStatement;
}

export interface OnboardingTransitionTransaction {
  readonly expectedStatus: OnboardingStatus;
  readonly status: OnboardingStatus;
  readonly now: string;
  readonly audit: TransactionStatement;
  readonly outbox: TransactionStatement;
}

export class D1OnboardingRepository extends Repository implements OnboardingRepository {
  constructor(database: D1Database) { super(database); }

  async create(input: { readonly id: EntityId; readonly organizationId: EntityId; readonly workspaceId: EntityId; readonly ownerId: EntityId; readonly now: string; }): Promise<OnboardingProfile> {
    await this.assertOwnerMembership(input.organizationId, input.workspaceId, input.ownerId);
    await this.database.run(
      `INSERT INTO onboarding_profiles
       (id, organization_id, workspace_id, owner_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      input.id, input.organizationId, input.workspaceId, input.ownerId, input.now, input.now,
    );
    return { id: input.id, organizationId: input.organizationId, workspaceId: input.workspaceId, ownerId: input.ownerId, status: "draft", createdAt: input.now, updatedAt: input.now };
  }

  async createAndRecord(input: OnboardingCreateTransaction): Promise<OnboardingProfile> {
    await this.assertOwnerMembership(input.organizationId, input.workspaceId, input.ownerId);
    await this.database.transaction([
      { sql: `INSERT INTO onboarding_profiles
              (id, organization_id, workspace_id, owner_id, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'draft', ?, ?)`, params: [input.id, input.organizationId, input.workspaceId, input.ownerId, input.now, input.now] },
      input.audit, input.outbox,
    ]);
    return { id: input.id, organizationId: input.organizationId, workspaceId: input.workspaceId, ownerId: input.ownerId, status: "draft", createdAt: input.now, updatedAt: input.now };
  }

  async getById(context: RequestContext, id: EntityId): Promise<OnboardingProfile | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    return this.database.first<OnboardingProfile>(
      `SELECT id, organization_id AS organizationId, workspace_id AS workspaceId, owner_id AS ownerId,
              status, created_at AS createdAt, updated_at AS updatedAt
       FROM onboarding_profiles
       WHERE id = ? AND organization_id = ? AND workspace_id = ? LIMIT 1`,
      id, organizationId, workspaceId,
    );
  }

  async setStatus(context: RequestContext, id: EntityId, status: OnboardingStatus, now: string): Promise<OnboardingProfile> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    await this.database.run(
      `UPDATE onboarding_profiles SET status = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
      status, now, id, organizationId, workspaceId,
    );
    const updated = await this.getById(context, id);
    if (!updated) throw new DatabaseError("Onboarding profile not found after status update");
    return updated;
  }

  async setStatusAndRecord(context: RequestContext, id: EntityId, transition: OnboardingTransitionTransaction): Promise<OnboardingProfile> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });
    const results = await this.database.transaction([
      { sql: `UPDATE onboarding_profiles SET status = ?, updated_at = ?
              WHERE id = ? AND organization_id = ? AND workspace_id = ? AND status = ?`,
        params: [transition.status, transition.now, id, organizationId, workspaceId, transition.expectedStatus] },
      transition.audit, transition.outbox,
    ]);
    if ((results[0]?.meta?.changes ?? 0) !== 1) {
      throw new DatabaseError(`Concurrent onboarding transition rejected: expected ${transition.expectedStatus}`);
    }
    const updated = await this.getById(context, id);
    if (!updated) throw new DatabaseError("Onboarding profile not found after transactional status update");
    return updated;
  }

  private async assertOwnerMembership(organizationId: EntityId, workspaceId: EntityId, ownerId: EntityId): Promise<void> {
    const membership = await this.database.first<{ id: string }>(
      `SELECT m.id
       FROM memberships m
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.workspace_id = ? AND m.user_id = ? AND m.status = 'active'
         AND w.organization_id = ? AND w.status = 'active'
       LIMIT 1`,
      workspaceId, ownerId, organizationId,
    );
    if (!membership) throw new DatabaseError("Onboarding owner must be an active member of the target workspace");
  }
}
