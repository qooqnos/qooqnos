import type { RuntimeModule } from "@qooqnos/runtime";
import { CUSTOMER_PERMISSIONS } from "./service";

export const CUSTOMER_MODULE: RuntimeModule = {
  id: "customer",
  version: "0.1.0",
  dependencies: ["business"],
  permissions: [...CUSTOMER_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of CUSTOMER_PERMISSIONS) registry.registerPermission(permission);
  },
};
