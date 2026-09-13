import type { EntityId, RequestContext } from "@phoenix/core";
import { AuthorizationRegistry, type AuthorizationSubject } from "@phoenix/runtime";
import { OnboardingService, type OnboardingProfile, type OnboardingRepository } from "./index";

const id = (value: string) => value as EntityId;

function context(actorId = "user-1"): RequestContext {
  return {
    requestId: id("req-security"),
    correlationId: id("cor-security"),
    actorId: id(actorId),
    tenantId: id("org-1"),
    workspaceId: id("ws-1"),
    module: "onboarding",
    operation: "security-test",
    locale: "en",
    timezone: "UTC",
  };
}

function profile(): OnboardingProfile {
  return {
    id: id("profile-1"),
    organizationId: id("org-1"),
    workspaceId: id("ws-1"),
    ownerId: id("user-1"),
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function repository(): OnboardingRepository {
  return {
    async create() { return profile(); },
    async getById() { return profile(); },
    async setStatus() { return { ...profile(), status: "submitted" }; },
  } as OnboardingRepository;
}

function dependencies() {
  return {
    audit: { append: async () => undefined } as never,
    outbox: { enqueue: async () => undefined } as never,
    id: () => id("event-security"),
    now: () => "2026-01-01T00:00:01Z",
  };
}

export async function assertOnboardingCannotSelfGrantPermission(): Promise<void> {
  const authorization = new AuthorizationRegistry();
  authorization.registerPermission("onboarding.submit");

  const subject: AuthorizationSubject = {
    actorId: id("user-1"),
    tenantId: id("org-1"),
    workspaceId: id("ws-1"),
    membershipStatus: "active",
    roles: [],
    permissions: [],
    authenticated: true,
  };

  const deps = dependencies();
  const service = new OnboardingService({
    repository: repository(),
    authorization,
    resolveSubject: () => subject,
    ...deps,
  });

  let denied = false;
  try {
    await service.submit(context(), id("profile-1"), id("user-1"));
  } catch {
    denied = true;
  }
  if (!denied) throw new Error("onboarding authorization accepted an unprivileged subject");
}

export async function assertOnboardingRejectsSubjectActorMismatch(): Promise<void> {
  const authorization = new AuthorizationRegistry();
  authorization.registerPermission("onboarding.submit");

  const mismatchedSubject: AuthorizationSubject = {
    actorId: id("different-user"),
    tenantId: id("org-1"),
    workspaceId: id("ws-1"),
    membershipStatus: "active",
    roles: [],
    permissions: ["onboarding.submit"],
    authenticated: true,
  };

  const deps = dependencies();
  const service = new OnboardingService({
    repository: repository(),
    authorization,
    resolveSubject: () => mismatchedSubject,
    ...deps,
  });

  let rejected = false;
  try {
    await service.submit(context(), id("profile-1"), id("user-1"));
  } catch (error) {
    rejected = error instanceof Error && error.message === "Authorization subject actor mismatch";
  }
  if (!rejected) throw new Error("onboarding accepted an authorization subject for another actor");
}
