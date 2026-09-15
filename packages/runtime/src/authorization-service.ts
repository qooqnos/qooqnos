import type { RequestContext } from "@qooqnos/core";
import type { AuthorizationRepository } from "@qooqnos/database";
import {
  AuthorizationDeniedError,
  AuthorizationRegistry,
  type AuthorizationDecision,
  type AuthorizationResource,
} from "./authorization";

export interface AuthorizationServiceInput {
  readonly context: RequestContext;
  readonly permission: string;
  readonly resource?: AuthorizationResource;
  readonly requiredEntitlement?: string;
  readonly requireAuthentication?: boolean;
  readonly requireWorkspace?: boolean;
}

export interface AuthorizationService {
  evaluate(input: AuthorizationServiceInput): Promise<AuthorizationDecision>;
  assert(input: AuthorizationServiceInput): Promise<void>;
}

export function createAuthorizationService(
  repository: AuthorizationRepository,
  registry: AuthorizationRegistry,
): AuthorizationService {
  return {
    async evaluate(input) {
      const actorId = input.context.actorId;
      if (!actorId) {
        return registry.evaluate({
          context: input.context,
          permission: input.permission,
          resource: input.resource,
          subject: { roles: [], authenticated: false },
          requiredEntitlement: input.requiredEntitlement,
          requireAuthentication: input.requireAuthentication,
          requireWorkspace: input.requireWorkspace,
        });
      }

      const requireWorkspace = input.requireWorkspace ?? Boolean(input.context.workspaceId || input.resource?.workspaceId);
      const subject = requireWorkspace && input.context.workspaceId
        ? await repository.getSubject({ organizationId: input.context.tenantId, workspaceId: input.context.workspaceId }, actorId)
        : null;

      return registry.evaluate({
        context: input.context,
        permission: input.permission,
        resource: input.resource,
        subject: {
          actorId,
          tenantId: input.context.tenantId,
          workspaceId: input.context.workspaceId,
          membershipStatus: subject?.membership.status,
          roles: subject?.roles.map((role) => role.id) ?? [],
          permissions: subject?.permissions.map((permission) => `${permission.resource}:${permission.action}`) ?? [],
          authenticated: true,
        },
        requiredEntitlement: input.requiredEntitlement,
        requireAuthentication: input.requireAuthentication,
        requireWorkspace: input.requireWorkspace,
      });
    },
    async assert(input) {
      const decision = await this.evaluate(input);
      if (!decision.allowed) throw new AuthorizationDeniedError(decision, input.context.requestId);
    },
  };
}
