import type { RuntimeModule } from "@qooqnos/runtime";
import { TRUST_PERMISSIONS } from "./service";

export const TRUST_MODULE: RuntimeModule = {
  id: "trust",
  version: "0.1.0",
  dependencies: [],
  permissions: [...TRUST_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of TRUST_PERMISSIONS) registry.registerPermission(permission);
  },
};
