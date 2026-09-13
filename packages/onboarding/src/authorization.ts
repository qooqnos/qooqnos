import type { AuthorizationPolicyRegistry } from "@qooqnos/runtime";

export const ONBOARDING_PERMISSIONS = [
  "onboarding.create",
  "onboarding.submit",
  "onboarding.verify",
  "onboarding.reject",
] as const;

export function registerOnboardingAuthorization(registry: AuthorizationPolicyRegistry): void {
  for (const permission of ONBOARDING_PERMISSIONS) {
    registry.registerPermission(permission);
  }
}
