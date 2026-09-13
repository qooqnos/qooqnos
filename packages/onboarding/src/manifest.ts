import type { AuthorizationPolicyRegistry } from "@qooqnos/runtime";
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
  dependencies: ["runtime"],
  permissions: ONBOARDING_PERMISSIONS,
  registerAuthorization(registry: AuthorizationPolicyRegistry): void {
    registerOnboardingAuthorization(registry);
  },
} as const;
