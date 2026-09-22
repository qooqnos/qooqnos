import type { RuntimeModule } from "@qooqnos/runtime";
import { COMMUNICATION_PERMISSIONS } from "./service";

export const COMMUNICATION_MODULE: RuntimeModule = {
  id: "communication",
  version: "0.1.0",
  dependencies: [],
  permissions: [...COMMUNICATION_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of COMMUNICATION_PERMISSIONS) registry.registerPermission(permission);
  },
};
