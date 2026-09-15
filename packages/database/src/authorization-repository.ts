import { DatabaseError, D1Database, Repository, RepositoryContext } from "./client";

export interface AuthorizationMembershipRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly status: "active" | "invited" | "suspended" | "removed";
}

export interface AuthorizationRoleRecord {
  readonly id: string;
  readonly name: string;
  readonly workspaceId: string | null;
}

export interface AuthorizationPermissionRecord {
  readonly id: string;
  readonly resource: string;
  readonly action: string;
}

export interface AuthorizationSubjectRecord {
  readonly membership: AuthorizationMembershipRecord;
  readonly roles: readonly AuthorizationRoleRecord[];
  readonly permissions: readonly AuthorizationPermissionRecord[];
}

/** Canonical persistence reader for Access decisions. It only reads identity/access state. */
export class AuthorizationRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async getSubject(context: RepositoryContext, userId: string): Promise<AuthorizationSubjectRecord | null> {
    const workspaceId = this.requireWorkspace(context);
    const membership = await this.database.first<AuthorizationMembershipRecord>(
      "SELECT id, workspace_id AS workspaceId, user_id AS userId, status FROM memberships WHERE workspace_id = ? AND user_id = ? LIMIT 1",
      workspaceId,
      userId,
    );
    if (!membership) return null;

    const roles = await this.database.all<AuthorizationRoleRecord>(
      "SELECT r.id, r.name, r.workspace_id AS workspaceId FROM roles r INNER JOIN membership_roles mr ON mr.role_id = r.id WHERE mr.membership_id = ? ORDER BY r.id ASC",
      membership.id,
    );

    const permissions = roles.length === 0
      ? []
      : await this.database.all<AuthorizationPermissionRecord>(
          `SELECT DISTINCT p.id, p.resource, p.action
           FROM permissions p
           INNER JOIN role_permissions rp ON rp.permission_id = p.id
           INNER JOIN membership_roles mr ON mr.role_id = rp.role_id
           WHERE mr.membership_id = ?
           ORDER BY p.resource ASC, p.action ASC`,
          membership.id,
        );

    return { membership, roles, permissions };
  }

  async requireSubject(context: RepositoryContext, userId: string): Promise<AuthorizationSubjectRecord> {
    const subject = await this.getSubject(context, userId);
    if (!subject) throw new DatabaseError("User has no membership in the current workspace");
    return subject;
  }
}
