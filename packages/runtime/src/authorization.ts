import { AppError, type EntityId, type RequestContext } from "@phoenix/core";

export type Permission = string;
export type MembershipStatus = "invited" | "pending" | "active" | "suspended" | "removed";

export interface AuthorizationSubject {
  readonly actorId?: EntityId;
  readonly tenantId?: EntityId;
  readonly workspaceId?: EntityId;
  readonly membershipStatus?: MembershipStatus;
  readonly roles: readonly string[];
  readonly permissions: readonly Permission[];
  readonly authenticated: boolean;
}

export interface AuthorizationResource {
  readonly tenantId?: string;
  readonly workspaceId?: string;
  readonly ownerId?: string;
  readonly sensitivity?: "normal" | "sensitive" | "restricted";
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface AuthorizationRequest {
  readonly context: RequestContext;
  readonly permission: Permission;
  readonly resource?: AuthorizationResource;
  readonly subject: AuthorizationSubject;
  readonly requireAuthentication?: boolean;
  readonly requireWorkspace?: boolean;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "unauthenticated"
    | "missing_tenant"
    | "missing_workspace"
    | "membership_denied"
    | "permission_denied"
    | "tenant_denied"
    | "workspace_denied"
    | "resource_denied";
  readonly permission: Permission;
}

export type ResourcePolicy = (input: AuthorizationRequest) => boolean;

export interface AuthorizationPolicyRegistry {
  register(permission: Permission, policy?: ResourcePolicy): void;
  has(permission: Permission): boolean;
  evaluate(input: AuthorizationRequest): AuthorizationDecision;
  assert(input: AuthorizationRequest): void;
}

const ACTIVE_MEMBERSHIP: ReadonlySet<MembershipStatus> = new Set(["active"]);

export class AuthorizationDeniedError extends AppError {
  constructor(decision: AuthorizationDecision, requestId?: RequestContext["requestId"]) {
    super({
      code: decision.reason === "unauthenticated" ? "UNAUTHORIZED" : "FORBIDDEN",
      message: `Authorization denied: ${decision.reason}`,
      requestId,
      details: { permission: decision.permission, reason: decision.reason },
    });
    this.name = "AuthorizationDeniedError";
  }
}

export class AuthorizationRegistry implements AuthorizationPolicyRegistry {
  private readonly policies = new Map<Permission, ResourcePolicy | undefined>();

  register(permission: Permission, policy?: ResourcePolicy): void {
    if (!permission.trim()) throw new Error("Permission cannot be empty");
    if (this.policies.has(permission)) throw new Error(`Permission already registered: ${permission}`);
    this.policies.set(permission, policy);
  }

  has(permission: Permission): boolean {
    return this.policies.has(permission);
  }

  evaluate(input: AuthorizationRequest): AuthorizationDecision {
    const { context, permission, subject, resource } = input;
    const requireAuthentication = input.requireAuthentication ?? true;
    const requireWorkspace = input.requireWorkspace ?? Boolean(context.workspaceId || resource?.workspaceId);

    if (requireAuthentication && !subject.authenticated) {
      return denied("unauthenticated", permission);
    }
    if (requireWorkspace && !context.workspaceId) {
      return denied("missing_workspace", permission);
    }
    if (context.workspaceId && subject.workspaceId !== context.workspaceId) {
      return denied("workspace_denied", permission);
    }
    if (context.tenantId && subject.tenantId !== context.tenantId) {
      return denied("tenant_denied", permission);
    }
    if (requireWorkspace && !subject.tenantId) {
      return denied("missing_tenant", permission);
    }
    if (requireWorkspace && (!subject.membershipStatus || !ACTIVE_MEMBERSHIP.has(subject.membershipStatus))) {
      return denied("membership_denied", permission);
    }
    if (!subject.permissions.includes(permission)) {
      return denied("permission_denied", permission);
    }
    if (resource?.tenantId && subject.tenantId !== resource.tenantId) {
      return denied("tenant_denied", permission);
    }
    if (resource?.workspaceId && subject.workspaceId !== resource.workspaceId) {
      return denied("workspace_denied", permission);
    }

    const policy = this.policies.get(permission);
    if (policy && !policy(input)) {
      return denied("resource_denied", permission);
    }

    return { allowed: true, reason: "allowed", permission };
  }

  assert(input: AuthorizationRequest): void {
    const decision = this.evaluate(input);
    if (!decision.allowed) throw new AuthorizationDeniedError(decision, input.context.requestId);
  }
}

export function createAuthorizationRegistry(
  definitions: Readonly<Record<Permission, ResourcePolicy | undefined>> = {},
): AuthorizationRegistry {
  const registry = new AuthorizationRegistry();
  for (const [permission, policy] of Object.entries(definitions)) registry.register(permission, policy);
  return registry;
}

export function tenantResourcePolicy(): ResourcePolicy {
  return ({ context, resource }) => {
    if (!context.tenantId) return false;
    if (!resource?.tenantId) return true;
    return context.tenantId === resource.tenantId;
  };
}

export function workspaceResourcePolicy(): ResourcePolicy {
  return ({ context, resource }) => {
    if (!context.workspaceId) return false;
    if (!resource?.workspaceId) return true;
    return context.workspaceId === resource.workspaceId;
  };
}

export function ownerResourcePolicy(): ResourcePolicy {
  return ({ subject, resource }) => {
    if (!subject.actorId || !resource?.ownerId) return false;
    return subject.actorId === resource.ownerId;
  };
}

function denied(
  reason: AuthorizationDecision["reason"],
  permission: Permission,
): AuthorizationDecision {
  return { allowed: false, reason, permission };
}
