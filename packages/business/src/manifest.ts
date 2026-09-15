import type { RuntimeModule } from "@qooqnos/runtime";
import { BUSINESS_PERMISSIONS } from "./service";

export const BUSINESS_MODULE: RuntimeModule = {
  id: "business",
  version: "0.1.0",
  dependencies: [],
  permissions: [...BUSINESS_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of BUSINESS_PERMISSIONS) registry.registerPermission(permission);
  },
};
