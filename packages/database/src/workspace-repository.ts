import { DatabaseError, D1Database, Repository, RepositoryContext } from "./client";

export type WorkspaceStatus = "active" | "suspended" | "archived";
export type MembershipStatus = "active" | "invited" | "suspended" | "removed";

export interface WorkspaceRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly status: WorkspaceStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MembershipRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly status: MembershipStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWorkspaceInput {
  readonly id: string;
  readonly name: string;
  readonly status?: WorkspaceStatus;
  readonly now: string;
}

export interface CreateMembershipInput {
  readonly id: string;
  readonly userId: string;
  readonly status?: MembershipStatus;
  readonly now: string;
}

export class WorkspaceRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async create(context: RepositoryContext, input: CreateWorkspaceInput): Promise<WorkspaceRecord> {
    const organizationId = this.requireOrganization(context);
    const status = input.status ?? "active";

    await this.database.run(
      "INSERT INTO workspaces (id, organization_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      input.id,
      organizationId,
      input.name,
      status,
      input.now,
      input.now,
    );

    return {
      id: input.id,
      organizationId,
      name: input.name,
      status,
      createdAt: input.now,
      updatedAt: input.now,
    };
  }

  async get(context: RepositoryContext): Promise<WorkspaceRecord | null> {
    const organizationId = this.requireOrganization(context);
    const workspaceId = this.requireWorkspace(context);

    return this.database.first<WorkspaceRecord>(
      "SELECT id, organization_id AS organizationId, name, status, created_at AS createdAt, updated_at AS updatedAt FROM workspaces WHERE id = ? AND organization_id = ? LIMIT 1",
      workspaceId,
      organizationId,
    );
  }

  async list(context: RepositoryContext): Promise<WorkspaceRecord[]> {
    const organizationId = this.requireOrganization(context);

    return this.database.all<WorkspaceRecord>(
      "SELECT id, organization_id AS organizationId, name, status, created_at AS createdAt, updated_at AS updatedAt FROM workspaces WHERE organization_id = ? ORDER BY created_at ASC, id ASC",
      organizationId,
    );
  }
  async listForUser(context: RepositoryContext, userId: string): Promise<WorkspaceRecord[]> {
    const organizationId = this.requireOrganization(context);
    return this.database.all<WorkspaceRecord>(
      "SELECT w.id, w.organization_id AS organizationId, w.name, w.status, w.created_at AS createdAt, w.updated_at AS updatedAt FROM workspaces w INNER JOIN memberships m ON m.workspace_id = w.id WHERE w.organization_id = ? AND m.user_id = ? AND m.status = 'active' AND w.status = 'active' ORDER BY w.created_at ASC, w.id ASC",
      organizationId,
      userId,
    );
  }


  async createMembership(context: RepositoryContext, input: CreateMembershipInput): Promise<MembershipRecord> {
    const workspaceId = this.requireWorkspace(context);
    const workspace = await this.get(context);
    if (!workspace) throw new DatabaseError("Workspace does not belong to the current organization");

    const status = input.status ?? "active";
    await this.database.run(
      "INSERT INTO memberships (id, workspace_id, user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      input.id,
      workspaceId,
      input.userId,
      status,
      input.now,
      input.now,
    );

    return {
      id: input.id,
      workspaceId,
      userId: input.userId,
      status,
      createdAt: input.now,
      updatedAt: input.now,
    };
  }

  async getMembership(context: RepositoryContext, userId: string): Promise<MembershipRecord | null> {
    const workspaceId = this.requireWorkspace(context);

    return this.database.first<MembershipRecord>(
      "SELECT id, workspace_id AS workspaceId, user_id AS userId, status, created_at AS createdAt, updated_at AS updatedAt FROM memberships WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      workspaceId,
      userId,
    );
  }
}
