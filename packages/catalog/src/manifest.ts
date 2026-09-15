import type { RuntimeModule } from "@qooqnos/runtime";
import { CATALOG_PERMISSIONS } from "./service";

export const CATALOG_MODULE: RuntimeModule = {
  id: "catalog",
  version: "0.1.0",
  dependencies: ["business"],
  permissions: [...CATALOG_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of CATALOG_PERMISSIONS) registry.registerPermission(permission);
  },
};
