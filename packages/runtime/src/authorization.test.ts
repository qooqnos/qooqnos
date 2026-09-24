import { describe, expect, it } from "vitest";
import { brandId, type RequestContext } from "@qooqnos/core";
import {
  AuthorizationDeniedError,
  AuthorizationRegistry,
  createAuthorizationRegistry,
  ownerResourcePolicy,
  tenantResourcePolicy,
  workspaceResourcePolicy,
} from "./authorization";

const context: RequestContext = {
  requestId: brandId<"RequestId">("req-1"),
  correlationId: brandId<"CorrelationId">("corr-1"),
  actorId: brandId<"EntityId">("user-1"),
  tenantId: brandId<"EntityId">("tenant-1"),
  workspaceId: brandId<"EntityId">("workspace-1"),
  module: "runtime",
  operation: "test",
  locale: "en",
  timezone: "UTC",
};

const subject = {
  actorId: context.actorId,
  tenantId: context.tenantId,
  workspaceId: context.workspaceId,
  membershipStatus: "active" as const,
  roles: ["owner"],
  authenticated: true,
};

function registry() {
  return createAuthorizationRegistry(
    {
      "catalog.read": undefined,
      "catalog.write": workspaceResourcePolicy(),
      "profile.read": ownerResourcePolicy(),
    },
    [{ id: "owner", permissions: ["catalog.read", "catalog.write", "profile.read"] }],
  );
}

describe("AuthorizationRegistry", () => {
  it("allows an active member with the registered permission", () => {
    const decision = registry().evaluate({ context, permission: "catalog.read", subject });
    expect(decision).toEqual({ allowed: true, reason: "allowed", reasonCode: "allowed", policyVersion: "authorization-v1", permission: "catalog.read" });
  });

  it("denies an unauthenticated subject before permission evaluation", () => {
    const decision = registry().evaluate({
      context,
      permission: "catalog.read",
      subject: { ...subject, authenticated: false },
    });
    expect(decision.reason).toBe("unauthenticated");
  });

  it("denies a cross-tenant request", () => {
    const decision = registry().evaluate({
      context,
      permission: "catalog.read",
      subject: { ...subject, tenantId: brandId<"EntityId">("tenant-2") },
    });
    expect(decision.reason).toBe("tenant_denied");
  });

  it("denies an inactive membership for workspace-scoped operations", () => {
    const decision = registry().evaluate({
      context,
      permission: "catalog.write",
      subject: { ...subject, membershipStatus: "suspended" },
    });
    expect(decision.reason).toBe("membership_denied");
  });

  it("enforces workspace resource scope", () => {
    const decision = registry().evaluate({
      context,
      permission: "catalog.write",
      subject,
      resource: { workspaceId: "workspace-2" },
    });
    expect(decision.reason).toBe("workspace_denied");
  });

  it("enforces owner policy", () => {
    const allowed = registry().evaluate({
      context,
      permission: "profile.read",
      subject,
      resource: { ownerId: "user-1" },
    });
    const denied = registry().evaluate({
      context,
      permission: "profile.read",
      subject,
      resource: { ownerId: "user-2" },
    });
    expect(allowed.allowed).toBe(true);
    expect(denied.reason).toBe("resource_denied");
  });

  it("requires an entitlement evaluator when an entitlement is requested", () => {
    const authorization = new AuthorizationRegistry();
    authorization.registerPermission("ai.run");
    authorization.registerRole({ id: "owner", permissions: ["ai.run"] });
    const decision = authorization.evaluate({
      context,
      permission: "ai.run",
      subject,
      requiredEntitlement: "ai.operations",
    });
    expect(decision.reason).toBe("entitlement_denied");
  });

  it("assert throws a typed authorization error", () => {
    expect(() =>
      registry().assert({
        context,
        permission: "catalog.read",
        subject: { ...subject, authenticated: false },
      }),
    ).toThrow(AuthorizationDeniedError);
  });

  it("requires explicit tenant context for tenant policy", () => {
    const policy = tenantResourcePolicy();
    expect(policy({ context: { ...context, tenantId: undefined }, permission: "x", subject })).toBe(false);
    expect(policy({ context, permission: "x", subject, resource: { tenantId: "tenant-1" } })).toBe(true);
  });

  it("requires explicit workspace context for workspace policy", () => {
    const policy = workspaceResourcePolicy();
    expect(policy({ context: { ...context, workspaceId: undefined }, permission: "x", subject })).toBe(false);
    expect(policy({ context, permission: "x", subject, resource: { workspaceId: "workspace-1" } })).toBe(true);
  });
});

describe("Authorization decision contract metadata", () => {
  it("exposes stable reasonCode and policyVersion for denial", () => {
    const decision = registry().evaluate({
      context,
      permission: "catalog.read",
      subject: { ...subject, authenticated: false },
    });
    expect(decision.reasonCode).toBe("unauthenticated");
    expect(decision.policyVersion).toBe("authorization-v1");
  });
});
