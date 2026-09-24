import type { RuntimeModule } from "@qooqnos/runtime";
import { LOYALTY_PERMISSIONS } from "./service";

export const LOYALTY_MODULE: RuntimeModule = {
  id: "loyalty",
  version: "0.1.0",
  dependencies: [],
  permissions: [...LOYALTY_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of LOYALTY_PERMISSIONS) registry.registerPermission(permission);
  },
};
