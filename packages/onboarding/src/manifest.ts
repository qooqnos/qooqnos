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
} as const;
