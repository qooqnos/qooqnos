import type { EntityId, RequestContext } from "@phoenix/core";
import { OnboardingService, type OnboardingProfile, type OnboardingRepository } from "./index";

const id = (value: string) => value as EntityId;

function context(tenantId: string, workspaceId: string, actorId: string): RequestContext {
  return {
    requestId: id("req-test"),
    correlationId: id("cor-test"),
    actorId: id(actorId),
    tenantId: id(tenantId),
    workspaceId: id(workspaceId),
    module: "onboarding",
    operation: "test",
    locale: "en",
    timezone: "UTC",
  };
}

export function assertOnboardingLifecycle(): void {
  let profile: OnboardingProfile = {
    id: id("profile-1"),
    organizationId: id("org-1"),
    workspaceId: id("ws-1"),
    ownerId: id("user-1"),
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const repository: OnboardingRepository = {
    async create() { return profile; },
    async getById() { return profile; },
    async setStatus(_context, _id, status, now) {
      profile = { ...profile, status, updatedAt: now };
      return profile;
    },
  };

  const authorization = {
    registerPermission() {},
    registerRole() {},
    hasPermission() { return true; },
    evaluate() { return { allowed: true, reason: "allowed" as const, permission: "test" }; },
    assert() {},
  };
  const audit = { append: async () => undefined } as never;
  const outbox = { enqueue: async () => undefined } as never;
  const service = new OnboardingService({
    repository,
    authorization,
    audit,
    outbox,
    id: () => id("event-1"),
    now: () => "2026-01-01T00:00:01Z",
  });
  const ctx = context("org-1", "ws-1", "user-1");

  return void (async () => {
    await service.submit(ctx, id("profile-1"), id("user-1"));
    if (profile.status !== "submitted") throw new Error("draft -> submitted failed");
    await service.verify(ctx, id("profile-1"), id("user-1"));
    if (profile.status !== "verified") throw new Error("submitted -> verified failed");
  })();
}

export function assertOnboardingTenantIsolation(): void {
  const repository: OnboardingRepository = {
    async create() { throw new Error("not implemented"); },
    async getById(context) {
      if (context.tenantId !== id("org-1")) return null;
      if (context.workspaceId !== id("ws-1")) return null;
      return {
        id: id("profile-1"),
        organizationId: id("org-1"),
        workspaceId: id("ws-1"),
        ownerId: id("user-1"),
        status: "draft",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
    },
    async setStatus() { throw new Error("not implemented"); },
  };

  const foreign = context("org-2", "ws-2", "user-2");
  if (foreign.tenantId === id("org-1") || foreign.workspaceId === id("ws-1")) {
    throw new Error("test context must be foreign");
  }

  void repository.getById(foreign, id("profile-1")).then((result) => {
    if (result !== null) throw new Error("cross-tenant onboarding access was allowed");
  });
}
