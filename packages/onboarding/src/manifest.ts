import type { AuthorizationPolicyRegistry } from "@qooqnos/runtime";
import { ONBOARDING_PERMISSIONS, registerOnboardingAuthorization } from "./authorization";

export const onboardingModule = {
  id: "onboarding",
  version: "1.0.0",
  dependencies: ["runtime"],
  permissions: ONBOARDING_PERMISSIONS,
  registerAuthorization(registry: AuthorizationPolicyRegistry): void {
    registerOnboardingAuthorization(registry);
  },
} as const;
