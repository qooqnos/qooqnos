import type { RuntimeModule } from "@qooqnos/runtime";
import { COMMERCE_PERMISSIONS } from "./service";

export const COMMERCE_MODULE: RuntimeModule = {
  id: "commerce",
  version: "0.1.0",
  dependencies: ["business", "catalog", "booking"],
  permissions: [...COMMERCE_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of COMMERCE_PERMISSIONS) registry.registerPermission(permission);
  },
};
