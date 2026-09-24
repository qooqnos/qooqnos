import type { RuntimeModule } from "@qooqnos/runtime";
import { PROMOTION_PERMISSIONS } from "./service";

export const PROMOTION_MODULE: RuntimeModule = {
  id: "promotion",
  version: "0.1.0",
  dependencies: [],
  permissions: [...PROMOTION_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of PROMOTION_PERMISSIONS) registry.registerPermission(permission);
  },
};
