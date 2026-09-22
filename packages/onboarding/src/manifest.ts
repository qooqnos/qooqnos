import { ONBOARDING_PERMISSIONS, registerOnboardingAuthorization } from "./authorization";

export const onboardingModule = {
  id: "onboarding",
  version: "1.0.0",
  dependencies: ["runtime"],
  permissions: ONBOARDING_PERMISSIONS,
  registerAuthorization(registry: {
    registerPermission(permission: string): void;
  }): void {
    registerOnboardingAuthorization(registry);
  },
} as const;
