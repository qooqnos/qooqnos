import type { EntityId } from "@qooqnos/core";
import { createAuthenticationService } from "@qooqnos/auth";
import { D1Database, IdentityRepository, RequestAuthorizationRepository, SessionRepository } from "@qooqnos/database";
import { AuthorizationRegistry, type AuthorizationSubject } from "@qooqnos/runtime";
import { brandId } from "@qooqnos/core";
import type { ApiRequestContext } from "./context";

export interface RequestAuthResult {
  readonly context: ApiRequestContext;
  readonly subject: AuthorizationSubject;
  readonly authenticatedSessionId?: string;
}

export interface RequestAuthOptions {
  readonly database?: D1Database;
  readonly workspaceId?: string;
  readonly authorization: AuthorizationRegistry;
}

export async function resolveRequestAuth(
  context: ApiRequestContext,
  request: Request,
  options: RequestAuthOptions,
): Promise<RequestAuthResult> {
  const bearer = request.headers.get("authorization");
  const accessToken = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : "";

  if (!accessToken || !options.database) {
    return { context, subject: { roles: [], permissions: [], authenticated: false } };
  }

  const sessions = new SessionRepository(options.database);
  const identities = new IdentityRepository(options.database);
  const authentication = createAuthenticationService(sessions, identities);
  const session = await authentication.authenticate(accessToken);

  if (!session) {
    return { context, subject: { roles: [], permissions: [], authenticated: false } };
  }

  let authenticatedContext = authentication.buildContext(context, session) as ApiRequestContext;
  let subject: AuthorizationSubject = {
    actorId: session.userId,
    roles: [],
    permissions: [],
    authenticated: true,
  };

  const workspaceId = options.workspaceId;
  if (workspaceId) {
    const scoped = await new RequestAuthorizationRepository(options.database).resolveWorkspaceSubject(
      workspaceId,
      session.userId,
    );
    if (scoped) {
      authenticatedContext = {
        ...authenticatedContext,
        tenantId: brandId<"EntityId">(scoped.tenantId) as EntityId,
        workspaceId: brandId<"EntityId">(scoped.workspaceId) as EntityId,
      };
      subject = {
        actorId: session.userId,
        tenantId: authenticatedContext.tenantId,
        workspaceId: authenticatedContext.workspaceId,
        membershipStatus: scoped.membershipStatus,
        roles: scoped.roles,
        permissions: scoped.permissions,
        authenticated: true,
      };
    }
  }

  return {
    context: authenticatedContext,
    subject,
    authenticatedSessionId: session.sessionId,
  };
}
