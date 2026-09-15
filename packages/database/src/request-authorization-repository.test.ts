import { describe, expect, it } from "vitest";
import { D1Database } from "./client";
import { RequestAuthorizationRepository } from "./request-authorization-repository";

function databaseForSubject(found = true): D1Database {
  return new D1Database({
    prepare(sql: string) {
      return {
        bind() {
          return this;
        },
        async first<T>() {
          if (sql.includes("FROM memberships m")) {
            return (found
              ? {
                  userId: "user-1",
                  workspaceId: "workspace-1",
                  membershipStatus: "active",
                  tenantId: "tenant-1",
                }
              : null) as T | null;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("FROM membership_roles mr") && sql.includes("SELECT mr.role_id")) {
            return { results: [{ roleId: "owner" }] as T[] };
          }
          if (sql.includes("FROM membership_roles mr") && sql.includes("p.resource")) {
            return { results: [{ permission: "business:create" }] as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          return { success: true };
        },
      };
    },
    async batch() {
      return [];
    },
  });
}

describe("RequestAuthorizationRepository", () => {
  it("resolves tenant, workspace, membership, roles and effective permissions", async () => {
    const repository = new RequestAuthorizationRepository(databaseForSubject());
    await expect(repository.resolveWorkspaceSubject("workspace-1", "user-1")).resolves.toEqual({
      userId: "user-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      membershipStatus: "active",
      roles: ["owner"],
      permissions: ["business:create"],
    });
  });

  it("returns null when the user is not a member of the workspace", async () => {
    const repository = new RequestAuthorizationRepository(databaseForSubject(false));
    await expect(repository.resolveWorkspaceSubject("workspace-1", "user-1")).resolves.toBeNull();
  });
});
