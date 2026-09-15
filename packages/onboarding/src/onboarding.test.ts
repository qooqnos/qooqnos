import { describe, it } from "vitest";
import {
  assertOnboardingAtomicFailureDoesNotFallback,
  assertOnboardingTransitionUsesAtomicRepositoryPath,
} from "./atomicity-tests";
import {
  assertOnboardingCannotSelfGrantPermission,
  assertOnboardingRejectsSubjectActorMismatch,
} from "./security-tests";
import { assertOnboardingLifecycle, assertOnboardingTenantIsolation } from "./tests";

// These wrap the existing assertOnboarding* helpers so vitest actually discovers
// and runs them. The helpers previously lived only in atomicity-tests.ts,
// security-tests.ts and tests.ts, none of which match vitest's default
// `*.test.ts` / `*.spec.ts` include pattern, so `npm test` reported success
// without ever exercising them.

describe("onboarding transactional atomicity", () => {
  it("uses the atomic repository path for status transitions", async () => {
    await assertOnboardingTransitionUsesAtomicRepositoryPath();
  });

  it("does not fall back to the non-atomic path when the transactional write fails", async () => {
    await assertOnboardingAtomicFailureDoesNotFallback();
  });
});

describe("onboarding authorization security", () => {
  it("rejects an unprivileged subject attempting to submit onboarding", async () => {
    await assertOnboardingCannotSelfGrantPermission();
  });

  it("rejects an authorization subject that does not match the acting actor", async () => {
    await assertOnboardingRejectsSubjectActorMismatch();
  });
});

describe("onboarding lifecycle and tenant isolation", () => {
  it("transitions draft -> submitted -> verified", async () => {
    await assertOnboardingLifecycle();
  });

  it("denies cross-tenant onboarding profile access", async () => {
    await assertOnboardingTenantIsolation();
  });
});
