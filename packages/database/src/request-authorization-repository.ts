import { D1Database, Repository } from "./client";

export interface RequestAuthorizationSubjectRecord {
  readonly userId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly membershipStatus: "invited" | "active" | "suspended" | "removed";
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}

export class RequestAuthorizationRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async resolveWorkspaceSubject(workspaceId: string, userId: string): Promise<RequestAuthorizationSubjectRecord | null> {
    const membership = await this.database.first<{
      userId: string;
      workspaceId: string;
      membershipStatus: RequestAuthorizationSubjectRecord["membershipStatus"];
      tenantId: string;
    }>(
      `SELECT m.user_id AS userId, m.workspace_id AS workspaceId, m.status AS membershipStatus,
              w.organization_id AS tenantId
       FROM memberships m
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.workspace_id = ? AND m.user_id = ? AND w.status = 'active'
       LIMIT 1`,
      workspaceId,
      userId,
    );

    if (!membership) return null;

    const roleRows = await this.database.all<{ roleId: string }>(
      `SELECT mr.role_id AS roleId
       FROM membership_roles mr
       JOIN roles r ON r.id = mr.role_id
       WHERE mr.membership_id = (
         SELECT id FROM memberships WHERE workspace_id = ? AND user_id = ? LIMIT 1
       )
       ORDER BY mr.role_id ASC`,
      workspaceId,
      userId,
    );

    const permissionRows = await this.database.all<{ permission: string }>(
      `SELECT DISTINCT p.resource || ':' || p.action AS permission
       FROM membership_roles mr
       JOIN roles r ON r.id = mr.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE mr.membership_id = (
         SELECT id FROM memberships WHERE workspace_id = ? AND user_id = ? LIMIT 1
       )
       ORDER BY permission ASC`,
      workspaceId,
      userId,
    );

    return {
      userId: membership.userId,
      tenantId: membership.tenantId,
      workspaceId: membership.workspaceId,
      membershipStatus: membership.membershipStatus,
      roles: roleRows.map((row) => row.roleId),
      permissions: permissionRows.map((row) => row.permission),
    };
  }
}
