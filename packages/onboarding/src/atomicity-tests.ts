import type { CorrelationId, EntityId, RequestContext, RequestId } from "@qooqnos/core";
import { AuthorizationRegistry, type AuthorizationSubject } from "@qooqnos/runtime";
import { OnboardingService, type OnboardingProfile, type OnboardingRepository } from "./index";

const id = (value: string) => value as EntityId;
const reqId = (value: string) => value as RequestId;
const corId = (value: string) => value as CorrelationId;

function context(): RequestContext {
  return {
    requestId: reqId("req-atomic"),
    correlationId: corId("cor-atomic"),
    actorId: id("user-1"),
    tenantId: id("org-1"),
    workspaceId: id("ws-1"),
    module: "onboarding",
    operation: "atomicity-test",
    locale: "en",
    timezone: "UTC",
  };
}

function subject(): AuthorizationSubject {
  return {
    actorId: id("user-1"),
    tenantId: id("org-1"),
    workspaceId: id("ws-1"),
    membershipStatus: "active",
    roles: [],
    permissions: ["onboarding.submit"],
    authenticated: true,
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

export async function assertOnboardingTransitionUsesAtomicRepositoryPath(): Promise<void> {
  let fallbackSetStatusCalled = false;
  let atomicCalled = false;

  const repository: OnboardingRepository = {
    async create() { return profile(); },
    async getById() { return profile(); },
    async setStatus() {
      fallbackSetStatusCalled = true;
      return profile("submitted");
    },
    async setStatusAndRecord(_context, _id, transition) {
      atomicCalled = true;
      if (transition.status !== "submitted") throw new Error("unexpected transition status");
      if (!transition.audit.sql.includes("INSERT INTO audit_events")) throw new Error("audit statement missing");
      if (!transition.outbox.sql.includes("INSERT INTO outbox_events")) throw new Error("outbox statement missing");
      return profile("submitted");
    },
  };

  const authorization = new AuthorizationRegistry();
  authorization.registerPermission("onboarding.submit");
  const service = new OnboardingService({
    repository,
    authorization,
    resolveSubject: () => subject(),
    audit: { append: async () => undefined } as never,
    outbox: { enqueue: async () => undefined } as never,
    id: () => id("event-atomic"),
    now: () => "2026-01-01T00:00:01Z",
  });

  const result = await service.submit(context(), id("profile-1"), id("user-1"));
  if (result.status !== "submitted") throw new Error("transactional transition did not return submitted profile");
  if (!atomicCalled) throw new Error("transactional repository path was not used");
  if (fallbackSetStatusCalled) throw new Error("non-atomic fallback path was unexpectedly used");
}

export async function assertOnboardingAtomicFailureDoesNotFallback(): Promise<void> {
  let auditCalled = false;
  let outboxCalled = false;

  const repository: OnboardingRepository = {
    async create() { return profile(); },
    async getById() { return profile(); },
    async setStatus() { throw new Error("setStatus must not be used"); },
    async setStatusAndRecord() {
      throw new Error("simulated transaction rollback");
    },
  };

  const authorization = new AuthorizationRegistry();
  authorization.registerPermission("onboarding.submit");
  const service = new OnboardingService({
    repository,
    authorization,
    resolveSubject: () => subject(),
    audit: { append: async () => { auditCalled = true; } } as never,
    outbox: { enqueue: async () => { outboxCalled = true; } } as never,
    id: () => id("event-atomic-failure"),
    now: () => "2026-01-01T00:00:01Z",
  });

  let failed = false;
  try {
    await service.submit(context(), id("profile-1"), id("user-1"));
  } catch (error) {
    failed = error instanceof Error && error.message === "simulated transaction rollback";
  }

  if (!failed) throw new Error("transaction failure was not propagated");
  if (auditCalled || outboxCalled) throw new Error("transaction failure caused non-atomic side effects");
}
