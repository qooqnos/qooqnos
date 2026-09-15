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
    const organizationId = this.requireOrganization(context);
    const workspaceId = this.requireWorkspace(context);
    const membership = await this.database.first<AuthorizationMembershipRecord>(
      `SELECT m.id, m.workspace_id AS workspaceId, m.user_id AS userId, m.status
       FROM memberships m
       INNER JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.workspace_id = ? AND m.user_id = ? AND w.organization_id = ?
       LIMIT 1`,
      workspaceId,
      userId,
      organizationId,
    );
    if (!membership) return null;

    const roles = await this.database.all<AuthorizationRoleRecord>(
      `SELECT r.id, r.name, r.workspace_id AS workspaceId
       FROM roles r
       INNER JOIN membership_roles mr ON mr.role_id = r.id
       WHERE mr.membership_id = ?
         AND (r.workspace_id IS NULL OR r.workspace_id = ?)
       ORDER BY r.id ASC`,
      membership.id,
      workspaceId,
    );

    const permissions = roles.length === 0
      ? []
      : await this.database.all<AuthorizationPermissionRecord>(
          `SELECT DISTINCT p.id, p.resource, p.action
           FROM permissions p
           INNER JOIN role_permissions rp ON rp.permission_id = p.id
           INNER JOIN membership_roles mr ON mr.role_id = rp.role_id
           INNER JOIN roles r ON r.id = rp.role_id
           WHERE mr.membership_id = ?
             AND (r.workspace_id IS NULL OR r.workspace_id = ?)
           ORDER BY p.id ASC`,
          membership.id,
          workspaceId,
        );

    return { membership, roles, permissions };
  }

  async requireSubject(context: RepositoryContext, userId: string): Promise<AuthorizationSubjectRecord> {
    const subject = await this.getSubject(context, userId);
    if (!subject) throw new DatabaseError("User has no membership in the current workspace");
    return subject;
  }
}
