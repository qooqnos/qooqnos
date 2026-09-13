import type { AuthorizationPolicyRegistry } from "@phoenix/runtime";
import { registerOnboardingAuthorization } from "./authorization";

export const ONBOARDING_PERMISSIONS = [
  "onboarding.create",
  "onboarding.submit",
  "onboarding.verify",
  "onboarding.reject",
] as const;

export const onboardingModule = {
  id: "onboarding",
  version: "1.0.0",
  dependencies: [],
  permissions: ONBOARDING_PERMISSIONS,
  registerAuthorization(registry: AuthorizationPolicyRegistry): void {
    registerOnboardingAuthorization(registry);
  },
} as const;
