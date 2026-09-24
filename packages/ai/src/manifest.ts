import type { RuntimeModule } from "@qooqnos/runtime";
import { AI_MEMORY_PERMISSIONS } from "./memory-service";

export const AI_MODULE: RuntimeModule = {
  id: "ai",
  version: "0.1.0",
  dependencies: [],
  permissions: [...AI_MEMORY_PERMISSIONS],
  registerAuthorization(registry) {
    for (const permission of AI_MEMORY_PERMISSIONS) registry.registerPermission(permission);
  },
};
