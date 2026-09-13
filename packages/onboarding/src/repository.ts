import type { EntityId, RequestContext } from "@phoenix/core";
import { D1Database, Repository, type TransactionStatement } from "@phoenix/database";
import type { OnboardingProfile, OnboardingRepository, OnboardingStatus } from "./index";

export interface OnboardingTransitionTransaction {
  readonly status: OnboardingStatus;
  readonly now: string;
  readonly audit: TransactionStatement;
  readonly outbox: TransactionStatement;
}

export class D1OnboardingRepository extends Repository implements OnboardingRepository {
  constructor(database: D1Database) {
    super(database);
  }

  async create(input: {
    readonly id: EntityId;
    readonly organizationId: EntityId;
    readonly workspaceId: EntityId;
    readonly ownerId: EntityId;
    readonly now: string;
  }): Promise<OnboardingProfile> {
    await this.database.run(
      `INSERT INTO onboarding_profiles
       (id, organization_id, workspace_id, owner_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
      input.id,
      input.organizationId,
      input.workspaceId,
      input.ownerId,
      input.now,
      input.now,
    );

    return {
      id: input.id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      status: "draft",
      createdAt: input.now,
      updatedAt: input.now,
    };
  }

  async getById(context: RequestContext, id: EntityId): Promise<OnboardingProfile | null> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    return this.database.first<OnboardingProfile>(
      `SELECT id,
              organization_id AS organizationId,
              workspace_id AS workspaceId,
              owner_id AS ownerId,
              status,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM onboarding_profiles
       WHERE id = ? AND organization_id = ? AND workspace_id = ?
       LIMIT 1`,
      id,
      organizationId,
      workspaceId,
    );
  }

  async setStatus(
    context: RequestContext,
    id: EntityId,
    status: OnboardingStatus,
    now: string,
  ): Promise<OnboardingProfile> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    await this.database.run(
      `UPDATE onboarding_profiles
       SET status = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
      status,
      now,
      id,
      organizationId,
      workspaceId,
    );

    const updated = await this.getById(context, id);
    if (!updated) throw new Error("Onboarding profile not found after status update");
    return updated;
  }

  async setStatusAndRecord(
    context: RequestContext,
    id: EntityId,
    transition: OnboardingTransitionTransaction,
  ): Promise<OnboardingProfile> {
    const organizationId = this.requireOrganization({ organizationId: context.tenantId });
    const workspaceId = this.requireWorkspace({ workspaceId: context.workspaceId });

    await this.database.transaction([
      {
        sql: `UPDATE onboarding_profiles
              SET status = ?, updated_at = ?
              WHERE id = ? AND organization_id = ? AND workspace_id = ?`,
        params: [transition.status, transition.now, id, organizationId, workspaceId],
      },
      transition.audit,
      transition.outbox,
    ]);

    const updated = await this.getById(context, id);
    if (!updated) throw new Error("Onboarding profile not found after transactional status update");
    return updated;
  }
}
