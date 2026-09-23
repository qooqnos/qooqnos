import type { RuntimeModule } from "@qooqnos/runtime";
import { CASE_SUPPORT_PERMISSIONS } from "./service";

export const CASE_SUPPORT_MODULE: RuntimeModule = {
  id: "case-support",
  version: "0.1.0",
  dependencies: ["communication", "automation"],
  permissions: [...CASE_SUPPORT_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of CASE_SUPPORT_PERMISSIONS) registry.registerPermission(permission);
  },
};
