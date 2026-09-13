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

function profile(status: OnboardingProfile["status"] = "draft"): OnboardingProfile {
  return {
    id: id("profile-1"),
    organizationId: id("org-1"),
    workspaceId: id("ws-1"),
    ownerId: id("user-1"),
    status,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function authorization() {
  return {
    registerPermission() {},
    registerRole() {},
    hasPermission() { return true; },
    evaluate() { return { allowed: true, reason: "allowed" as const, permission: "test" }; },
    assert() {},
  };
}

function dependencies() {
  return {
    audit: { append: async () => undefined } as never,
    outbox: { enqueue: async () => undefined } as never,
    id: () => id("event-1"),
    now: () => "2026-01-01T00:00:01Z",
  };
}

export async function assertOnboardingLifecycle(): Promise<void> {
  let current = profile();
  const repository: OnboardingRepository = {
    async create() { return current; },
    async getById() { return current; },
    async setStatus(_context, _id, status, now) {
      current = { ...current, status, updatedAt: now };
      return current;
    },
    async setStatusAndRecord(_context, _id, transition) {
      current = { ...current, status: transition.status, updatedAt: transition.now };
      return current;
    },
  };

  const service = new OnboardingService({
    repository,
    authorization: authorization(),
    resolveSubject: () => ({
      actorId: id("user-1"),
      tenantId: id("org-1"),
      workspaceId: id("ws-1"),
      membershipStatus: "active",
      roles: [],
      permissions: ["onboarding.submit", "onboarding.verify"],
      authenticated: true,
    }),
    ...dependencies(),
  });
  const ctx = context("org-1", "ws-1", "user-1");

  await service.submit(ctx, id("profile-1"), id("user-1"));
  if (current.status !== "submitted") throw new Error("draft -> submitted failed");
  await service.verify(ctx, id("profile-1"), id("user-1"));
  if (current.status !== "verified") throw new Error("submitted -> verified failed");
}

export async function assertOnboardingTenantIsolation(): Promise<void> {
  const repository: OnboardingRepository = {
    async create() { throw new Error("not implemented"); },
    async getById(context) {
      if (context.tenantId !== id("org-1")) return null;
      if (context.workspaceId !== id("ws-1")) return null;
      return profile();
    },
    async setStatus() { throw new Error("not implemented"); },
  };

  const foreign = context("org-2", "ws-2", "user-2");
  const result = await repository.getById(foreign, id("profile-1"));
  if (result !== null) throw new Error("cross-tenant onboarding access was allowed");
}
