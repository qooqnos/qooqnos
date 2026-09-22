import type { RuntimeModule } from "@qooqnos/runtime";

export const BILLING_PERMISSIONS = [
  "billing.plan.read",
  "billing.subscription.read",
  "billing.subscription.manage",
  "billing.entitlement.read",
  "billing.usage.read",
  "billing.usage.manage",
  "billing.reconciliation.read",
  "billing.reconciliation.manage",
] as const;

export const BILLING_MODULE: RuntimeModule = {
  id: "billing",
  version: "0.1.0",
  dependencies: [],
  permissions: [...BILLING_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of BILLING_PERMISSIONS) registry.registerPermission(permission);
  },
};
